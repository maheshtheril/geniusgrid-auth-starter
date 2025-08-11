// src/components/AppSidebar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ---------- path helpers (use your originals if you prefer) ---------- */
function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (!s.startsWith("/")) return "/" + s;
  return s.replace(/\/+$/, "");
}
function pathParts(p) {
  return (normPath(p) || "").split("/").filter(Boolean);
}
function isParentPath(p, all) {
  const parts = pathParts(p);
  return all.some(
    (r) =>
      r.path &&
      r.path.startsWith(p + "/") &&
      pathParts(r.path).length > parts.length
  );
}
function buildTreeByPath(items = []) {
  const rows = items.map((r) => ({ ...r, path: normPath(r.path) }));
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const roots = [];

  rows.forEach((r) => {
    const parentPath = r.path ? "/" + pathParts(r.path).slice(0, -1).join("/") : null;
    const parent = parentPath && byPath.get(parentPath);
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(r);
    } else {
      roots.push(r);
    }
  });

  // Mark dynamic parents
  rows.forEach((r) => {
    if (!r.children && r.path && isParentPath(r.path, rows)) {
      r.children = [];
    }
  });

  // Sort by sort_order if present
  const sortFn = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const sortTree = (nodes) => {
    nodes.sort(sortFn);
    nodes.forEach((n) => n.children && sortTree(n.children));
  };
  sortTree(roots);

  return roots;
}

/* ------------------------------ component ----------------------------- */
export default function AppSidebar() {
  const { pathname } = useLocation();
  const { env } = useEnv(); // if you use this to get API base, etc.

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  // START COLLAPSED (default = true). Persist to localStorage.
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("gg.sidebarCollapsed");
    return saved === null ? true : saved === "true";
  });
  useEffect(() => {
    localStorage.setItem("gg.sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  // Track expanded groups (by path). Auto-expand active parent when not collapsed.
  const [expanded, setExpanded] = useState(() => new Set());

  const tree = useMemo(() => buildTreeByPath(menus), [menus]);

  // ⬇ keep your existing fetchMenus() logic — only call setMenus([...]) and setLoading(false)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // ---- YOUR ORIGINAL FETCHING LOGIC HERE ----
        // Example (replace with your real one):
        // const res = await fetch(`${env.API_BASE}/api/tenant/menus`, { credentials: "include" });
        // const data = await res.json();
        // if (!cancelled) setMenus(data?.menus || []);
        // -------------------------------------------
        // Fallback no-op if you paste this before wiring:
        if (!cancelled) setMenus((m) => m); // no change
      } catch (e) {
        console.error("menus load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env]);

  // Auto-expand active ancestry when not collapsed
  useEffect(() => {
    if (collapsed || !tree.length) return;
    const activeAncestors = new Set();
    const visit = (nodes, parents = []) => {
      for (const n of nodes) {
        const meActive = n.path && pathname.startsWith(n.path);
        if (meActive) parents.forEach((p) => activeAncestors.add(p.path));
        if (n.children?.length) visit(n.children, [...parents, n]);
      }
    };
    visit(tree, []);
    setExpanded(activeAncestors);
  }, [pathname, collapsed, tree]);

  const toggleCollapsed = () => setCollapsed((c) => !c);

  const toggleGroup = (path) => {
    setExpanded((prev) => {
      const copy = new Set(prev);
      if (copy.has(path)) copy.delete(path);
      else copy.add(path);
      return copy;
    });
  };

  const renderNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isActive = node.path && pathname === node.path;
    const inActiveTrail = node.path && pathname.startsWith(node.path);
    const open = expanded.has(node.path);

    // Leaf
    if (!hasChildren) {
      return (
        <li key={node.id || node.path}>
          <NavLink
            to={node.path || "#"}
            className={({ isActive: exact }) =>
              [
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                collapsed ? "justify-center" : "",
                (exact || isActive || inActiveTrail) ? "bg-zinc-900/10 dark:bg-zinc-100/10 font-medium" : "hover:bg-zinc-900/5 dark:hover:bg-zinc-100/5",
              ].join(" ")
            }
            title={collapsed ? node.name : undefined}
          >
            <span className="shrink-0 inline-grid h-5 w-5 place-items-center">
              {/* Optional: map your icon name to a Lucide icon */}
              <LayoutGrid className="h-4 w-4 opacity-80" />
            </span>
            {!collapsed && <span className="truncate">{node.name}</span>}
          </NavLink>
        </li>
      );
    }

    // Group
    return (
      <li key={node.id || node.path} className="my-1">
        <button
          type="button"
          onClick={() => toggleGroup(node.path)}
          className={[
            "w-full flex items-center",
            collapsed ? "justify-center rounded-xl px-3 py-2" : "rounded-xl px-3 py-2",
            "text-left text-sm hover:bg-zinc-900/5 dark:hover:bg-zinc-100/5 transition",
            inActiveTrail ? "bg-zinc-900/10 dark:bg-zinc-100/10 font-medium" : "",
          ].join(" ")}
          title={collapsed ? node.name : undefined}
          aria-expanded={collapsed ? false : open}
          aria-controls={`group-${btoa(node.path).replace(/=+$/,'')}`}
        >
          <span className="shrink-0 inline-grid h-5 w-5 place-items-center">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          {!collapsed && <span className="ml-3 flex-1 truncate">{node.name}</span>}
        </button>

        {/* Children */}
        {!collapsed && open && (
          <ul
            id={`group-${btoa(node.path).replace(/=+$/,'')}`}
            className="mt-1 ml-6 space-y-1 border-l border-zinc-200 dark:border-zinc-800 pl-3"
          >
            {node.children.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside
      className={[
        "h-screen border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950",
        "flex flex-col",
        collapsed ? "w-16" : "w-64",
        "transition-[width] duration-200 ease-out"
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <button
          onClick={toggleCollapsed}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "›" : "‹"}
        </button>

        {!collapsed && (
          <div className="text-xs text-zinc-500 font-medium select-none">
            {/* No “Open” link anywhere */}
            Menu
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {loading ? (
          <div className="px-2 py-2 text-xs text-zinc-500">Loading menus…</div>
        ) : tree.length ? (
          <ul className="space-y-1">{tree.map((n) => renderNode(n))}</ul>
        ) : (
          <div className="px-2 py-2 text-xs text-zinc-500">No menus.</div>
        )}
      </div>
    </aside>
  );
}
