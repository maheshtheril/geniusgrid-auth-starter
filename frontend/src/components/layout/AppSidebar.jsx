// src/components/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ---- config ---- */
const ARROW_SIZE = 20;

/* ---- helpers ---- */
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

/* ---- build strictly by parent_id (NO filtering of roots) ---- */
function buildTree(items) {
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

  const byId = new Map();
  const kids = new Map();
  rows.forEach((n) => {
    if (!n.id) return;
    byId.set(n.id, n);
    kids.set(n.id, []);
  });

  const roots = [];
  byId.forEach((n) => {
    const pid = n.parent_id;
    if (pid && byId.has(pid)) kids.get(pid).push(n);
    else roots.push(n);
  });

  const sortRec = (node) => {
    const childList = kids.get(node.id) || [];
    childList.sort(byOrderThenLabel);
    return { ...node, children: childList.map(sortRec) };
  };

  roots.sort(byOrderThenLabel);
  return roots.map(sortRec); // Admin & CRM stay as top-level parents
}

/* ---- visuals ---- */
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
const ArrowPlaceholder = () => (
  <span style={{ width: ARROW_SIZE, height: ARROW_SIZE, display: "inline-block" }} />
);

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const roots = useMemo(() => buildTree(menus), [menus]);

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
    const [open, setOpen] = useState(isRoot); // ROOTS open by default
    const pad = depth > 0 ? "ml-3" : "";

    // ROOTS render as headers (non-link) so Admin/CRM show as main nodes
    if (isRoot) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => hasChildren && setOpen(v => !v)}
            className={["flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800/50 w-full text-left", pad].join(" ")}
            aria-expanded={open}
          >
            {hasChildren ? <Arrow open={open} /> : <ArrowPlaceholder />}
            <span className="truncate">{node.label || node.code}</span>
          </button>
          {hasChildren && open && (
            <div className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    // Non-root with a path: clickable link (submenu)
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
            <ArrowPlaceholder />
            <span className="truncate">{node.label || node.code}</span>
          </NavLink>
          {hasChildren && (
            <div className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    // Non-root without path: header subgroup
    return (
      <div className="group" key={node.id}>
        <button
          type="button"
          onClick={() => hasChildren && setOpen(v => !v)}
          className={["flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800/50 w-full text-left", pad].join(" ")}
          aria-expanded={open}
        >
          {hasChildren ? <Arrow open={open} /> : <ArrowPlaceholder />}
          <span className="truncate">{node.label || node.code}</span>
        </button>
        {hasChildren && open && (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  }

  // lock width so it can't collapse to icons-only
  const fixedWidth = "16rem";

  return (
    <aside
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: fixedWidth, minWidth: fixedWidth, maxWidth: fixedWidth }}
    >
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2" style={{ scrollbarGutter: "stable" }}>
        {roots.map((root) => <Node key={root.id} node={root} />)}
      </div>
    </aside>
  );
}
