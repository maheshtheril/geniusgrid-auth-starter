// Robust countries loader for your AddLeadDrawer.
// Uses VITE_API_URL if present, else falls back to your Render backend URL.

import { useEffect, useState } from "react";

export const flagFromIso2 = (iso2 = "") =>
  iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

function normalizeToArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.data)) return maybe.data;
  if (Array.isArray(maybe?.rows)) return maybe.rows;
  if (Array.isArray(maybe?.results)) return maybe.results;
  return [];
}

export default function useCountriesApi(locale = "en") {
  const base =
    (import.meta?.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
    "https://geniusgrid-auth-starter.onrender.com"; // ← your backend on Render

  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const url = `${base}/api/countries?locale=${encodeURIComponent(locale)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows = normalizeToArray(json);
        const out = rows.map(r => ({
          id: r.id,
          iso2: (r.iso2 || "").toUpperCase(),
          name: r.name || r.name_en || r.iso2,
          default_dial: r.default_dial || r.dial || r.phone_code || "",
          emoji_flag: r.emoji_flag || flagFromIso2(r.iso2),
        })).filter(x => x.iso2 && x.default_dial);
        if (alive) setCountries(out);
      } catch (e) {
        console.error("[useCountriesApi] failed:", e);
        if (alive) { setError(String(e.message || e)); setCountries([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [base, locale]);

  return { countries, loading, error, baseUrl: base };
}
