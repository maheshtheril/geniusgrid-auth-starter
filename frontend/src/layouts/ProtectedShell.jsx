// src/layouts/ProtectedShell.jsx
import { Outlet } from "react-router-dom";
import ProtectedLayout from "./ProtectedLayout";
import Sidebar from "@/components/Sidebar";
import CompanySwitcher from "@/components/CompanySwitcher";

export default function ProtectedShell() {
  return (
    <ProtectedLayout>
      <div className="h-screen w-screen flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <header className="border-b p-3 flex items-center gap-3">
            <CompanySwitcher />
            <div className="ml-auto text-sm opacity-70">GeniusGrid</div>
          </header>
          <div className="p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}
