// src/components/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- arrow size ---------- */
const ARROW_SIZE = 24;

/* ---------- helpers ---------- */
const normPath = (p) => {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const byOrderThenLabel = (a, b) => {
  const ao = Number.isFinite(a.sort_order) ? a.sort_order : 999999;
  const bo = Number.isFinite(b.sort_order) ? b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* ---------- build tree strictly by parent_id ---------- */
function buildTree(items) {
  const byId = new Map();
  const children = new Map();

  (items || []).forEach((raw) => {
    const n = {
      id: raw.id,
      code: raw.code,
      label: raw.label || "",
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
    if (n.parent_id && byId.has(n.parent_id)) children.get(n.parent_id).push(n);
    else roots.push(n);
  });

  const sortRec = (node) => {
    const kids = children.get(node.id) || [];
    kids.sort(byOrderThenLabel);
    return { ...node, children: kids.map(sortRec) };
  };

  roots.sort(byOrderThenLabel);
  return roots
    .filter((r) => String(r.label).trim().toLowerCase() !== "main")
    .map(sortRec);
}

/* ---------- visuals ---------- */
function Arrow({ open, size = ARROW_SIZE, className = "opacity-80" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden>
      <path
        d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Placeholder() {
  return <span style={{ width: ARROW_SIZE, height: ARROW_SIZE, display: "inline-block" }} />;
}

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const roots = useMemo(() => buildTree(menus || []), [menus]);

  // keep active link in view
  useEffect(() => {
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      const delta = eTop - cTop - 120;
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + delta, behavior: "smooth" });
    }
  }, [loc.pathname]);

  function Node({ node, depth = 0 }) {
    const hasChildren = node.children?.length > 0;
    const isRoot = depth === 0;
    const [open, setOpen] = useState(isRoot); // roots open by default
    const pad = depth > 0 ? "ml-3" : "";

    if (isRoot) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => hasChildren && setOpen((v) => !v)}
            className={["flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800/50 w-full text-left", pad].join(" ")}
            aria-expanded={open}
          >
            {hasChildren ? <Arrow open={open} /> : <Placeholder />}
            <span className="gg-nav-text truncate">{node.label || node.code}</span>
          </button>
          {hasChildren && open && (
            <div className="mt-1 space-y-1">
              {node.children.map((c) => (
                <Node key={c.id} node={c} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (node.path) {
      return (
        <div key={node.id}>
          <NavLink
            to={node.path}
            end
            className={({ isActive }) =>
              [
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-800/50",
                isActive ? "bg-gray-800 text-white" : "text-gray-200",
                pad,
              ].join(" ")
            }
          >
            <Placeholder />
            <span className="gg-nav-text truncate">{node.label || node.code}</span>
          </NavLink>
          {hasChildren && (
            <div className="mt-1 space-y-1">
              {node.children.map((c) => (
                <Node key={c.id} node={c} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="group" key={node.id}>
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          className={["flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800/50 w-full text-left", pad].join(" ")}
          aria-expanded={open}
        >
          {hasChildren ? <Arrow open={open} /> : <Placeholder />}
          <span className="gg-nav-text truncate">{node.label || node.code}</span>
        </button>
        {hasChildren && open && (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => (
              <Node key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const fixedWidth = "16rem";

  return (
    <aside
      data-gg-sidebar
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: fixedWidth, minWidth: fixedWidth, maxWidth: fixedWidth }}
    >
      {/* Force labels visible even if a global 'collapsed' style exists */}
      <style>{`
        [data-gg-sidebar] .gg-nav-text{
          display:inline !important;
          opacity:1 !important;
          visibility:visible !important;
          color:inherit !important;
          width:auto !important;
          max-width:none !important;
          white-space:nowrap !important;
          font-size:0.875rem !important;
          overflow:visible !important;
        }
        [data-gg-sidebar]{ width:${fixedWidth} !important; min-width:${fixedWidth} !important; }
      `}</style>

      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2"
        style={{ scrollbarGutter: "stable" }}
      >
        {roots.map((root) => (
          <Node key={root.id} node={root} />
        ))}
      </div>
    </aside>
  );
}
