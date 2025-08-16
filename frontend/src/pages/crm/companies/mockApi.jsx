export const COMPANIES = [
  { id: "acme", name: "Acme Pvt Ltd", domain: "acme.example", industry: "Software", owner: "Aisha", city: "Mumbai", country: "IN" },
  { id: "abc", name: "ABC Corp", domain: "abc.com", industry: "Retail", owner: "Priya", city: "Bengaluru", country: "IN" },
];

export const COMPANY_CONTACTS = { acme: [], abc: [] };
export const COMPANY_DEALS = { acme: [], abc: [] };
export const COMPANY_ACTIVITY = { acme: [], abc: [] };

export async function getCompany(id) {
  return COMPANIES.find((c) => c.id === id) || null;
}
export async function listCompanyContacts(id) { return (COMPANY_CONTACTS[id] || []).slice(); }
export async function listCompanyDeals(id) { return (COMPANY_DEALS[id] || []).slice(); }
export async function listCompanyActivity(id) {
  return (COMPANY_ACTIVITY[id] || []).slice().sort((a, b) => (a.ts > b.ts ? -1 : 1));
}
export async function addCompanyNote(id, payload) {
  const note = {
    id: Math.random().toString(36).slice(2, 8),
    ts: new Date().toISOString().slice(0, 16).replace("T", " "),
    kind: "note",
    by: payload.by || "You",
    text: payload.text || "",
  };
  COMPANY_ACTIVITY[id] = [note, ...(COMPANY_ACTIVITY[id] || [])];
  return note;
}
export async function createCompany(payload = {}) {
  const slugBase = (payload.id || payload.name || "new")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  let id = slugBase || "company";
  let n = 1;
  while (COMPANIES.some((c) => c.id === id)) id = `${slugBase}-${n++}`;

  const row = {
    id,
    name: payload.name || "Untitled Company",
    domain: payload.domain || "",
    industry: payload.industry || "",
    owner: payload.owner || "",
    city: payload.city || "",
    country: payload.country || "",
  };
  COMPANIES.unshift(row);
  COMPANY_CONTACTS[id] = [];
  COMPANY_DEALS[id] = [];
  COMPANY_ACTIVITY[id] = [];
  return row;
}
