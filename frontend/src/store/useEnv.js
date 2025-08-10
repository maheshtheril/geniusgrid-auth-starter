// src/store/useEnv.js
import { create } from "zustand";
import { http } from "@/lib/http";

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
    const { data } = await http.get("bootstrap"); // ← no leading slash
    set({ ...data, ready: true });
    console.log("BOOTSTRAP", {
      user: data.user?.email,
      companies: data.companies?.length,
      menus: data.menus?.length,
      activeCompanyId: data.activeCompanyId
    });
  },

  async setActiveCompany(companyId) {
    await http.get("bootstrap", { headers: { "X-Company-ID": companyId } }); // ← no leading slash
    await get().bootstrap();
  }
}));
