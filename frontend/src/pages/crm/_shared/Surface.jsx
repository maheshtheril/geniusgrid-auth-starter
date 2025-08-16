import React from "react";
import { NavLink } from "react-router-dom";

export function Panel({ className = "", children }) {
  return <div className={`gg-panel p-3 md:p-4 ${className}`}>{children}</div>;
}

export function PillTabs({ items }) {
  return (
    <div className="gg-tabs">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) => `gg-tab ${isActive ? "is-active" : ""}`}
          aria-current={({ isActive }) => (isActive ? "page" : undefined)}
        >
          {it.label}
        </NavLink>
      ))}
    </div>
  );
}

export function Toolbar({ onSearch, onFilter, onExport, onNew }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div />
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder="Search…"
            className="h-9 pl-3 pr-3 rounded-lg border border-white/10 bg-[#0f1217]/70"
          />
        </div>
        {onFilter && <button className="gg-btn" onClick={onFilter}>Filters</button>}
        {onExport && <button className="gg-btn" onClick={onExport}>Export</button>}
        {onNew && <button className="gg-btn gg-btn--primary" onClick={onNew}>New</button>}
      </div>
    </div>
  );
}

export function StatusBadge({ status = "Active" }) {
  const m = {
    Active: "gg-badge gg-badge--active",
    Draft: "gg-badge gg-badge--draft",
    Archived: "gg-badge gg-badge--archived",
  };
  return <span className={m[status] || "gg-badge"}>{status}</span>;
}
