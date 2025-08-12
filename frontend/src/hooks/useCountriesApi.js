// frontend/src/hooks/useCountriesApi.js
import { useEffect, useState } from "react";

function normalize(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.data)) return maybe.data;
  if (Array.isArray(maybe?.rows)) return maybe.rows;
  if (Array.isArray(maybe?.results)) return maybe.results;
  return [];
}

export const flagFromIso2 = (iso2 = "") =>
  iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

export default function useCountriesApi(locale = "en") {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // If your backend is on another origin, use import.meta.env.VITE_API_URL
        const base = import.meta?.env?.VITE_API_URL || "";
        const res = await fetch(`${base}/api/countries?locale=${encodeURIComponent(locale)}`);
        const json = await res.json();
        const rows = normalize(json).map(c => ({
          id: c.id,
          iso2: (c.iso2 || "").toUpperCase(),
          name: c.name || c.name_en || "",
          default_dial: c.default_dial || "",
          emoji_flag: c.emoji_flag || flagFromIso2(c.iso2)
        })).filter(r => r.iso2 && r.default_dial);
        if (alive) setCountries(rows);
      } catch (e) {
        console.error(e);
        if (alive) { setError("Unable to load countries."); setCountries([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [locale]);

  return { countries, loading, error };
}
