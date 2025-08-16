// src/components/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* helpers */
const normPath = (p) => {
  if (p == null) return null;
  const s = String(p).trim();
  if (!s) return null;
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const toNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "null" ? null : v;
};
const numOr = (v, d = 999999) => (Number.isFinite(+v) ? +v : d);
const byOrderThenLabel = (a, b) => {
  const ao = numOr(a.sort_order);
  const bo = numOr(b.sort_order);
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* get ONLY parent (root) menus */
function getParents(items) {
  const rows = (items || []).map((raw) => ({
    id: raw.id,
    code: raw.code,
    label: raw.label || "",
    path: normPath(raw.path),
    icon: raw.icon ?? null,
    parent_id: toNull(raw.parent_id),
    module_code: raw.module_code ?? null,
    sort_order: raw.sort_order ?? null,
  }));

  const idSet = new Set(rows.map((r) => r.id));
  // root if parent_id is null OR parent not present in this payload
  const parents = rows.filter((r) => !r.parent_id || !idSet.has(r.parent_id));
  parents.sort(byOrderThenLabel);
  // hide any literal "Main"
  return parents.filter((p) => String(p.label).trim().toLowerCase() !== "main");
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const parents = useMemo(() => getParents(menus), [menus]);

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

  // lock width to avoid icon-only collapse
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
        {parents.map((node) => (
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
            {/* optional icon (emoji/string from DB) */}
            {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
            <span className="truncate">{node.label || node.code}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
