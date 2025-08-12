// src/hooks/useCountriesApi.js
import { useEffect, useState } from "react";
import axios from "axios";

export default function useCountriesApi(locale = "en") {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get(`/api/meta/countries`, {
          params: { active: 1, locale },
          withCredentials: true,
        });
        if (alive) setRows(data || []);
      } catch (e) {
        if (alive) setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [locale]);

  return { countries: rows, loading, err };
}
