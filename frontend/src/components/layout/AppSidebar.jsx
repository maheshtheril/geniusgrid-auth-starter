import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* Tiny safe helpers */
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
  return (s === "" || s === "null" || s === "undefined") ? null : String(x).trim();
};
const numOr = (v, d = 999999) => (Number.isFinite(+v) ? +v : d);
const byOrderThenLabel = (a, b) => {
  const ao = numOr(a.sort_order);
  const bo = numOr(b.sort_order);
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* Normalize once */
function normalize(items) {
  return (items || []).map(raw => ({
    id: first(raw.id, raw.ID),
    code: first(raw.code, raw.Code),
    label: first(raw.label, raw.Label) || "",
    path: normPath(first(raw.path, raw.Path)),
    icon: first(raw.icon, raw.Icon) ?? null,
    parent_id: cleanParent(first(raw.parent_id, raw.parentId, raw.parentID)),
    module_code: first(raw.module_code, raw.moduleCode) ?? null,
    sort_order: first(raw.sort_order, raw.sortOrder) ?? null,
  }));
}

/* Build simple parent->children mapping (no recursion) */
function computeParentsAndChildren(items) {
  const rows = normalize(items);
  const byId = new Map(rows.map(r => [r.id, r]));
  const childrenByParent = new Map();
  rows.forEach(r => childrenByParent.set(r.id, []));
  rows.forEach(r => {
    if (r.parent_id && byId.has(r.parent_id)) {
      childrenByParent.get(r.parent_id).push(r);
    }
  });

  // parent if parent_id is null OR parent not present in payload (covers deleted “Main”)
  const idSet = new Set(rows.map(r => r.id));
  const parents = rows.filter(r => !r.parent_id || !idSet.has(r.parent_id));
  parents.sort(byOrderThenLabel);
  parents.forEach(p => childrenByParent.get(p.id).sort(byOrderThenLabel));

  // hide literal "Main"
  const filteredParents = parents.filter(p => (p.label || p.code || "").trim().toLowerCase() !== "main");
  return { parents: filteredParents, childrenByParent };
}

export default function AppSidebar() {
  const { menus = [], branding, ready } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const { parents, childrenByParent } = useMemo(
    () => computeParentsAndChildren(menus),
    [menus]
  );

  // Debug once
  useEffect(() => {
    console.group("[Sidebar] payload");
    console.table((menus || []).map(m => ({
      id: m.id, code: m.code, label: m.label, path: m.path, parent_id: m.parent_id, sort: m.sort_order
    })));
    console.groupEnd();

    console.group("[Sidebar] parents");
    console.table(parents.map(p => ({
      id: p.id, label: p.label, path: p.path, kids: (childrenByParent.get(p.id) || []).length
    })));
    console.groupEnd();
  }, [menus, parents, childrenByParent]);

  // Keep active link in view
  useEffect(() => {
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      const delta = eTop - cTop - 120;
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + delta, behavior: "smooth" });
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
        {!ready ? (
          <div className="text-xs text-gray-400 px-3 py-2">Loading…</div>
        ) : parents.length === 0 ? (
          <div className="text-xs text-red-300 bg-red-950/30 p-2 rounded">
            No parent menus computed. Check console tables for payload.
          </div>
        ) : null}

        {parents.map((p) => (
          <div key={p.id} className="mb-2">
            {/* Parent row (clickable if it has a path) */}
            {p.path ? (
              <NavLink
                to={p.path}
                end
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                    isActive ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-800/50",
                  ].join(" ")
                }
              >
                {p.icon ? <span className="w-4 h-4">{p.icon}</span> : <span className="w-4 h-4" />}
                <span className="truncate">{p.label || p.code}</span>
              </NavLink>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 bg-gray-800/30">
                {p.icon ? <span className="w-4 h-4">{p.icon}</span> : <span className="w-4 h-4" />}
                <span className="truncate">{p.label || p.code}</span>
              </div>
            )}

            {/* Direct children list */}
            <div className="mt-1 space-y-1">
              {(childrenByParent.get(p.id) || []).map((c) => (
                <NavLink
                  key={c.id}
                  to={c.path || "#"}
                  end
                  className={({ isActive }) =>
                    [
                      "ml-3 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                      isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800/40",
                    ].join(" ")
                  }
                >
                  <span className="w-3 h-3" />
                  <span className="truncate">{c.label || c.code}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
