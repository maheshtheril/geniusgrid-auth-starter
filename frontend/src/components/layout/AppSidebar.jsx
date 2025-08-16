// src/components/layout/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- helpers ---------- */
const first = (...vals) => vals.find(v => v !== undefined && v !== null);
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
  const s = String(x).trim();
  return s === "" || s.toLowerCase() === "null" ? null : x;
};
const toNum = (v) => (Number.isFinite(+v) ? +v : null);
const byOrderThenLabel = (a, b) => {
  const ao = a.sort_order ?? 999999;
  const bo = b.sort_order ?? 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/** Get ONLY parent/root menus from the payload.
 *  Root means: parent_id is NULL/empty OR the parent isn't present in the payload (e.g., old "Main").
 */
function getParentsOnly(items) {
  const rows = (items || []).map((raw) => ({
    id: first(raw.id, raw.ID),
    code: first(raw.code, raw.Code),
    label: first(raw.label, raw.Label) || "",
    path: normPath(first(raw.path, raw.Path)),
    icon: first(raw.icon, raw.Icon) ?? null,
    parent_id: toNull(first(raw.parent_id, raw.parentId, raw.parentID)),
    module_code: first(raw.module_code, raw.moduleCode) ?? null,
    sort_order: toNum(first(raw.sort_order, raw.sortOrder)),
  }));

  const idSet = new Set(rows.map((r) => r.id));
  const roots = rows.filter((r) => r.parent_id === null || !idSet.has(r.parent_id));

  // Drop literal "Main" if it exists
  const filtered = roots.filter(
    (r) => (r.label || r.code || "").trim().toLowerCase() !== "main"
  );

  filtered.sort(byOrderThenLabel);
  return filtered;
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const parents = useMemo(() => getParentsOnly(menus), [menus]);

  // Keep active link in view (if a parent has a path and is active)
  useEffect(() => {
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      const delta = eTop - cTop - 120;
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollTop + delta,
        behavior: "smooth",
      });
    }
  }, [loc.pathname]);

  // Lock width so global styles can’t collapse it to icons-only
  const fixedWidth = "16rem";

  return (
    <aside
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: fixedWidth, minWidth: fixedWidth, maxWidth: fixedWidth }}
    >
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">
          {branding?.appName || "GeniusGrid"}
        </div>
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
            {/* Optional DB icon (emoji/string) */}
            {node.icon ? (
              <span className="w-4 h-4">{node.icon}</span>
            ) : (
              <span className="w-4 h-4" />
            )}
            <span className="truncate">{node.label || node.code}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
