import React, { useMemo, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * SidebarAccordion
 * - Props: items = [{ id, name, path, sort_order? }]
 * - Infers hierarchy from path ("/app", "/app/crm", "/app/crm/leads")
 * - Fully collapsed by default. Persists toggles (optional).
 * - No external state or stores. No Tailwind required (add your classes if you want).
 */

function norm(p) {
  if (!p) return null;
  const s = ("" + p).trim();
  return (s.startsWith("/") ? s : "/" + s).replace(/\/+$/, "");
}
const parts = (p) => (norm(p) || "").split("/").filter(Boolean);

function buildTree(items = []) {
  const rows = items
    .map((r) => ({ ...r, path: norm(r.path), children: [] }))
    .filter((r) => r.path);

  const map = new Map(rows.map((r) => [r.path, r]));
  // attach children to direct parent (by trimming one segment)
  for (const r of rows) {
    const segs = parts(r.path);
    if (segs.length > 1) {
      const parentPath = "/" + segs.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent) parent.children.push(r);
    }
  }
  const cmp = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.name).localeCompare(String(b.name));
  rows.forEach((r) => r.children.sort(cmp));
  const roots = rows.filter((r) => parts(r.path).length === 1).sort(cmp);

  return roots;
}

export default function SidebarAccordion({
  items = [],
  persistKey = "__sidebar_open_paths",   // change or set to null to disable persistence
  autoOpenActive = false,                // set true if you want to auto-open ancestors of current route
  className = "",
}) {
  const location = useLocation();
  const roots = useMemo(() => buildTree(items), [items]);

  // open set stores currently-open group paths
  const [open, setOpen] = useState(() => {
    if (!persistKey) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(persistKey) || "[]"));
    } catch {
      return new Set();
    }
  });

  // persist
  useEffect(() => {
    if (!persistKey) return;
    localStorage.setItem(persistKey, JSON.stringify(Array.from(open)));
  }, [open, persistKey]);

  // optional: auto-open current route's ancestors (off by default)
  useEffect(() => {
    if (!autoOpenActive) return;
    const p = norm(location.pathname);
    if (!p) return;
    const segs = parts(p);
    if (segs.length < 2) return;
    const ancestors = [];
    for (let i = 1; i < segs.length; i++) {
      ancestors.push("/" + segs.slice(0, i).join("/"));
    }
    setOpen((prev) => new Set([...prev, ...ancestors]));
  }, [location.pathname, autoOpenActive]);

  const toggle = (path, nextOpen) => {
    setOpen((prev) => {
      const n = new Set(prev);
      nextOpen ? n.add(path) : n.delete(path);
      return n;
    });
  };

  const isActive = (current, nodePath) =>
    current === nodePath || (nodePath && current.startsWith(nodePath + "/"));

  return (
    <aside className={className} style={{ width: 260, borderRight: "1px solid #e5e7eb" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em" }}>
        Menu
      </div>
      <nav style={{ padding: 8, overflowY: "auto", height: "calc(100vh - 80px)" }}>
        {roots.length ? (
          roots.map((n) =>
            n.children?.length ? (
              <Group
                key={n.id || n.path}
                node={n}
                open={open}
                onToggle={toggle}
                currentPath={location.pathname}
              />
            ) : (
              <Leaf
                key={n.id || n.path}
                node={n}
                currentPath={location.pathname}
              />
            )
          )
        ) : (
          <div style={{ color: "#6b7280", fontSize: 14, padding: "6px 8px" }}>
            No menus
          </div>
        )}
      </nav>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
        © GeniusGrid
      </div>
    </aside>
  );
}

function Group({ node, open, onToggle, currentPath, depth = 0 }) {
  const opened = open.has(node.path);
  const id = "grp_" + node.path.replaceAll("/", "_");

  return (
    <details
      open={opened}
      onToggle={(e) => onToggle(node.path, e.currentTarget.open)}
      style={{ margin: "2px 0" }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          paddingLeft: 10 + depth * 14,
          borderRadius: 8,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Caret open={opened} />
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {node.name}
        </span>
        {/* Optional: quick link to the group's own path if it’s a route */}
        {node.path && (
          <NavLink
            to={node.path}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, textDecoration: "underline", opacity: 0.7 }}
          >
            Open
          </NavLink>
        )}
      </summary>

      <div id={id} role="group" style={{ marginLeft: 10 }}>
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
    </details>
  );
}

function Leaf({ node, currentPath, depth = 0 }) {
  const active =
    currentPath === node.path ||
    (node.path && currentPath.startsWith(node.path + "/"));
  return (
    <NavLink
      to={node.path || "#"}
      end
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        paddingLeft: 24 + depth * 14,
        borderRadius: 8,
        textDecoration: "none",
        color: active ? "#4338ca" : "inherit",
        background: active ? "rgba(99,102,241,.12)" : "transparent",
      }}
    >
      <span
        style={{
          height: 6,
          width: 6,
          borderRadius: "9999px",
          background: "currentColor",
          opacity: 0.6,
        }}
      />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {node.name}
      </span>
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
