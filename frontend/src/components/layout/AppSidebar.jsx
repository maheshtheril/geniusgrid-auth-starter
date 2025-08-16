// src/components/layout/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* tiny helpers */
const first = (...xs) => xs.find(v => v !== undefined && v !== null);
const normPath = (p) => {
  const v = first(p);
  if (v == null) return null;
  const s = String(v).trim();
  return s ? (s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s) : null;
};
const cleanParent = (v) => {
  const x = first(v);
  if (x === undefined || x === null) return null;
  const s = String(x).trim().toLowerCase();
  return (s === "" || s === "null" || s === "undefined" || s === "n/a") ? null : String(x).trim();
};
const numOr = (v, d = 999999) => (Number.isFinite(+v) ? +v : d);
const byOrderThenLabel = (a, b) => {
  const ao = numOr(a.sort_order);
  const bo = numOr(b.sort_order);
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* PARENTS ONLY:
   - parent_id is null/empty, OR
   - parent_id references an ID not present in payload (orphan => treat as root)
*/
function computeParents(items) {
  const rows = (items || []).map(raw => ({
    id: first(raw.id, raw.ID),
    code: first(raw.code, raw.Code),
    label: first(raw.label, raw.Label) || "",
    path: normPath(first(raw.path, raw.Path)),
    icon: first(raw.icon, raw.Icon) ?? null,
    parent_id: cleanParent(first(raw.parent_id, raw.parentId, raw.parentID)),
    sort_order: first(raw.sort_order, raw.sortOrder),
  }));

  const allIds = new Set(rows.map(r => r.id).filter(Boolean));
  const roots = rows.filter(r => !r.parent_id || !allIds.has(r.parent_id));

  // drop literal "Main" if present
  const filtered = roots.filter(r => (r.label || r.code || "").trim().toLowerCase() !== "main");
  filtered.sort(byOrderThenLabel);
  return filtered;
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const parents = useMemo(() => computeParents(menus), [menus]);

  // Debug exactly what we got vs. what we render
  useEffect(() => {
    console.groupCollapsed("[Sidebar] menus payload");
    console.table((menus || []).map(m => ({
      id: m.id ?? m.ID,
      label: m.label ?? m.Label,
      code: m.code ?? m.Code,
      path: m.path ?? m.Path,
      parent_id: m.parent_id ?? m.parentId ?? m.parentID,
      sort: m.sort_order ?? m.sortOrder
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
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollTop + (eTop - cTop - 120),
        behavior: "smooth",
      });
    }
  }, [loc.pathname]);

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
            No parent menus computed. Check console tables above to see payload vs. parents.
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
