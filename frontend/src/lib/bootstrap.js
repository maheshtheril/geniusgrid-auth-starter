import { api } from "./api";

export async function bootstrap({ silent = true } = {}) {
  try {
    // fire a quick warm-up; our axios 429 handler will auto-retry a few times
    await api.get("/bootstrap", { meta: { dedupe: true } });
    if (!silent) console.log("[bootstrap] ok");
  } catch (err) {
    // do NOT throw — free tiers can 429; we don’t want to block the app
    if (!silent) console.warn("[bootstrap] failed", err?.message || err);
  }
}
