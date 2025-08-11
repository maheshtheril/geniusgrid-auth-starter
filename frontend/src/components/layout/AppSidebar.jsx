// src/components/layout/AppSidebarSimple.jsx
import React, { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
// If you prefer to feed menus via props, remove this line and pass `items` from parent
import { useEnv } from "@/store/useEnv";

/**
 * Expected item shape:
 * { id, name, path, sort_order?, icon? }
 * Parent/child inferred from path segments: "/app", "/app/crm", "/app/crm/leads"
 */

function norm(p) {
  if (!p) return null;
  const s = String(p).trim();
  return (s.startsWith("/") ? s : "/" + s).replace(/\/+$/, "");
}
function parts(p) {
  return (norm(p) || "").split("/").filter(Boolean);
}
function isDirectChild(parentPath, childPath) {
  const a = parts(parentPath), b = parts(childPath);
  return b.length === a.length + 1 && childPath.startsWith(parentPath + "/");
}
function buildTreeByPath(items = []) {
  const rows = items.map((r) => ({ ...r, path: norm(r.path), children: [] }));
  // map path -> node
  const map = new Map(rows.map((r) => [r.path, r]));
  // attach children
  for (const r of rows) {
    if (!r.path) continue;
    // find its direct parent by trimming one segment
    const segs = parts(r.path);
    if (segs.length > 1) {
      const parentPath = "/" + segs.slice(0, segs.length - 1).join("/");
      const parent = map.get(parentPath);
      if (parent) parent.children.push(r);
    }
  }
  const cmp = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.name).localeCompare(String(b.name));
  for (const r of rows) r.children.sort(cmp);
  const roots = rows
    .filter((r) => {
      const segs = parts(r.path);
      return !segs || segs.length <= 1; // only "/" + one segment are roots
    })
    .sort(cmp);
  return roots;
}

export default function AppSidebarSimple({ items }) {
  const { menus } = useEnv(); // remove if you pass `items` from parent
  const data = items || menus || [];
  const location = useLocation();
  const roots = useMemo(() => buildTreeByPath(data), [data]);

  // fully collapsed by default
  const [open, setOpen] = useState(() => new Set());

  const toggle = (p) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  return (
    <aside className="w-64 h-screen border-r bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
      <div className="px-3 py-3 border-b text-xs uppercase tracking-wide text-neutral-500">
        Menu
      </div>
      <nav className="px-2 py-2 overflow-y-auto">
        {roots.length ? (
          roots.map((node) =>
            node.children?.length ? (
              <Group
                key={node.id || node.path}
                node={node}
                open={open}
                onToggle={toggle}
                currentPath={location.pathname}
                depth={0}
              />
            ) : (
              <Leaf
                key={node.id || node.path}
                node={node}
                currentPath={location.pathname}
                depth={0}
              />
            )
          )
        ) : (
          <div className="text-sm text-neutral-500 px-2 py-1">No menus</div>
        )}
      </nav>
      <div className="mt-auto px-3 py-3 border-t text-xs text-neutral-500">
        © GeniusGrid
      </div>
    </aside>
  );
}

function Group({ node, open, onToggle, currentPath, depth }) {
  const isOpen = open.has(node.path);
  return (
    <div className="my-0.5">
      <button
        type="button"
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onToggle(node.path)}
        aria-expanded={isOpen}
        aria-controls={`grp-${node.path}`}
      >
        <Caret open={isOpen} />
        <span className="truncate">{node.name}</span>
        {/* optional: small open link to parent route if it exists */}
        {node.path && (
          <NavLink
            to={node.path}
            className="ml-auto text-xs underline opacity-70 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            Open
          </NavLink>
        )}
      </button>
      <div
        id={`grp-${node.path}`}
        className={isOpen ? "block" : "hidden"}
        role="group"
      >
        {node.children.map((ch) =>
          ch.children?.length ? (
            <Group
              key={ch.id || ch.path}
              node={ch}
              open={open}
              onToggle={onToggle}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ) : (
            <Leaf
              key={ch.id || ch.path}
              node={ch}
              currentPath={currentPath}
              depth={depth + 1}
            />
          )
        )}
      </div>
    </div>
  );
}

function Leaf({ node, currentPath, depth }) {
  const active =
    currentPath === node.path ||
    (node.path && currentPath.startsWith(node.path + "/"));
  return (
    <NavLink
      to={node.path || "#"}
      end
      className={
        "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
        (active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40" : "")
      }
      style={{ paddingLeft: 22 + depth * 14 }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      <span className="truncate">{node.name}</span>
    </NavLink>
  );
}

function Caret({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden
      style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .18s ease" }}
    >
      <path
        d="M8 5l8 7-8 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
