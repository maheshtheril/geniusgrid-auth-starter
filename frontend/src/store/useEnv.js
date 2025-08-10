// src/store/useEnv.js
import { create } from "zustand";
import { http } from "../lib/http";

export const useEnv = create((set, get) => ({
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

  async bootstrap() {
    const { data } = await http.get("/bootstrap");
    set({ ...data, ready: true });
  },

  async setActiveCompany(companyId) {
    await http.get("/bootstrap", { headers: { "X-Company-ID": companyId } });
    await get().bootstrap(); // refresh state with new context
  }
}));