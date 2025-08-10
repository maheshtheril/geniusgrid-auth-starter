import React, { useEffect, useMemo, useState, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Menu as MenuIcon,
  Search,
  Sun,
  Moon,
  Sparkles,
  LogOut,
} from "lucide-react";

/**
 * AppSidebar.jsx — collapsible sidebar (robust)
 * - Safe if fetchMenus prop is missing or not a function
 * - Collapsible + persisted; group expand persisted
 * - Hover popout when collapsed
 * - Active highlight with react-router
 * - Tailwind JIT-safe (no dynamic class names)
 */

const STORAGE_KEYS = {
  COLLAPSED: "gg.sidebarCollapsed",
  OPEN_GROUPS: "gg.sidebarOpenGroups",
};

export default function AppSidebar({
  fetchMenus,                  // optional function: () => Promise<Menu[] | {menus:Menu[]}>
  permissions = new Set(),     // optional Set<string>
  onThemeToggle,
  initialCollapsed,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof initialCollapsed === "boolean") return initialCollapsed;
    const v = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
    return v ? v === "1" : false;
  });
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.OPEN_GROUPS) || "[]");
    } catch {
      return [];
    }
  });
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Robust loader: uses prop if it’s a function, else falls back to direct fetch
  const getMenus = useCallback(async () => {
    try {
      let data;
      if (typeof fetchMenus === "function") {
        data = await fetchMenus();
      } else {
        const base =
          import.meta.env.VITE_API_URL ||
          "https://geniusgrid-auth-starter.onrender.com/api";
        const res = await fetch(`${base}/tenant/menus`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }
      return Array.isArray(data) ? data : data?.menus || [];
    } catch (err) {
      console.error("Sidebar: getMenus failed", err);
      throw err;
    }
  }, [fetchMenus]);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await getMenus();
        if (!live) return;
        setMenus(rows);
        setError(null);
      } catch (e) {
        if (!live) return;
        setError("Could not load menus");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [getMenus]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COLLAPSED, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OPEN_GROUPS, JSON.stringify(openGroups));
  }, [openGroups]);

  const tree = useMemo(
    () => buildTree(filterByPermission(menus, permissions)),
    [menus, permissions]
  );

  // auto-open ancestor groups for current route
  useEffect(() => {
    const activePath = location.pathname;
    const ancestors = findAncestorIdsByPath(tree, activePath);
    if (ancestors.length) {
      setOpenGroups((prev) => Array.from(new Set([...prev, ...ancestors])));
    }
  }, [location.pathname, tree]);

  const toggleGroup = (id) => {
    setOpenGroups((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sidebarWidth = collapsed ? "w-[76px]" : "w-[268px]";

  return (
    <aside
      className={`h-screen ${sidebarWidth} flex-shrink-0 border-r bg-white/70 dark:bg-neutral-900/70 backdrop-blur-sm supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-neutral-900/50`}
      aria-label="Sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <button
          className="inline-flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring"
          onClick={() => setCollapsed((c) => !c)}
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MenuIcon className="h-5 w-5" />
          {!collapsed && <span className="font-semibold">Menu</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-1">
            <button
              className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring"
              onClick={onThemeToggle}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              <Sun className="h-5 w-5 hidden dark:block" />
              <Moon className="h-5 w-5 dark:hidden" />
            </button>
            <button
              className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring"
              onClick={() => navigate("/app/ai")}
              aria-label="AI Assistant"
              title="AI Assistant"
            >
              <Sparkles className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Search (optional) */}
      <div className={`px-3 py-2 ${collapsed ? "hidden" : "block"}`}>
        <div className="flex items-center gap-2 rounded-xl border px-2 py-2 text-sm focus-within:ring">
          <Search className="h-4 w-4 opacity-60" />
          <input
            className="w-full bg-transparent outline-none"
            placeholder="Search menu…"
            onChange={(e) => {
              const q = e.target.value.toLowerCase();
              const el = document.querySelector(
                `[data-menu-name*="${CSS.escape(q)}"]`
              );
              el?.scrollIntoView({ block: "center" });
              el?.classList.add("ring", "ring-indigo-400");
              setTimeout(
                () => el?.classList.remove("ring", "ring-indigo-400"),
                900
              );
            }}
          />
        </div>
      </div>

      {/* Body */}
      <nav className="mt-1 overflow-y-auto px-2 pb-4" role="tree">
        {loading && <SkeletonRows collapsed={collapsed} />}
        {error && (
          <div className="m-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-700 text-sm">
            {String(error)}
          </div>
        )}
        {!loading &&
          !error &&
          tree.map((node) => (
            <MenuNode
              key={node.id}
              node={node}
              depth={0}
              collapsed={collapsed}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              activePath={location.pathname}
            />
          ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t p-2">
        <button
          className="w-full inline-flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring"
          onClick={() => navigate("/logout")}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function MenuNode({
  node,
  depth,
  collapsed,
  openGroups,
  toggleGroup,
  activePath,
}) {
  const isActive = useMemo(
    () => isActivePath(activePath, node.path),
    [activePath, node.path]
  );
  const isOpen = openGroups.includes(node.id);
  const hasChildren = node.children?.length;

  // When collapsed: show hover popout for groups
  if (collapsed && hasChildren) {
    return (
      <div className="relative" role="treeitem" aria-expanded={isOpen}>
        <button
          onMouseEnter={(e) =>
            e.currentTarget.nextSibling?.classList.remove("hidden")
          }
          onMouseLeave={(e) =>
            e.currentTarget.nextSibling?.classList.add("hidden")
          }
          className={`group mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
            isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40" : ""
          }`}
          aria-haspopup="menu"
          aria-expanded={false}
          data-menu-name={node.name.toLowerCase()}
          onClick={() => toggleGroup(node.id)}
          title={node.name}
        >
          <MenuIconRenderer name={node.icon} />
        </button>
        {/* popout */}
        <div
          className="hidden absolute left-full top-0 ml-1 min-w-[220px] rounded-2xl border bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900 z-10"
          onMouseEnter={(e) => e.currentTarget.classList.remove("hidden")}
          onMouseLeave={(e) => e.currentTarget.classList.add("hidden")}
        >
          <div className="px-3 py-2 text-xs font-semibold opacity-70">
            {node.name}
          </div>
          <div className="max-h-[70vh] overflow-auto p-1">
            {node.children.map((child) => (
              <LeafOrGroup
                key={child.id}
                node={child}
                depth={1}
                activePath={activePath}
                collapsed={false}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Expanded sidebar: render normal group or leaf
  return (
    <LeafOrGroup
      node={node}
      depth={depth}
      collapsed={collapsed}
      openGroups={openGroups}
      toggleGroup={toggleGroup}
      activePath={activePath}
    />
  );
}

function LeafOrGroup({
  node,
  depth,
  collapsed,
  openGroups,
  toggleGroup,
  activePath,
}) {
  const isActive = isActivePath(activePath, node.path);
  const hasChildren = node.children?.length;
  const isOpen = openGroups.includes(node.id);

  // ✅ Tailwind JIT-safe padding (no dynamic class names)
  const PADS = ["pl-2", "pl-4", "pl-6", "pl-8", "pl-10"];
  const padding = PADS[Math.min(depth, PADS.length - 1)];

  if (!hasChildren) {
    return (
      <NavLink
        to={node.path || "#"}
        className={({ isActive: match }) =>
          `group mt-1 flex items-center gap-3 rounded-xl px-3 py-2 ${padding} hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring ${
            match || isActive
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40"
              : ""
          }`
        }
        end
        data-menu-name={node.name.toLowerCase()}
        role="treeitem"
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? node.name : undefined}
      >
        <MenuIconRenderer name={node.icon} />
        {!collapsed && <span className="truncate">{node.name}</span>}
      </NavLink>
    );
  }

  return (
    <div role="treeitem" aria-expanded={isOpen} className="mt-1">
      <button
        onClick={() => toggleGroup(node.id)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 ${padding} hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring`}
        data-menu-name={node.name.toLowerCase()}
        title={collapsed ? node.name : undefined}
      >
        <MenuIconRenderer name={node.icon} />
        {!collapsed && (
          <span className="flex-1 truncate text-left">{node.name}</span>
        )}
        {collapsed ? (
          <ChevronRight className="h-4 w-4 opacity-60" />
        ) : isOpen ? (
          <ChevronDown className="h-4 w-4 opacity-60" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-60" />
        )}
      </button>
      {/* children */}
      <div className={`${isOpen && !collapsed ? "block" : "hidden"}`} role="group">
        {node.children.map((child) => (
          <LeafOrGroup
            key={child.id}
            node={child}
            depth={depth + 1}
            collapsed={collapsed}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
            activePath={activePath}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function isActivePath(current, path) {
  if (!path) return false;
  try {
    const clean = (s) => String(s).replace(/\/+$/, "");
    const c = clean(current);
    const p = clean(path);
    return c === p || (p && c.startsWith(p + "/"));
  } catch {
    return false;
  }
}

function filterByPermission(list, permissions) {
  if (!permissions || !(permissions instanceof Set) || permissions.size === 0)
    return list;
  return list.filter((m) => !m.permission_code || permissions.has(m.permission_code));
}

function buildTree(rows) {
  if (!Array.isArray(rows)) return [];
  const map = new Map();
  const roots = [];
  const sorted = [...rows].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  for (const r of sorted) map.set(r.id, { ...r, children: [] });
  for (const r of sorted) {
    const node = map.get(r.id);
    if (r.parent_id && map.has(r.parent_id)) {
      map.get(r.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function findAncestorIdsByPath(tree, path) {
  const result = [];
  const dfs = (node, ancestors) => {
    if (node.path && isActivePath(path, node.path)) {
      result.push(...ancestors);
    }
    for (const child of node.children || []) dfs(child, [...ancestors, node.id]);
  };
  for (const n of tree) dfs(n, []);
  return Array.from(new Set(result));
}

function MenuIconRenderer({ name }) {
  const map = {
    admin: MenuIcon,
    settings: MenuIcon,
    dashboard: MenuIcon,
    users: MenuIcon,
    crm: MenuIcon,
    sales: MenuIcon,
  };
  const Icon = (name && map[String(name).toLowerCase()]) || MenuIcon;
  return <Icon className="h-4 w-4 shrink-0 opacity-80" />;
}

function SkeletonRows({ collapsed }) {
  return (
    <div className="animate-pulse px-2 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`my-1 h-8 rounded-xl bg-neutral-200 dark:bg-neutral-800 ${
            collapsed ? "w-10" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}
