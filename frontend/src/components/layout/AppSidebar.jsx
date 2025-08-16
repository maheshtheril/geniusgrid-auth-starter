import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- tiny helpers ---------- */
const normPath = (p) => {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const byOrderThenName = (a, b) => {
  const ao = Number.isFinite(a.sort_order) ? a.sort_order : 999999;
  const bo = Number.isFinite(b.sort_order) ? b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || a.name || "").localeCompare(String(b.label || b.name || ""), undefined, { sensitivity: "base" });
};

/* ---------- build tree strictly by parent_id ---------- */
function buildTreeDbFirst(items) {
  const byId = new Map();
  const children = new Map();
  (items || []).forEach((raw) => {
    const n = {
      id: raw.id,
      code: raw.code,
      name: raw.label || raw.name || "",
      path: normPath(raw.path || ""),
      icon: raw.icon || null,
      parent_id: raw.parent_id || null,
      module_code: raw.module_code || null,
      sort_order: raw.sort_order ?? null,
    };
    byId.set(n.id, n);
    children.set(n.id, []);
  });

  // Attach strictly by parent_id. Orphans (parent not found) are treated as roots.
  const roots = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) {
      children.get(n.parent_id).push(n);
    } else {
      roots.push(n);
    }
  });

  // Sort depth-first
  const sortRec = (node) => {
    const kids = children.get(node.id) || [];
    kids.sort(byOrderThenName);
    return { ...node, children: kids.map(sortRec) };
  };
  roots.sort(byOrderThenName);
  return roots.map(sortRec);
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  // Debug logs to verify raw menus and roots
  useEffect(() => {
    // IMPORTANT: one-time snapshot after initial load (and when menus change)
    // These logs validate that Admin + CRM are actually present in the payload.
    // Expect each item to have id, code, label/name, path, icon, parent_id, module_code, sort_order.
    // If not, the issue is upstream (API / DB join).
    console.groupCollapsed("[AppSidebar] MENUS payload");
    console.table(menus?.map(m => ({
      id: m.id, code: m.code, name: m.label || m.name, path: m.path,
      parent_id: m.parent_id, module: m.module_code, sort: m.sort_order
    })));
    console.groupEnd();
  }, [menus]);

  const roots = useMemo(() => {
    const tree = buildTreeDbFirst(menus || []);
    console.groupCollapsed("[AppSidebar] ROOTS after buildTree (DB-first)");
    console.table(tree.map(r => ({
      id: r.id, code: r.code, name: r.name, path: r.path,
      parent_id: r.parent_id, module: r.module_code, sort: r.sort_order,
      children: r.children?.length || 0
    })));
    console.groupEnd();
    return tree;
  }, [menus]);

  // Keep active item in view when route changes
  useEffect(() => {
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      const delta = eTop - cTop - 120; // offset
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + delta, behavior: "smooth" });
    }
  }, [loc.pathname]);

  const renderNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const label = node.name || node.code;

    return (
      <div key={node.id} className="group">
        {node.path ? (
          <NavLink
            to={node.path}
            className={({ isActive }) =>
              [
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                "hover:bg-gray-800/50 transition",
                isActive ? "bg-gray-800 text-white" : "text-gray-200",
                depth > 0 ? "ml-3" : ""
              ].join(" ")
            }
            end
          >
            {/* Icon left (optional, from DB string, you can map to lucide if needed) */}
            {node.icon ? <span className="w-4 h-4 opacity-80">{/* icon render if you have a mapper */}</span> : null}
            <span className="truncate">{label}</span>
          </NavLink>
        ) : (
          <div className={["px-3 py-2 text-xs uppercase tracking-wide text-gray-400", depth > 0 ? "ml-3" : ""].join(" ")}>
            {label}
          </div>
        )}

        {hasChildren && (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 shrink-0 bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col">
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      {/* vertical scroll only */}
      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 custom-scroll"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* NO synthetic "Main". We render EXACTLY roots from DB: Admin, CRM, etc. */}
        {roots.map((root) => renderNode(root))}
      </div>
    </aside>
  );
}
