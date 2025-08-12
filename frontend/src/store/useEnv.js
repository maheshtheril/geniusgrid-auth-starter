// src/store/useEnv.js
import { create } from "zustand";
import { http } from "@/lib/http";

// normalize incoming fields and guarantee group + safe shape
function normalizeLeadFields(arr = []) {
  return (Array.isArray(arr) ? arr : []).map((f) => ({
    id: f.id,
    label: f.label ?? f.name ?? "Field",
    key: f.key ?? (f.label || "").toLowerCase().replace(/\s+/g, "_"),
    type: f.type ?? "text",
    group: f.group === "advance" ? "advance" : "general",
    required: !!f.required,
    options: Array.isArray(f.options) ? f.options : [],
  }));
}

export const useEnv = create((set, get) => ({
  /* ===== boot data ===== */
  ready: false,
  user: null,
  tenant: null,
  roles: [],
  permissions: [],
  companies: [],
  activeCompanyId: null,
  menus: [],
  settings: [],
  dashboard: {},

  /* ===== CRM: Lead custom fields ===== */
  // Flat list; group is "general" or "advance"
  leadCustomFields: [],

  // Replace the entire set (e.g., after save/import)
  setLeadCustomFields(items = []) {
    set({ leadCustomFields: normalizeLeadFields(items) });
  },

  // Load from API (tenant/company scoped). Keeps UX snappy on errors.
  async loadLeadCustomFields(entity = "lead") {
    try {
      const { data } = await http.get("crm/custom-fields", {
        params: { entity },
      });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      set({ leadCustomFields: normalizeLeadFields(items) });
    } catch {
      set({ leadCustomFields: [] });
    }
  },

  /* ===== App bootstrap ===== */
  async bootstrap() {
    const { data } = await http.get("bootstrap"); // ← no leading slash
    set({ ...data, ready: true });

    console.log("BOOTSTRAP", {
      user: data.user?.email,
      companies: data.companies?.length,
      menus: data.menus?.length,
      activeCompanyId: data.activeCompanyId,
    });

    // Load lead custom fields right after base data (non-blocking)
    // If you want to block until fields arrive, `await` this.
    get().loadLeadCustomFields().catch(() => {});
  },

  /* ===== Company switch ===== */
  async setActiveCompany(companyId) {
    // hit bootstrap endpoint with company header to switch context server-side
    await http.get("bootstrap", { headers: { "X-Company-ID": companyId } }); // ← no leading slash
    await get().bootstrap();        // refresh base data
    await get().loadLeadCustomFields().catch(() => {}); // refresh fields for the new company
  },
}));
