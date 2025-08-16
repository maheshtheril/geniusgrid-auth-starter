import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- size: tweak this to change arrow size everywhere ---------- */
const ARROW_PX = 18;

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
  // hard-remove any root literally labeled "Main"
  return roots.filter(r => String(r.label).trim().toLowerCase() !== "main").map(sortRec);
}

/* inline chevrons (bigger by ARROW_PX) */
const ChevronRight = ({ size = ARROW_PX, className = "opacity-70" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
    <path fill="currentColor" d="M9 18l6-6-6-6" />
  </svg>
);
const ChevronDown = ({ size = ARROW_PX, className = "opacity-70" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
    <path fill="currentColor" d="M6 9l6 6 6-6" />
  </svg>
);

export default function AppSidebar() {
  const { menus = [], branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const roots = useMemo(() => buildTree(menus || []), [menus]);

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

  function Placeholder() {
    return <span style={{ width: ARROW_PX, height: ARROW_PX, display: "inline-block" }} />;
  }

  function Node({ node, depth = 0 }) {
    const hasChildren = node.children?.length > 0;
    const isRoot = depth === 0;
    const [open, setOpen] = useState(isRoot); // roots open by default
    const pad = depth > 0 ? "ml-3" : "";

    // ROOT: header (non-link)
    if (isRoot) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => hasChildren && setOpen(v => !v)}
            className={["flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800/50 w-full text-left", pad].join(" ")}
            aria-expanded={open}
          >
            {hasChildren ? (open ? <ChevronDown /> : <ChevronRight />) : <Placeholder />}
            <span className="truncate">{node.label}</span>
          </button>
          {hasChildren && open && (
            <div className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    // Non-root with a path: clickable link
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
            <span className="truncate">{node.label}</span>
          </NavLink>
          {hasChildren && (
            <div className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    // Non-root without a path: collapsible header
    return (
      <div className="group" key={node.id}>
        <button
          type="button"
          onClick={() => hasChildren && setOpen(v => !v)}
          className={["flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800/50 w-full text-left", pad].join(" ")}
          aria-expanded={open}
        >
          {hasChildren ? (open ? <ChevronDown /> : <ChevronRight />) : <Placeholder />}
          <span className="truncate">{node.label}</span>
        </button>
        {hasChildren && open && (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      data-gg-sidebar
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: "16rem", minWidth: "16rem", maxWidth: "16rem" }}
    >
      <div className="h-14 px-3 flex items-center gap-2 border-b border-gray-800">
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2"
        style={{ scrollbarGutter: "stable" }}
      >
        {roots.map((root) => <Node key={root.id} node={root} />)}
      </div>
    </aside>
  );
}
