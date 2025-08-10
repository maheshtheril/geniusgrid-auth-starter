// src/layouts/ProtectedShell.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProtectedLayout from "./ProtectedLayout";
import TenantSidebar from "@/components/layout/TenantSidebar";
import Topbar from "@/components/layout/Topbar";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { Outlet } from "react-router-dom";

export default function ProtectedShell() {
  const [showMobile, setShowMobile] = useState(false);

  return (
    <ProtectedLayout>
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 flex">
        {/* Desktop sidebar */}
        <TenantSidebar onNavigate={() => setShowMobile(false)} />

        {/* Mobile drawer */}
        <AnimatePresence>
          {showMobile && (
            <>
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "tween", duration: 0.2 }}
                className="fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 border-r border-white/10 p-3 md:hidden"
              >
                <TenantSidebar onNavigate={() => setShowMobile(false)} />
              </motion.aside>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black md:hidden"
                onClick={() => setShowMobile(false)}
              />
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <Topbar onBurger={() => setShowMobile(true)} />
          <div className="p-4">
            <div className="mb-4">
              <CompanySwitcher />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}
