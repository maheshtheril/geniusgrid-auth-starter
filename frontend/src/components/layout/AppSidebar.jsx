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
    String(b.label || b.name || ""),
    undefined,
    { sensitivity: "base" }
  );
};

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
  const tree = roots.map(sortRec);

  // ---- squash transparent "Main" root containers (no path, code/label "Main") ----
  const isTransparentMain = (n) =>
    !n.path &&
    n &&
    typeof (n.name || n.code) === "string" &&
    ["main"].includes(String(n.name || n.code).trim().toLowerCase());

  const flattened = [];
  for (const r of tree) {
    if (isTransparentMain(r)) {
      // lift its children to root
      for (const c of r.children || []) flattened.push(c);
    } else {
      flattened.push(r);
    }
  }
  return flattened;
}

/* simple inline chevrons (no extra deps) */
const ChevronRight = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path fill="currentColor" d="M9 18l6-6-6-6" />
  </svg>
);
const ChevronDown = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path fill="currentColor" d="M6 9l6 6 6-6" />
  </svg>
);

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  useEffect(() => {
    console.groupCollapsed("[AppSidebar] MENUS payload");
    console.table(
      menus?.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.label || m.name,
        path: m.path,
        parent_id: m.parent_id,
        module: m.module_code,
        sort: m.sort_order,
      }))
    );
    console.groupEnd();
  }, [menus]);

  const roots = useMemo(() => {
    const tree = buildTreeDbFirst(menus || []);
    console.groupCollapsed("[AppSidebar] ROOTS after buildTree (DB-first)");
    console.table(
      tree.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        path: r.path,
        parent_id: r.parent_id,
        module: r.module_code,
        sort: r.sort_order,
        children: r.children?.length || 0,
      }))
    );
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
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollTop + delta,
        behavior: "smooth",
      });
    }
  }, [loc.pathname]);

  /* ---------- recursive node with expand/collapse ---------- */
  function SidebarNode({ node, depth = 0 }) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    // roots open by default; deeper nodes closed by default
    const defaultOpen = depth === 0;
    const [open, setOpen] = useState(defaultOpen);

    const label = node.name || node.code;
    const pad = depth > 0 ? "ml-3" : "";

    const headerClasses =
      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm select-none";

    // clickable nav if path; otherwise a toggling header (parent-only)
    const Header = () => {
      if (node.path) {
        return (
          <NavLink
            to={node.path}
            className={({ isActive }) =>
              [
                headerClasses,
                "hover:bg-gray-800/50 transition",
                isActive ? "bg-gray-800 text-white" : "text-gray-200",
                pad,
              ].join(" ")
            }
            end
          >
            {hasChildren ? (
              open ? (
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              )
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
            <span className="truncate">{label}</span>
          </NavLink>
        );
      }
      // parent section (no path): clicking toggles open
      return (
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          className={[
            headerClasses,
            "text-gray-300 hover:bg-gray-800/50 transition w-full text-left",
            pad,
          ].join(" ")}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 opacity-70" />
            )
          ) : (
            <span className="w-3.5 h-3.5" />
          )}
          <span className="truncate">{label}</span>
        </button>
      );
    };

    return (
      <div className="group" key={node.id}>
        <Header />
        {hasChildren && open && (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => (
              <SidebarNode key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col">
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">
          {branding?.appName || "GeniusGrid"}
        </div>
      </div>

      {/* vertical scroll only */}
      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 custom-scroll"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* EXACT roots from DB (Admin, CRM, etc.). Transparent "Main" is flattened. */}
        {roots.map((root) => (
          <SidebarNode key={root.id} node={root} />
        ))}
      </div>
    </aside>
  );
}
