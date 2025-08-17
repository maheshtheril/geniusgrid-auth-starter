// src/components/layout/AppSidebar.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Loader2, Search } from "lucide-react";

// --- tiny API helper (inline to avoid extra imports) ---
async function fetchMenus() {
  const res = await fetch("/api/tenant/menus", { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // expected: [{id, name, path, icon, parent_id, sort_order}]
  return Array.isArray(json?.items) ? json.items : json;
}

// --- build a tree from flat menus ---
function buildTree(items) {
  const map = new Map();
  const roots = [];
  items
    .sort((a, b) =>
      (a.parent_id || "").localeCompare(b.parent_id || "") ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      a.name.localeCompare(b.name)
    )
    .forEach((it) => {
      map.set(it.id, { ...it, children: [] });
    });
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function AppSidebar({ onRequestClose }) {
  const [state, setState] = useState({ loading: true, error: null, tree: [] });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(() => new Set()); // expanded nodes
  const location = useLocation();

  // auto-expand ancestors of active route
  const ensurePathOpen = useCallback((tree, pathname) => {
    const stack = [];
    function dfs(node, acc) {
      const me = [...acc, node.id];
      if (node.path && pathname.startsWith(node.path)) stack.push(me);
      node.children?.forEach((c) => dfs(c, me));
    }
    tree.forEach((r) => dfs(r, []));
    const expanded = new Set();
    stack.forEach((pathIds) => pathIds.forEach((id) => expanded.add(id)));
    return expanded;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const flat = await fetchMenus();
        if (!alive) return;
        const tree = buildTree(flat);
        setState({ loading: false, error: null, tree });
        // expand to active route on first load
        setOpen(ensurePathOpen(tree, location.pathname));
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: e.message || "Failed to load menus", tree: [] });
      }
    })();
    return () => (alive = false);
  }, []); // load once

  useEffect(() => {
    // keep ancestors open when route changes
    if (state.tree.length) {
      setOpen(ensurePathOpen(state.tree, location.pathname));
    }
    // close drawer on navigate (mobile)
    onRequestClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // filter tree by search (q)
  const filteredTree = useMemo(() => {
    if (!q.trim()) return state.tree;
    const term = q.toLowerCase();
    function filterNode(node) {
      const selfHit =
        node.name?.toLowerCase().includes(term) ||
        node.path?.toLowerCase().includes(term);
      const kids = (node.children || []).map(filterNode).filter(Boolean);
      if (selfHit || kids.length) return { ...node, children: kids };
      return null;
    }
    return state.tree.map(filterNode).filter(Boolean);
  }, [state.tree, q]);

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="h-full flex flex-col bg-card text-foreground">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 font-bold border-b">
        GeniusGrid
      </div>

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-md border bg-background text-sm"
            placeholder="Search menu"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {state.loading ? (
          <div className="flex items-center gap-2 text-sm opacity-70 px-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading menus…
          </div>
        ) : state.error ? (
          <div className="text-sm text-red-600 px-2 py-2">
            Failed: {state.error}
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="text-sm opacity-70 px-2 py-2">No menus</div>
        ) : (
          <MenuTree
            nodes={filteredTree}
            open={open}
            onToggle={toggle}
            onItemClick={() => onRequestClose?.()}
          />
        )}
      </div>
    </div>
  );
}

// ----- Recursive tree renderer -----
function MenuTree({ nodes, open, onToggle, onItemClick, level = 0 }) {
  return (
    <ul className={level === 0 ? "space-y-1" : "ml-3 space-y-1"}>
      {nodes.map((n) => {
        const hasKids = n.children && n.children.length > 0;
        const expanded = open.has(n.id);
        const rowClasses =
          "group flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted";

        return (
          <li key={n.id}>
            <div className="flex items-start">
              {/* Toggle caret or spacer */}
              <button
                type="button"
                aria-label="Toggle"
                className={`h-6 w-6 mr-1 flex items-center justify-center rounded ${
                  hasKids ? "opacity-80 hover:bg-muted" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => hasKids && onToggle(n.id)}
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    expanded ? "rotate-90" : ""
                  }`}
                />
              </button>

              {/* Label / Link */}
              {n.path ? (
                <NavLink
                  to={n.path}
                  className={({ isActive }) =>
                    `${rowClasses} ${isActive ? "bg-muted text-primary" : ""}`
                  }
                  onClick={onItemClick}
                >
                  <span className="truncate">{n.name}</span>
                </NavLink>
              ) : (
                <div
                  className={`${rowClasses} cursor-default`}
                  onClick={() => hasKids && onToggle(n.id)}
                >
                  <span className="truncate">{n.name}</span>
                </div>
              )}
            </div>

            {/* Children */}
            {hasKids && expanded && (
              <div className="mt-1">
                <MenuTree
                  nodes={n.children}
                  open={open}
                  onToggle={onToggle}
                  onItemClick={onItemClick}
                  level={level + 1}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
