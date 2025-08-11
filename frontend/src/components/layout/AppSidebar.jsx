import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (!s.startsWith("/")) return "/" + s;
  return s.replace(/\/+$/, "");
}

function pathParts(p) {
  return (normPath(p) || "").split("/").filter(Boolean);
}

// Dynamically check if a path is a parent (has deeper children)
function isParentPath(p, allItems) {
  const parts = pathParts(p);
  return allItems.some(
    (r) =>
      r.path &&
      r.path.startsWith(p + "/") &&
      pathParts(r.path).length > parts.length
  );
}

// Build the tree with dynamic parents and proper roots (YOUR ORIGINAL LOGIC)
function buildTreeByPath(items = []) {
  const rows = items.map((r) => ({ ...r, path: normPath(r.path), children: [] }));

  const parents = rows.filter((r) => r.path && isParentPath(r.path, rows));

  // Roots are those without any parent above them (works even if no single-seg base like "/app")
  const roots = rows.filter(
    (r) =>
      !rows.some(
        (other) =>
          other.path &&
          r.path?.startsWith(other.path + "/") &&
          pathParts(other.path).length < pathParts(r.path).length
      )
  );

  // Attach direct children to parents
  for (const parent of parents) {
    const pref = parent.path + "/";
    const kids = rows.filter((r) => r !== parent && r.path && r.path.startsWith(pref));
    const targetLen = pathParts(parent.path).length + 1;
    parent.children = kids.filter((k) => pathParts(k.path).length === targetLen);
  }

  // Sort the roots and children
  const cmp = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.name).localeCompare(String(b.name));

  roots.sort(cmp);
  parents.forEach((p) => p.children.sort(cmp));

  return { roots, parents, byPath: new Map(rows.map((r) => [r.path, r])) };
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

function Collapse({ open, children, id }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(open ? "auto" : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      setHeight(el.scrollHeight);
      const timeout = setTimeout(() => setHeight("auto"), 200);
      return () => clearTimeout(timeout);
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

export default function AppSidebar() {
  const { menus } = useEnv();
  const { roots, parents /*, byPath */ } = useMemo(() => buildTreeByPath(menus), [menus]);
  const location = useLocation();

  // Start fully collapsed; persist toggles
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => {
    localStorage.setItem("__gg_menu_open_paths", JSON.stringify(Array.from(open)));
  }, [open]);

  // (Disabled) Auto-open-by-route — leave OFF so nothing re-opens behind your click
  // useEffect(() => {
  //   const cur = normPath(location.pathname);
  //   if (!cur) return;
  //   const parts = pathParts(cur);
  //   if (parts.length >= 2) {
  //     const parentPath = "/" + parts.slice(0, 2).join("/");
  //     if (byPath.has(parentPath) && !open.has(parentPath)) {
  //       const next = new Set(open);
  //       next.add(parentPath);
  //       setOpen(next);
  //     }
  //   }
  // }, [location.pathname, byPath, open]);

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
    const idSlug = `group_${String(parentPath).replaceAll("/", "_")}`;

    // 🔑 Fix: do NOT force depth 0 open. Only open when in `open` Set.
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
         
        </button>

        <Collapse open={isOpen} id={idSlug}>
          {node.children.map((ch) =>
            // keep your original parent detection so rendering matches old behavior
            parents.find((p) => p.path === ch.path) ? (
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
            n.children?.length ? (
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
