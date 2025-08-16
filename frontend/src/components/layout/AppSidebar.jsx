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
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : v;
};
const toNum = (v) => (Number.isFinite(+v) ? +v : null);
const byOrderThenLabel = (a, b) => {
  const ao = a.sort_order ?? 999999;
  const bo = b.sort_order ?? 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* ONLY PARENTS (roots) — parent is strictly NULL/empty */
function getParentsOnly(items) {
  const rows = (items || []).map((raw) => ({
    id: raw.id ?? raw.ID,
    code: raw.code ?? raw.Code,
    label: raw.label ?? raw.Label ?? "",
    path: normPath(raw.path ?? raw Path),
    icon: raw.icon ?? raw.Icon ?? null,
    parent_id: toNull(raw.parent_id ?? raw.parentId ?? raw.parentID),
    module_code: raw.module_code ?? raw.moduleCode ?? null,
    sort_order: toNum(raw.sort_order ?? raw.sortOrder),
  }));

  // Strict roots: parent_id must be NULL/empty
  const roots = rows.filter((r) => r.parent_id === null);

  // Optional: drop any literal "Main"
  const filtered = roots.filter(
    (r) => (r.code || "").toLowerCase() !== "main" && (r.label || "").toLowerCase() !== "main"
  );

  filtered.sort(byOrderThenLabel);
  return filtered;
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const parents = useMemo(() => getParentsOnly(menus), [menus]);

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

  const fixedWidth = "16rem";

  return (
    <aside
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: fixedWidth, minWidth: fixedWidth, maxWidth: fixedWidth }}
    >
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
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
            {/* optional DB icon (emoji/string) */}
            {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
            <span className="truncate">{node.label || node.code}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
