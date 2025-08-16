import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- helpers ---------- */
const normPath = (p) => {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const byOrderThenName = (a, b) => {
  const ao = Number.isFinite(a.sort_order) ? a.sort_order : 999999;
  const bo = Number.isFinite(b.sort_order) ? b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || a.name || "").localeCompare(
    String(b.label || b.name || ""), undefined, { sensitivity: "base" }
  );
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

  // attach strictly by parent_id; missing parent => root
  const roots = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) {
      children.get(n.parent_id).push(n);
    } else {
      roots.push(n);
    }
  });

  const sortRec = (node) => {
    const kids = children.get(node.id) || [];
    kids.sort(byOrderThenName);
    return { ...node, children: kids.map(sortRec) };
  };

  roots.sort(byOrderThenName);
  let tree = roots.map(sortRec);

  // ---- HARD RULES ----
  // 1) Remove any root named "Main" (any case), regardless of path, and lift its children.
  const flattened = [];
  for (const r of tree) {
    const nm = String(r.name || r.code || "").trim().toLowerCase();
    if (nm === "main") {
      (r.children || []).forEach((c) => flattened.push(c));
    } else {
      flattened.push(r);
    }
  }

  // 2) Ensure root nodes act as parents visually (we'll ignore their path when rendering)
  return flattened;
}

/* tiny chevrons */
const ChevronRight = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M9 18l6-6-6-6"/></svg>
);
const ChevronDown = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M6 9l6 6 6-6"/></svg>
);

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  useEffect(() => {
    console.groupCollapsed("[AppSidebar] MENUS payload");
    console.table((menus || []).map(m => ({
      id: m.id, code: m.code, name: m.label || m.name, path: m.path,
      parent_id: m.parent_id, module: m.module_code, sort: m.sort_order
    })));
    console.groupEnd();
  }, [menus]);

  const roots = useMemo(() => {
    const tree = buildTreeDbFirst(menus || []);
    console.groupCollapsed("[AppSidebar] ROOTS (post-rules)");
    console.table(tree.map(r => ({
      id: r.id, name: r.name, path: r.path, children: r.children?.length || 0
    })));
    console.groupEnd();
    return tree;
  }, [menus]);

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

  /* ---------- node renderer with expand/collapse ---------- */
  function SidebarNode({ node, depth = 0, forceHeader = false }) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    // ROOTS are always headers (ignore path). Roots open; deeper nodes closed.
    const isRoot = depth === 0;
    const asHeader = forceHeader || isRoot || !node.path;
    const [open, setOpen] = useState(isRoot ? true : false);

    const label = node.name || node.code;
    const pad = depth > 0 ? "ml-3" : "";

    const headerBase = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm select-none";

    if (asHeader) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => hasChildren && setOpen(v => !v)}
            className={[headerBase, "text-gray-300 hover:bg-gray-800/50 transition w-full text-left", pad].join(" ")}
          >
            {hasChildren ? (open ? <ChevronDown className="w-3.5 h-3.5 opacity-70"/> : <ChevronRight className="w-3.5 h-3.5 opacity-70"/>) : <span className="w-3.5 h-3.5" />}
            <span className="truncate">{label}</span>
          </button>
          {hasChildren && open && (
            <div className="mt-1 space-y-1">
              {node.children.map(c => <SidebarNode key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    // leaf or linkable non-root
    return (
      <div className="group" key={node.id}>
        <NavLink
          to={node.path}
          end
          className={({ isActive }) =>
            [
              headerBase,
              "hover:bg-gray-800/50 transition",
              isActive ? "bg-gray-800 text-white" : "text-gray-200",
              pad
            ].join(" ")
          }
        >
          {hasChildren ? (open ? <ChevronDown className="w-3.5 h-3.5 opacity-70"/> : <ChevronRight className="w-3.5 h-3.5 opacity-70"/>) : <span className="w-3.5 h-3.5" />}
          <span className="truncate">{label}</span>
        </NavLink>
        {hasChildren && open && (
          <div className="mt-1 space-y-1">
            {node.children.map(c => <SidebarNode key={c.id} node={c} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  }

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
        {/* EXACT roots from DB. "Main" is flattened; roots are headers with arrows. */}
        {roots.map((root) => (
          <SidebarNode key={root.id} node={root} />
        ))}
      </div>
    </aside>
  );
}
