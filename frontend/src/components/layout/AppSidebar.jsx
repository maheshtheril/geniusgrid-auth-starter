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
const first = (...vals) => vals.find((v) => v !== undefined && v !== null);
const toNumOrNull = (v) => (Number.isFinite(+v) ? +v : null);
const toNullable = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : v;
};
const byOrderThenLabel = (a, b) => {
  const ao = Number.isFinite(a.sort_order) ? a.sort_order : 999999;
  const bo = Number.isFinite(b.sort_order) ? b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
};

/* ---- normalize + build strictly by parent id ---- */
function normalize(items) {
  return (items || []).map((raw) => ({
    id: first(raw.id, raw.ID),
    code: first(raw.code, raw.Code),
    label: first(raw.label, raw.Label) || "",
    path: normPath(first(raw.path, raw.Path)),
    icon: first(raw.icon, raw.Icon) ?? null,
    parent_id: toNullable(first(raw.parent_id, raw.parentId, raw.parentID)),
    module_code: first(raw.module_code, raw.moduleCode) ?? null,
    sort_order: toNumOrNull(first(raw.sort_order, raw.sortOrder)),
  }));
}

function buildTree(items) {
  const rows = normalize(items);
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
    if (pid && byId.has(pid)) {
      kids.get(pid).push(n);
    } else {
      roots.push(n);
    }
  });

  const sortRec = (node) => {
    const childList = kids.get(node.id) || [];
    childList.sort(byOrderThenLabel);
    return { ...node, children: childList.map(sortRec) };
  };

  roots.sort(byOrderThenLabel);
  // remove any root literally labeled "Main"
  const filtered = roots.filter((r) => String(r.label).trim().toLowerCase() !== "main");
  return filtered.map(sortRec);
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
    const [open, setOpen] = useState(true && isRoot); // roots open by default
    const pad = depth > 0 ? "ml-3" : "";

    // Always render ROOT as a header (non-link) so parents are visible
    if (isRoot) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => hasChildren && setOpen((v) => !v)}
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800/50 w-full text-left",
              pad,
            ].join(" ")}
            aria-expanded={open}
          >
            {hasChildren ? <Arrow open={open} /> : <ArrowPlaceholder />}
            <span className="truncate">{node.label || node.code}</span>
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
            <ArrowPlaceholder />
            <span className="truncate">{node.label || node.code}</span>
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

    // Non-root without a path: collapsible header
    return (
      <div className="group" key={node.id}>
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800/50 w-full text-left",
            pad,
          ].join(" ")}
          aria-expanded={open}
        >
          {hasChildren ? <Arrow open={open} /> : <ArrowPlaceholder />}
          <span className="truncate">{node.label || node.code}</span>
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

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2" style={{ scrollbarGutter: "stable" }}>
        {roots.map((root) => (
          <Node key={root.id} node={root} />
        ))}
      </div>
    </aside>
  );
}
