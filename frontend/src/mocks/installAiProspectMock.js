// Toggle with Vite env var (or just set to true)
const ENABLE_MOCK = import.meta?.env?.VITE_MOCK_AI === "1" || true;

// A tiny, hardcoded payload the UI can consume directly
const MOCK_RESPONSE = {
  ok: true,
  jobId: "mock-job-1",
  status: "completed",
  items: [
    {
      id: "L-001", name: "Alice Carter", company_name: "Orbitix Labs",
      email: "alice@orbitixlabs.io", phone: "+1-555-000-1000",
      status: "new", stage: "Prospect", owner_name: "AI Bot",
      score: 86, created_at: "2025-08-01T10:00:00Z"
    },
    {
      id: "L-002", name: "Brian Chen", company_name: "Neon Freight",
      email: "brian@neonfreight.com", phone: "+1-555-000-1001",
      status: "qualified", stage: "Contacted", owner_name: "AI Bot",
      score: 72, created_at: "2025-08-02T11:00:00Z"
    },
    {
      id: "L-003", name: "Carla Singh", company_name: "HelioSoft",
      email: "carla@heliosoft.dev", phone: "+1-555-000-1002",
      status: "new", stage: "Prospect", owner_name: "AI Bot",
      score: 64, created_at: "2025-08-03T12:00:00Z"
    },
    {
      id: "L-004", name: "Diego Ramírez", company_name: "Cobalt Metrics",
      email: "diego@cobaltmetrics.ai", phone: "+1-555-000-1003",
      status: "qualified", stage: "Qualified", owner_name: "AI Bot",
      score: 91, created_at: "2025-08-04T13:00:00Z"
    },
    {
      id: "L-005", name: "Ella Novak", company_name: "QuantaGrid",
      email: "ella@quantagrid.io", phone: "+1-555-000-1004",
      status: "lost", stage: "Contacted", owner_name: "AI Bot",
      score: 43, created_at: "2025-08-05T14:00:00Z"
    },
    {
      id: "L-006", name: "Farid Khan", company_name: "Nimbus Ops",
      email: "farid@nimbusops.com", phone: "+1-555-000-1005",
      status: "new", stage: "Prospect", owner_name: "AI Bot",
      score: 58, created_at: "2025-08-05T15:00:00Z"
    },
    {
      id: "L-007", name: "Grace Lin", company_name: "VectorForge",
      email: "grace@vectorforge.app", phone: "+1-555-000-1006",
      status: "qualified", stage: "Qualified", owner_name: "AI Bot",
      score: 79, created_at: "2025-08-06T09:30:00Z"
    },
    {
      id: "L-008", name: "Hiro Tanaka", company_name: "Skyward Robotics",
      email: "hiro@skyward.ai", phone: "+1-555-000-1007",
      status: "won", stage: "Won", owner_name: "AI Bot",
      score: 95, created_at: "2025-08-07T16:20:00Z"
    },
    {
      id: "L-009", name: "Isla O’Neill", company_name: "GreenPulse",
      email: "isla@greenpulse.io", phone: "+1-555-000-1008",
      status: "new", stage: "Prospect", owner_name: "AI Bot",
      score: 54, created_at: "2025-08-08T10:45:00Z"
    },
    {
      id: "L-010", name: "Jamal Wright", company_name: "Nova Supply",
      email: "jamal@novasupply.co", phone: "+1-555-000-1009",
      status: "qualified", stage: "Contacted", owner_name: "AI Bot",
      score: 68, created_at: "2025-08-09T18:05:00Z"
    }
  ],
  total: 10
};

export function installAiProspectMock() {
  if (!ENABLE_MOCK) return;

  // Works no matter how you call HTTP: intercept fetch()
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || "GET").toUpperCase();

    if (method === "POST" && /\/api\/ai\/prospect\/jobs$/.test(url)) {
      // pretend the server responded
      return new Response(JSON.stringify(MOCK_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Mock": "1" }
      });
    }

    return realFetch(input, init);
  };

  // If you use axios too, uncomment to be extra-safe:
  /*
  import("axios").then(({ default: axios }) => {
    axios.interceptors.request.use((config) => {
      const m = (config.method || "get").toLowerCase();
      const u = config.url || "";
      if (m === "post" && /\/api\/ai\/prospect\/jobs$/.test(u)) {
        config.adapter = async () => ({
          data: MOCK_RESPONSE, status: 200, statusText: "OK",
          headers: { "X-Mock": "1" }, config
        });
      }
      return config;
    });
  });
  */

  console.log("[MOCK] Frontend AI prospect mock enabled");
}
