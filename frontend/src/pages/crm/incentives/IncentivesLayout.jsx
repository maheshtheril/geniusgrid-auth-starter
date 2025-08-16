// ---------- FILE: src/pages/crm/incentives/IncentivesLayout.jsx ----------
import React, { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Trophy, Settings2, CircleHelp } from "lucide-react";
import { Panel, PillTabs } from "@/pages/crm/_shared/Surface";

const TABS = [
  { to: "plans",       label: "Plans" },
  { to: "rules",       label: "Rules" },
  { to: "tiers",       label: "Tiers" },
  { to: "programs",    label: "Programs" },
  { to: "payouts",     label: "Payouts" },
  { to: "adjustments", label: "Adjustments" },
  { to: "approvals",   label: "Approvals" },
  { to: "reports",     label: "Reports" },
  { to: "audit",       label: "Audit" },
];

export default function IncentivesLayout() {
  const nav = useNavigate();

  // Keyboard shortcut: Shift+/ (aka "?") opens Help
  useEffect(() => {
    const onKey = (e) => {
      const isQuestionMark = e.key === "?" || (e.shiftKey && e.key === "/");
      if (isQuestionMark) {
        e.preventDefault();
        nav("help");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <Panel>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-2xl grid place-items-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(var(--gg-primary),.2), rgba(var(--gg-accent),.2))",
            }}
          >
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Incentives</h1>
            <p className="text-sm text-muted-foreground">
              Configure plans, rules & tiers; manage payouts with approvals, reports & audit.
            </p>
          </div>

          {/* Right-side actions */}
          <div className="flex-1" />
          <NavLink
            to="help"
            className="gg-btn hidden md:inline-flex"
            title="Incentives Help (Shift + /)"
          >
            <CircleHelp className="h-4 w-4" />
            <span className="ml-1">Help</span>
          </NavLink>
          <NavLink
            to="settings"
            className="gg-btn hidden md:inline-flex"
            title="Incentives Settings"
          >
            <Settings2 className="h-4 w-4" />
            <span className="ml-1">Settings</span>
          </NavLink>
        </div>

        <div className="mt-3">
          <PillTabs items={TABS} />
        </div>
      </Panel>

      {/* Content */}
      <Panel className="p-0">
        <Outlet />
      </Panel>
    </div>
  );
}
