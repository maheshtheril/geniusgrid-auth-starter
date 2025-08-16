// src/components/layout/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* tiny safe helpers */
const first = (...xs) => xs.find(v => v !== undefined && v !== null);
const normPath = (p) => {
  const v = first(p);
  if (v == null) return null;
  const s = String(v).trim();
  return s ? (s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s) : null;
};
const isNullishOrEmpty = (v) => v === null || v === undefined || String(v).trim() === "";
const byOrderThenLabel = (a, b) => {
  const ao = Number.isFinite(+a.sort_order) ? +a.sort_order : 999999;
  const bo = Number.isFinite(+b.sort_order) ? +b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* parents only: parent_id is null/empty/missing */
function computeParents(items) {
  const rows = (items || []).map(raw => ({
    id: first(raw.id, raw.ID),
    code: first(raw.code, raw.Code),
    label: first(raw.label, raw.Label, raw.name, raw.Name) || "",
    path: normPath(first(raw.path, raw.Path)),
    icon: first(raw.icon, raw.Icon) ?? null,
    parent_id: first(raw.parent_id, raw.parentId, raw.parentID),
    sort_order: first(raw.sort_order, raw.sortOrder),
  }));
  const parents = rows.filter(r => isNullishOrEmpty(r.parent_id));
  parents.sort(byOrderThenLabel);
  return parents.filter(p => (p.label || p.code || "").trim().toLowerCase() !== "main");
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const parents = useMemo(() => computeParents(menus), [menus]);

  // scroll active into view (in case a parent has a path)
  useEffect(() => {
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollTop + (eTop - cTop - 120),
        behavior: "smooth",
      });
    }
  }, [loc.pathname]);

  // debug once
  useEffect(() => {
    console.groupCollapsed("[Sidebar] parents-only");
    console.table(parents.map(p => ({ id: p.id, label: p.label, code: p.code, path: p.path })));
    console.groupEnd();
  }, [parents]);

  return (
    <aside
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: "16rem", minWidth: "16rem" }}
    >
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        {parents.length === 0 && (
          <div className="text-xs text-red-300 bg-red-950/30 p-2 rounded">
            No parents found. Ensure Admin/CRM rows have <code>parent_id</code> NULL/empty in the payload.
          </div>
        )}

        {parents.map(node => (
          <NavLink
            key={node.id}
            to={node.path || "#"}
            end
            className={({ isActive }) =>
              [
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-800/50",
                isActive ? "bg-gray-800 text-white" : "text-gray-200",
              ].join(" ")
            }
          >
            {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
            <span className="truncate">{node.label || node.code}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
