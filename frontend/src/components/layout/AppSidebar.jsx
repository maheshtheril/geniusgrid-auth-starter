import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------- path helpers ---------- */
function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  const withSlash = s.startsWith("/") ? s : "/" + s;
  return withSlash.replace(/\/+$/, "");
}
function pathParts(p) {
  return (normPath(p) || "").split("/").filter(Boolean);
}
function slugifyPath(p) {
  return `group_${String(p || "").replace(/\//g, "_")}`;
}

/* ---------- build tree (robust) ---------- */
function buildTreeByPath(items = []) {
  // 1) normalize rows
  const rows = (items || [])
    .map((r) => ({ ...r, path: normPath(r.path), children: [] }))
    .filter((r) => r.path);

  // 2) map path -> node
  const map = new Map(rows.map((r) => [r.path, r]));

  // 3) attach to direct parent by trimming one segment
  for (const r of rows) {
    const segs = pathParts(r.path);
    if (segs.length > 1) {
      const parentPath = "/" + segs.slice(0, segs.length - 1).join("/");
      const parent = map.get(parentPath);
      if (parent) parent.children.push(r);
    }
  }

  // 4) sorting
  const cmp = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.name).localeCompare(String(b.name));
  for (const n of rows) n.children.sort(cmp);

  // 5) roots are single-segment nodes
  const roots = rows.filter((r) => pathParts(r.path).length === 1).sort(cmp);

  // 6) parents = nodes that have children
  const parents = rows.filter((r) => r.children && r.children.length > 0);

  // 7) byPath map for future features (kept for parity)
  const byPath = new Map(rows.map((r) => [r.path, r]));

  return { roots, parents, byPath };
}

/* ---------- tiny caret ---------- */
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

/* ---------- animated collapse ---------- */
function Collapse({ open, children, id }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(open ? "auto" : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      setHeight(el.scrollHeight);
      const t = setTimeout(() => setHeight("auto"), 200);
      return () => clearTimeout(t);
    } else {
      if (height === "auto") {
        setHeight(el.scrollHeight);
        requestAnimationFrame(() => setHeight(0));
      } else {
        setHeight(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      id={id}
      ref={ref}
      style={{
        maxHeight: typeof height === "number" ? height + "px" : height,
        overflow: "hidden",
        transition: "max-height 0.2s ease",
        marginLeft: 10,
        paddingLeft: 8,
        borderLeft: "1px solid rgba(255,255,255,.08)",
        willChange: "max-height",
      }}
    >
      {children}
    </div>
  );
}

/* ---------- main ---------- */
export default function AppSidebar() {
  const { menus } = useEnv();
  const { roots /*, parents, byPath */ } = useMemo(() => buildTreeByPath(menus), [menus]);
  const location = useLocation();

  // Fully collapsed by default; persist toggles by path
  const [open, setOpen] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("__gg_menu_open_paths") || "[]"));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open_paths", JSON.stringify(Array.from(open)));
  }, [open]);

  const toggle = (parentPath) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(parentPath) ? n.delete(parentPath) : n.add(parentPath);
      return n;
    });

  const Leaf = ({ node, depth }) => (
    <div className="nav-node">
      <NavLink
        to={node.path || "#"}
        end
        className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <span style={{ width: 12, display: "inline-block" }} />
        <span className="nav-dot" /> <span>{node.name}</span>
      </NavLink>
    </div>
  );

  const Group = ({ node, depth }) => {
    const parentPath = node.path;
    const idSlug = slugifyPath(parentPath);
    const isOpen = open.has(parentPath);

    return (
      <div className="nav-node">
        <button
          type="button"
          className="nav-item nav-toggle"
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => toggle(parentPath)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(parentPath);
            }
          }}
          aria-expanded={isOpen}
          aria-controls={idSlug}
        >
          <Caret open={isOpen} />
          <span className="nav-label">{node.name}</span>
          {node.path && (
            <NavLink
              to={node.path}
              className="nav-mini-link"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </NavLink>
          )}
        </button>

        <Collapse open={isOpen} id={idSlug}>
          {node.children.map((ch) =>
            ch.children && ch.children.length ? (
              <Group key={ch.id || ch.path} node={ch} depth={depth + 1} />
            ) : (
              <Leaf key={ch.id || ch.path} node={ch} depth={depth + 1} />
            )
          )}
        </Collapse>
      </div>
    );
  };

  return (
    <aside className="app-sidebar panel glass">
      <div className="sidebar-head text-muted small">Menu</div>
      <nav className="nav-vertical">
        {roots.length ? (
          roots.map((n) =>
            n.children && n.children.length ? (
              <Group key={n.id || n.path} node={n} depth={0} />
            ) : (
              <Leaf key={n.id || n.path} node={n} depth={0} />
            )
          )
        ) : (
          <div className="text-muted">No menus</div>
        )}
      </nav>
      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
