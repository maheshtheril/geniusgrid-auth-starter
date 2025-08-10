// src/layouts/ProtectedShell.jsx
import ProtectedLayout from "./ProtectedLayout";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import { Outlet } from "react-router-dom";

export default function ProtectedShell() {
  return (
    <ProtectedLayout>
      <div className="app-shell">
        <AppSidebar />
        <main className="app-main">
          <AppTopbar />
          <div className="app-content">
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}
