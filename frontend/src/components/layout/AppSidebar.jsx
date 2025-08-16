// src/components/layout/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- tiny safe helpers ---------- */
const first = (...xs) => xs.find(v => v !== undefined && v !== null);
const normPath = (p) => {
  const v = first(p);
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const toNull = (v) => {
  const x = first(v);
  if (x === undefined || x === null) return null;
  const s = String(x).trim().toLowerCase();
  return s === "" || s === "null" ? null : x;
};
const numOr = (v, d = 999999) => (Number.isFinite(+v) ? +v : d);
const byOrderThenLabel = (a, b) => {
  const ao = numOr(a.sort_order);
  const bo = numOr(b.sort_order);
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* ---------- compute ONLY parents (roots) ---------- */
function getParentsOnly(items) {
  const rows = (items || []).map(raw => ({
    id: first(raw.id, raw.ID),
    code: first(raw.code, raw.Code),
    label: first(raw.label, raw.Label) || "",
    path: normPath(first(raw.path, raw.Path)),
    icon: first(raw.icon, raw.Icon) ?? null,
    parent_id: toNull(first(raw.parent_id, raw.parentId, raw.parentID)),
    module_code: first(raw.module_code, raw.moduleCode) ?? null,
    sort_order: first(raw.sort_order, raw.sortOrder) ?? null,
  }));

  const idSet = new Set(rows.map(r => r.id));
  // parent if parent_id is null OR parent not present (covers deleted "Main")
  const roots = rows.filter(r => r && (!r.parent_id || !idSet.has(r.parent_id)));

  // hide literal "Main" if it exists
  const filtered = roots.filter(r => (r.label || r.code || "").trim().toLowerCase() !== "main");

  filtered.sort(byOrderThenLabel);
  return filtered;
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const parents = useMemo(() => getParentsOnly(menus), [menus]);

  // Debug: see what's arriving and what we render
  useEffect(() => {
    console.groupCollapsed("[Sidebar] raw menus");
    console.table((menus || []).map(m => ({
      id: m.id, code: m.code, label: m.label, path: m.path, parent_id: m.parent_id, sort: m.sort_order
    })));
    console.groupEnd();

    console.groupCollapsed("[Sidebar] parents computed");
    console.table(parents.map(p => ({
      id: p.id, label: p.label, code: p.code, path: p.path, parent_id: p.parent_id, sort: p.sort_order
    })));
    console.groupEnd();
  }, [menus, parents]);

  // keep active in view
  useEffect(() => {
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      const delta = eTop - cTop - 120;
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + delta, behavior: "smooth" });
    }
  }, [loc.pathname]);

  // lock width so it won’t collapse to icons-only
  const fixedWidth = "16rem";

  return (
    <aside
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: fixedWidth, minWidth: fixedWidth, maxWidth: fixedWidth }}
    >
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2"
        style={{ scrollbarGutter: "stable" }}
      >
        {parents.length === 0 ? (
          <div className="text-xs text-red-300 bg-red-950/30 p-2 rounded">
            No parent menus found. Check that Admin/CRM are in the payload and either have <code>parent_id = null</code> or their parent is not present.
          </div>
        ) : null}

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
