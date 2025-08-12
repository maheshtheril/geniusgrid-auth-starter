#!/usr/bin/env node
/* Seed public.countries, public.country_translations, public.country_dial_codes
   Requires: DATABASE_URL (?sslmode=require for Render). */

const { Client } = require("pg");
const countriesLib = require("i18n-iso-countries");
countriesLib.registerLocale(require("i18n-iso-countries/langs/en.json"));
const metadata = require("libphonenumber-js/metadata.min.json");
const worldCountries = require("world-countries"); // region/subregion/currencies

// "IN" -> 🇮🇳
const flagFromIso2 = (iso2 = "") =>
  iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

function callingCodesByIso(meta) {
  const map = new Map();
  const dict = meta.country_calling_codes || {};
  for (const [digits, list] of Object.entries(dict)) {
    for (const iso2 of list) {
      const key = iso2.toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(`+${digits}`);
    }
  }
  return map;
}

function wcIndexByISO2() {
  const map = new Map();
  for (const c of worldCountries) {
    const iso2 = (c.cca2 || "").toUpperCase();
    if (!iso2) continue;
    const region = c.region || null;
    const subregion = c.subregion || null;
    let currency_code = null;
    if (c.currencies && typeof c.currencies === "object") {
      const keys = Object.keys(c.currencies);
      if (keys.length) currency_code = keys[0].toUpperCase();
    }
    map.set(iso2, { region, subregion, currency_code });
  }
  return map;
}

(async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ Set DATABASE_URL and re-run (…?sslmode=require)");
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Render/Neon
  });
  await client.connect();

  const names = countriesLib.getNames("en", { select: "official" }); // { IN: "India", ... }
  const codesMap = callingCodesByIso(metadata);
  const wcByIso2 = wcIndexByISO2();

  let inserted = 0, updated = 0, dials = 0;

  await client.query("BEGIN");
  try {
    for (const iso2 of Object.keys(names).sort()) {
      const iso3 = countriesLib.alpha2ToAlpha3(iso2);
      const name_en = names[iso2];
      const emoji_flag = flagFromIso2(iso2);
      const dialList = codesMap.get(iso2) || [];
      const default_dial = dialList[0] || "";
      if (!default_dial) continue;

      const extra = wcByIso2.get(iso2) || {};
      const region = extra.region || null;
      const subregion = extra.subregion || null;
      const currency_code = extra.currency_code || null;

      // Upsert into countries (also region/subregion/currency_code)
      const res = await client.query(
        `INSERT INTO public.countries
           (iso2, iso3, name_en, emoji_flag, default_dial, region, subregion, currency_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (iso2) DO UPDATE
           SET name_en      = EXCLUDED.name_en,
               emoji_flag   = EXCLUDED.emoji_flag,
               default_dial = EXCLUDED.default_dial,
               region       = COALESCE(EXCLUDED.region, public.countries.region),
               subregion    = COALESCE(EXCLUDED.subregion, public.countries.subregion),
               currency_code= COALESCE(EXCLUDED.currency_code, public.countries.currency_code)
         RETURNING id, xmax = 0 AS inserted`,
        [iso2, iso3, name_en, emoji_flag, default_dial, region, subregion, currency_code]
      );
      const countryId = res.rows[0].id;
      if (res.rows[0].inserted) inserted++; else updated++;

      // Upsert English translation
      await client.query(
        `INSERT INTO public.country_translations (country_id, locale, name)
         VALUES ($1,'en',$2)
         ON CONFLICT (country_id, locale) DO UPDATE SET name = EXCLUDED.name`,
        [countryId, name_en]
      );

      // Replace dial codes set
      await client.query(`DELETE FROM public.country_dial_codes WHERE country_id = $1`, [countryId]);
      for (let i = 0; i < dialList.length; i++) {
        await client.query(
          `INSERT INTO public.country_dial_codes (country_id, dial_code, is_primary)
           VALUES ($1,$2,$3)`,
          [countryId, dialList[i], i === 0]
        );
        dials++;
      }
    }

    await client.query("COMMIT");
    console.log(`✓ Countries: ${inserted} inserted, ${updated} updated`);
    console.log(`✓ Dial codes rows written: ${dials}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
