// src/mocks/aiProspectMock.js
const ENABLE = true; // flip to false to disable quickly

const MOCK = {
  ok: true,
  jobId: "mock-job-1",
  status: "completed",
  items: [
    { id:"L-001", name:"Alice Carter", company_name:"Orbitix Labs",  email:"alice@orbitixlabs.io",  phone:"+1-555-000-1000", status:"new",       stage:"Prospect",   owner_name:"AI Bot", score:86, created_at:"2025-08-01T10:00:00Z" },
    { id:"L-002", name:"Brian Chen",   company_name:"Neon Freight",  email:"brian@neonfreight.com", phone:"+1-555-000-1001", status:"qualified", stage:"Contacted", owner_name:"AI Bot", score:72, created_at:"2025-08-02T11:00:00Z" },
    { id:"L-003", name:"Carla Singh",  company_name:"HelioSoft",     email:"carla@heliosoft.dev",   phone:"+1-555-000-1002", status:"new",       stage:"Prospect",   owner_name:"AI Bot", score:64, created_at:"2025-08-03T12:00:00Z" },
    { id:"L-004", name:"Diego Ramírez",company_name:"Cobalt Metrics",email:"diego@cobaltmetrics.ai",phone:"+1-555-000-1003", status:"qualified", stage:"Qualified", owner_name:"AI Bot", score:91, created_at:"2025-08-04T13:00:00Z" },
    { id:"L-005", name:"Ella Novak",   company_name:"QuantaGrid",    email:"ella@quantagrid.io",    phone:"+1-555-000-1004", status:"lost",      stage:"Contacted", owner_name:"AI Bot", score:43, created_at:"2025-08-05T14:00:00Z" }
  ],
  total: 5
};

export function installAiProspectMock() {
  if (!ENABLE) return;
  const realFetch = window.fetch ? window.fetch.bind(window) : null;

  // Intercept fetch POST /api/ai/prospect/jobs and return hardcoded data
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || "GET").toUpperCase();
    if (method === "POST" && /\/api\/ai\/prospect\/jobs$/.test(url)) {
      return new Response(JSON.stringify(MOCK), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Mock": "1" },
      });
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("fetch not available"));
  };

  // If your app uses axios too, this also handles it:
  try {
    // dynamic import so this file works even if axios isn't installed
    import("axios").then(({ default: axios }) => {
      axios.interceptors.request.use((config) => {
        const m = (config.method || "get").toLowerCase();
        const u = config.url || "";
        if (m === "post" && /\/api\/ai\/prospect\/jobs$/.test(u)) {
          config.adapter = async () => ({
            data: MOCK, status: 200, statusText: "OK", headers: { "X-Mock": "1" }, config
          });
        }
        return config;
      });
    }).catch(() => {});
  } catch {}

  console.log("[MOCK] AI Prospect mock enabled (frontend)");
}
