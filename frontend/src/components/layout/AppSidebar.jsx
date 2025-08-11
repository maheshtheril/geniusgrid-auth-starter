// src/components/AppSidebar.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ─────────────────────────  MENU LOGIC — DO NOT CHANGE  ───────────────────────── */
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
    } else roots.push(r);
  });
  rows.forEach((r) => {
    if (!r.children && r.path && isParentPath(r.path, rows)) r.children = [];
  });
  const sortFn = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  (function sortTree(nodes){ nodes.sort(sortFn); nodes.forEach(n => n.children && sortTree(n.children)); })(roots);
  return roots;
}
/* ───────────────────────  END MENU LOGIC — DO NOT CHANGE  ─────────────────────── */

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { env } = useEnv();

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  // start collapsed by default + persist
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("gg.sidebarCollapsed");
    return saved === null ? true : saved === "true";
  });
  useEffect(() => {
    localStorage.setItem("gg.sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  // expanded groups (by path)
  const [expanded, setExpanded] = useState(() => new Set());
  const tree = useMemo(() => buildTreeByPath(menus), [menus]);

  // keep your fetching logic
 useEffect(() => {
  let cancelled = false;

  async function fetchMenus() {
    setLoading(true);
    try {
      const res = await fetch(`${env.API_BASE || ""}/api/tenant/menus`, {
        method: "GET",
        credentials: "include", // keep session cookie
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) {
        console.error("menus HTTP", res.status, res.statusText);
        if (!cancelled) setMenus([]); // show "No menus."
        return;
      }

      const json = await res.json();

      // accept a few common shapes: array, {menus:[]}, {items:[]}
      const raw =
        Array.isArray(json) ? json :
        Array.isArray(json?.menus) ? json.menus :
        Array.isArray(json?.items) ? json.items :
        [];

      // normalize minimal fields used by your LOGIC (id,name,path,sort_order,children?)
      const normalized = raw.map((r) => ({
        ...r,
        id: r.id ?? r.menu_id ?? r.uuid ?? r.code ?? r.path,
        name: r.name ?? r.title ?? r.label ?? r.code ?? "Untitled",
        path: r.path ?? r.url ?? r.href ?? null,
        sort_order: r.sort_order ?? r.order ?? r.position ?? 0,
        // keep any provided children if your API sends nested trees
        children: Array.isArray(r.children) ? r.children : undefined,
      }));

      if (!cancelled) setMenus(normalized);
    } catch (e) {
      console.error("menus load error:", e);
      if (!cancelled) setMenus([]);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  fetchMenus();
  return () => { cancelled = true; };
}, [env]);


  // auto-expand ancestry when not collapsed
useEffect(() => {
  let cancelled = false;

  async function fetchMenus() {
    setLoading(true);

    // resolve API base robustly
    const apiBase =
      (env && env.API_BASE) ||
      (import.meta?.env?.VITE_API_URL) ||
      ""; // will use same-origin /api/tenant/menus

    const url = `${apiBase}/api/tenant/menus`.replace(/([^:]\/)\/+/g, "$1");

    try {
      console.log("[Sidebar] fetching menus from:", url);
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });

      console.log("[Sidebar] HTTP:", res.status, res.statusText);

      let json = null;
      try {
        json = await res.json();
      } catch {
        console.warn("[Sidebar] response not JSON");
      }

      if (cancelled) return;

      console.log("[Sidebar] raw JSON:", json);

      // Accept common shapes: array | {menus} | {items} | {data}
      const raw = Array.isArray(json)
        ? json
        : Array.isArray(json?.menus)
        ? json.menus
        : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data)
        ? json.data
        : [];

      // Normalize minimally for your existing logic
      const normalized = raw.map((r) => ({
        ...r,
        id: r.id ?? r.menu_id ?? r.uuid ?? r.code ?? r.path ?? crypto.randomUUID(),
        name: r.name ?? r.title ?? r.label ?? r.code ?? "Untitled",
        path: r.path ?? r.url ?? r.href ?? null,
        sort_order: r.sort_order ?? r.order ?? r.position ?? 0,
        children: Array.isArray(r.children) ? r.children : undefined
      }));

      console.table(
        (normalized || []).slice(0, 5).map(({ id, name, path, sort_order }) => ({
          id,
          name,
          path,
          sort_order
        }))
      );

      // If nothing usable came back, drop in a tiny fallback so we can see the UI is alive.
      if (!normalized.length) {
        console.warn("[Sidebar] no menus found; showing fallback sample for debug.");
        const fallback = [
          { id: "crm", name: "CRM", path: "/app/crm", sort_order: 10 },
          { id: "crm.leads", name: "Leads", path: "/app/crm/leads", sort_order: 11 },
          { id: "admin", name: "Admin", path: "/app/admin", sort_order: 20 },
          { id: "admin.users", name: "Users", path: "/app/admin/users", sort_order: 21 }
        ];
        setMenus(fallback);
      } else {
        setMenus(normalized);
      }
    } catch (e) {
      console.error("[Sidebar] menus load error:", e);
      if (!cancelled) {
        // show fallback so UI still proves rendering
        setMenus([
          { id: "fallback.home", name: "Home", path: "/dashboard", sort_order: 0 }
        ]);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  fetchMenus();
  return () => {
    cancelled = true;
  };
}, [env]);


  const toggleCollapsed = () => setCollapsed((c) => !c);
  const toggleGroup = (path) =>
    setExpanded((prev) => {
      const copy = new Set(prev);
      copy.has(path) ? copy.delete(path) : copy.add(path);
      return copy;
    });

  /* ───────────────────────────── LOOK & FEEL ZONE ─────────────────────────────
     - You can freely restyle classes below.
     - No logic changes above are needed for any redesign.
  ---------------------------------------------------------------------------- */
  const Shell = ({ children }) => (
    <aside
      className={[
        "relative h-screen flex flex-col overflow-hidden",
        "border-r border-zinc-200/60 dark:border-zinc-800/60",
        "bg-white/70 dark:bg-zinc-950/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur",
        "transition-[width] duration-300 ease-out",
        collapsed ? "w-16" : "w-72"
      ].join(" ")}
    >
      {/* gradient edge glow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-zinc-300/50 to-transparent dark:via-zinc-700/50" />
      {/* top neon bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      {children}
    </aside>
  );

  const Header = () => (
    <div className="flex items-center justify-between px-3 py-3">
      <button
        onClick={toggleCollapsed}
        className={[
          "rounded-xl px-2 py-1 text-xs font-medium",
          "border border-zinc-200/70 dark:border-zinc-800",
          "hover:bg-zinc-50/80 dark:hover:bg-zinc-900/70",
          "transition"
        ].join(" ")}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "›" : "‹"}
      </button>
      {!collapsed && (
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500/70 animate-pulse" />
          <span>Navigation</span>
        </div>
      )}
    </div>
  );

  const GroupButton = ({ node, open, inTrail }) => (
    <button
      type="button"
      onClick={() => toggleGroup(node.path)}
      className={[
        "w-full flex items-center rounded-xl px-3 py-2 text-sm transition",
        collapsed ? "justify-center" : "",
        inTrail
          ? "bg-zinc-900/[0.06] dark:bg-white/[0.04] ring-1 ring-inset ring-indigo-500/10"
          : "hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.03]"
      ].join(" ")}
      title={collapsed ? node.name : undefined}
      aria-expanded={collapsed ? false : open}
      aria-controls={`group-${btoa(node.path).replace(/=+$/,"")}`}
    >
      <span className="shrink-0 inline-grid h-5 w-5 place-items-center">
        {collapsed ? <ChevronRight className="h-4 w-4" /> : open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </span>
      {!collapsed && <span className="ml-3 flex-1 truncate">{node.name}</span>}
    </button>
  );

  const LeafLink = ({ node, isExact, inTrail }) => (
    <NavLink
      to={node.path || "#"}
      className={[
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        collapsed ? "justify-center" : "",
        (isExact || inTrail)
          ? "bg-zinc-900/[0.06] dark:bg-white/[0.06] ring-1 ring-inset ring-indigo-500/10"
          : "hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.03]"
      ].join(" ")}
      title={collapsed ? node.name : undefined}
      end
    >
      <span className="shrink-0 inline-grid h-5 w-5 place-items-center">
        <LayoutGrid className="h-4 w-4 opacity-80" />
      </span>
      {!collapsed && <span className="truncate">{node.name}</span>}
      {!collapsed && (isExact || inTrail) && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500/70 shadow-[0_0_8px_2px_rgba(99,102,241,0.35)]" />
      )}
    </NavLink>
  );

  const renderNode = (node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExact = node.path && pathname === node.path;
    const inTrail = node.path && pathname.startsWith(node.path);
    const open = expanded.has(node.path);

    if (!hasChildren) {
      return (
        <li key={node.id || node.path}>
          <LeafLink node={node} isExact={isExact} inTrail={inTrail} />
        </li>
      );
    }
    return (
      <li key={node.id || node.path} className="my-1">
        <GroupButton node={node} open={open} inTrail={inTrail} />
        {!collapsed && open && (
          <ul
            id={`group-${btoa(node.path).replace(/=+$/,"")}`}
            className="mt-1 ml-6 space-y-1 border-l border-zinc-200/50 dark:border-zinc-800/60 pl-3"
          >
            {node.children.map((c) => renderNode(c))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <Shell>
      <Header />
      <div className="flex-1 overflow-y-auto px-2 pb-6 custom-scroll">
        {loading ? (
          <div className="px-2 py-2 text-xs text-zinc-500 animate-pulse">Loading menus…</div>
        ) : tree.length ? (
          <ul className="space-y-1">{tree.map((n) => renderNode(n))}</ul>
        ) : (
          <div className="px-2 py-2 text-xs text-zinc-500">No menus.</div>
        )}
      </div>

      {/* subtle bottom glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-indigo-500/10 to-transparent" />
    </Shell>
  );
}

/* Optional: smooth scrollbar (place in your global CSS if you prefer)
.custom-scroll::-webkit-scrollbar{ width:8px; }
.custom-scroll::-webkit-scrollbar-thumb{ border-radius:8px; background:rgba(100,116,139,.35); }
.custom-scroll:hover::-webkit-scrollbar-thumb{ background:rgba(99,102,241,.55); }
*/
