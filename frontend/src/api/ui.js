const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function j(url, opts={}) {
  const res = await fetch(url, { credentials:"include", ...opts });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const uiApi = {
  getTheme: (tenant) =>
    j(`${BASE}/api/ui/theme${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""}`),

  getCrmMetadata: () =>
    j(`${BASE}/api/crm/metadata`), // { stages:[], statuses:[], sources:[], countries:[{cc,code,label}]? }

  getLeadSchema: () =>
    j(`${BASE}/api/crm/leads/schema`), // JSON schema-like (see AddLeadDrawer)
};

export const crmApi = {
  listLeads: (params) =>
    j(`${BASE}/api/crm/leads?` + new URLSearchParams(params).toString()),
  createLead: (payload) =>
    j(`${BASE}/api/crm/leads`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    }),
  createLeadMultipart: (formData) =>
    j(`${BASE}/api/crm/leads`, { method:"POST", body: formData }),
  updateLead: (id, patch) =>
    j(`${BASE}/api/crm/leads/${id}`, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(patch)
    }),
};
