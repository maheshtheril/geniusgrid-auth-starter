// src/hooks/useBootstrap.js
import { get } from "@/lib/api";

const KEY = "gg_bootstrap_cache_v1";

const safeParse = (s) => {
  try { return JSON.parse(s); } catch { return null; }
};

const unwrap = (x) => (x && typeof x === "object" && "data" in x ? x.data : x);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function retryDelay(attempt) {
  // ~500ms → 5s with jitter
  return Math.min(500 * Math.pow(1.7, attempt) + Math.random() * 200, 5000);
}

export async function fetchBootstrap({ useCacheFirst = true } = {}) {
  const cached = safeParse(localStorage.getItem(KEY));

  // background refresh loop
  const fetchFresh = async () => {
    let lastErr = null;
    for (let i = 0; i < 6; i++) {
      try {
        const raw = await get("/bootstrap", { meta: { dedupe: true } });
        const data = unwrap(raw);
        localStorage.setItem(KEY, JSON.stringify(data || {}));
        return data;
      } catch (e) {
        const status = e?.response?.status;
        // retry only for rate-limit / cold-start type errors
        if (status === 429 || status === 502 || status === 503 || status === 504) {
          // respect Retry-After if present
          const ra = e?.response?.headers?.["retry-after"];
          const ms = ra ? (() => {
            const n = Number(ra);
            if (!Number.isNaN(n)) return n * 1000;
            const t = new Date(ra).getTime();
            return Number.isNaN(t) ? retryDelay(i) : Math.max(0, t - Date.now());
          })() : retryDelay(i);
          await sleep(ms);
          continue;
        }
        lastErr = e;
        break;
      }
    }
    if (lastErr) throw lastErr;
    return cached; // fallback
  };

  if (useCacheFirst && cached) {
    // don’t block UI; refresh in background
    fetchFresh().catch(() => {});
    return cached;
  }

  return await fetchFresh();
}
