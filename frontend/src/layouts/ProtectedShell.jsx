// -----------------------------------------------
// src/layouts/ProtectedShell.jsx (updated layout)
// -----------------------------------------------
import { Outlet } from "react-router-dom";
import ProtectedLayout from "./ProtectedLayout";
import Sidebar from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { CompanySwitcher } from "@/components/CompanySwitcher";

export default function ProtectedShell() {
  return (
    <ProtectedLayout>
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Topbar />
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <CompanySwitcher />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}
