// src/components/layout/AppSidebar.jsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

/* ---------------- helpers ---------------- */
const LS_EXPANDED = "gg:sidebar:expanded:v1";

// Ensure we always call /api even if VITE_API_URL is missing or incomplete
function api(path) {
  const raw = (import.meta.env.VITE_API_URL || "").trim();   // optional
  const base = raw ? raw.replace(/\/+$/, "") : "";            // strip trailing /
  const withApi = base
    ? (base.endsWith("/api") ? base : `${base}/api`)
    : "/api";                                                // default to same-origin /api
  return `${withApi}${path}`;
}

// Ensure API base always ends with /api
function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_URL || "/api").trim();
  // strip trailing slashes
  const noTrail = raw.replace(/\/+$/, "");
  if (noTrail.endsWith("/api")) return noTrail;       // already .../api
  if (noTrail === "" || noTrail === "/") return "/api";
  return `${noTrail}/api`;
}
const API_BASE = resolveApiBase();

const cls = (...xs) => xs.filter(Boolean).join(" ");
const normalize = (s) => (s || "").toString().toLowerCase();

/** simple fuzzy: subsequence match */
function fuzzyScore(text, query) {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return 0;
  let ti = 0, qi = 0, score = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) { score += 2; qi++; }
    ti++;
  }
  return qi === q.length ? score + Math.max(0, 6 - (ti - qi)) : -1;
}
function highlightSubseq(label, query) {
  const l = label ?? "";
  const q = normalize(query);
  if (!q) return l;
  let i = 0, qi = 0, out = [];
  const low = l.toLowerCase();
  while (i < l.length) {
    const ch = l[i];
    if (qi < q.length && low[i] === q[qi]) {
      out.push(<mark key={i} className="bg-base-300 rounded px-0.5">{ch}</mark>);
      qi++;
    } else out.push(<span key={i}>{ch}</span>);
    i++;
  }
  return out;
}

// emoji/char icon slot; fallback glyph
function IconSlot({ icon, compact }) {
  return (
    <span className={cls("shrink-0 inline-flex items-center justify-center", compact ? "w-6" : "w-5")}>
      {icon ? <span aria-hidden="true">{icon}</span> : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="opacity-70">
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </span>
  );
}

/* ---------------- component ---------------- */
export default function AppSidebar({ onRequestClose, collapsed = false, onToggleCollapse }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState(() => {
    try {
      const raw = localStorage.getItem(LS_EXPANDED);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });
  const [focusedId, setFocusedId] = React.useState(null);
  const refMap = React.useRef(new Map());

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const url = `${API_BASE}/tenant/menus`;
      try {
        const res = await fetch(url, { credentials: "include" });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
        if (!ct.includes("application/json")) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Non-JSON response (${ct}) @ ${url}: ${txt.slice(0, 120)}`);
        }
        const data = await res.json();
        const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        if (!alive) return;
        setItems(arr);
      } catch (e) {
        if (!alive) return;
        setError(e);
      }
    })();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem(LS_EXPANDED, JSON.stringify([...expanded])); } catch {}
  }, [expanded]);

  // Build tree & active id
  const { roots, byId, parentMap, visibleList, activeId } = React.useMemo(() => {
    const outById = Object.create(null);
    const parent = Object.create(null);
    const inOrder = (a, b) => {
      const s = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      return s !== 0 ? s : (a.name || "").localeCompare(b.name || "");
    };

    (items || []).forEach((i) => {
      outById[i.id] = { ...i, children: [] };
      if (i.parent_id) parent[i.id] = i.parent_id;
    });
    (items || []).forEach((i) => {
      if (i.parent_id && outById[i.parent_id]) outById[i.parent_id].children.push(outById[i.id]);
    });
    Object.values(outById).forEach((n) => n.children.sort(inOrder));
    const rootsArr = (items || []).filter((i) => !i.parent_id).map((i) => outById[i.id]).sort(inOrder);

    // active by longest matching path
    let active = null;
    if (items) {
      const best = items.filter((i) => i.path && pathname.startsWith(i.path))
        .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
      active = best?.id || null;
    }

    // compute visible linear list
    const vis = [];
    function walk(node, depth) {
      vis.push({ id: node.id, depth, node });
      const isOpen = expanded.has(node.id);
      if (isOpen) node.children.forEach((c) => walk(c, depth + 1));
    }
    rootsArr.forEach((r) => walk(r, 0));

    return { roots: rootsArr, byId: outById, parentMap: parent, visibleList: vis, activeId: active };
  }, [items, expanded, pathname]);

  // auto-expand ancestors of active route
  React.useEffect(() => {
    if (!items || !activeId) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let p = parentMap[activeId];
      while (p) { next.add(p); p = parentMap[p]; }
      return next;
    });
  }, [items, activeId, parentMap]);

  // focus management
  React.useEffect(() => {
    if (!focusedId && (activeId || visibleList[0]?.id)) {
      setFocusedId(activeId || visibleList[0].id);
    }
  }, [focusedId, activeId, visibleList]);

  React.useEffect(() => {
    const el = refMap.current.get(focusedId);
    if (el) el.focus({ preventScroll: true });
  }, [focusedId, visibleList]);

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleNavigate = (path) => {
    if (!path) return;
    navigate(path);
    onRequestClose?.();
  };

  // search
  const flat = React.useMemo(() => (items || []).map((i) => ({
    id: i.id, name: i.name, path: i.path, icon: i.icon, parent_id: i.parent_id,
  })), [items]);
  const results = React.useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return flat
      .map((i) => ({ i, s: fuzzyScore(i.name + " " + (i.path || ""), q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 50)
      .map((x) => x.i);
  }, [flat, query]);

  const crumb = (id) => {
    const chain = [];
    let cur = id;
    while (cur) { const n = byId[cur]; if (!n) break; chain.push(n); cur = parentMap[cur]; }
    return chain.reverse();
  };

  /* -------------- render -------------- */
  if (error) {
    return (
      <div className="p-3 text-sm">
        <div className="alert alert-error"><span>Sidebar failed: {String(error.message)}</span></div>
        <button className="btn btn-sm mt-3" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  if (!items) return <div className="p-3 text-sm opacity-70">Loading menu…</div>;

  const showLabels = !collapsed;

  return (
    <div className="flex h-full flex-col">
      {/* top: brand + controls */}
      <div className="p-2 border-b border-base-300 sticky top-0 bg-base-100 z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-base-200 select-none">🧭</span>
            {showLabels && <span className="font-semibold truncate">GeniusGrid</span>}
          </div>
          <div className="flex-1" />
          {onToggleCollapse && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand" : "Collapse"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h4v16H3z" /><polyline points="13 6 18 12 13 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h4v16H3z" /><polyline points="18 6 13 12 18 18" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* search */}
        <div className="mt-2 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showLabels ? "Search…" : "Search"}
            className={cls(
              "input input-sm input-bordered w-full pr-8",
              showLabels ? "" : "text-xs"
            )}
            aria-label="Search menu"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>

        {/* expand/collapse all for tree (hidden in mini) */}
        {showLabels && (
          <div className="mt-2 flex gap-1">
            <button
              className="btn btn-ghost btn-xs"
              title="Expand all"
              onClick={() => {
                const next = new Set(expanded);
                (items || []).forEach((i) => {
                  if (items.find((x) => x.parent_id === i.id)) next.add(i.id);
                });
                setExpanded(next);
              }}
            >＋</button>
            <button
              className="btn btn-ghost btn-xs"
              title="Collapse all"
              onClick={() => setExpanded(new Set())}
            >–</button>
          </div>
        )}
      </div>

      {/* search results */}
      {results && (
        <div className="overflow-y-auto p-2">
          <ul className="menu">
            {results.map((r) => {
              const chain = crumb(r.id);
              const label = (showLabels
                ? <span className="truncate">{highlightSubseq(chain.at(-1)?.name || r.name, query)}</span>
                : null);
              const title = showLabels ? undefined : (chain.map((n) => n.name).join(" / ") || r.name);
              return (
                <li key={r.id} className={cls(!showLabels && "tooltip tooltip-right")} data-tip={title}>
                  {r.path ? (
                    <NavLink to={r.path} onClick={() => onRequestClose?.()} className="flex items-center gap-2">
                      <IconSlot icon={r.icon} compact={collapsed} />
                      {label}
                    </NavLink>
                  ) : (
                    <span className="flex items-center gap-2 opacity-80">
                      <IconSlot icon={r.icon} compact={collapsed} />
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* tree */}
      {!results && (
        <nav className="flex-1 overflow-y-auto" role="tree" aria-label="Application navigation">
          <ul className="menu p-2">
            {roots.map((n) => (
              <TreeNode
                key={n.id}
                node={n}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                byId={byId}
                parentMap={parentMap}
                refMap={refMap}
                focusedId={focusedId}
                setFocusedId={setFocusedId}
                activeId={activeId}
                onNavigate={handleNavigate}
                collapsed={collapsed}
              />
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

/* ---------------- tree node ---------------- */
function TreeNode({
  node, depth,
  expanded, toggle,
  byId, parentMap,
  refMap,
  focusedId, setFocusedId,
  activeId,
  onNavigate,
  collapsed,
}) {
  const isOpen = expanded.has(node.id);
  const hasKids = (node.children?.length || 0) > 0;
  const isActive = node.id === activeId;

  const selfRef = React.useCallback((el) => { if (el) refMap.current.set(node.id, el); }, [node.id, refMap]);

  const titleText = node.name;
  const showLabels = !collapsed;

  const common = {
    role: "treeitem",
    "aria-expanded": hasKids ? isOpen : undefined,
    "aria-current": isActive ? "page" : undefined,
    tabIndex: node.id === focusedId ? 0 : -1,
    ref: selfRef,
    onFocus: () => setFocusedId(node.id),
    className: cls(
      "flex items-center gap-2 px-2 py-1 rounded outline-none",
      isActive ? "bg-primary/10 text-primary" : "hover:bg-base-200"
    ),
    ...(showLabels ? { style: { paddingLeft: `${depth * 12}px` } } : {}),
  };

  return (
    <li>
      <div className="flex items-center">
        {showLabels ? (
          <button
            className={cls("btn btn-ghost btn-xs mr-1", hasKids ? "" : "invisible")}
            aria-label={isOpen ? "Collapse" : "Expand"}
            onClick={() => toggle(node.id)}
          >
            <span className="inline-block transition-transform" style={{ transform: `rotate(${isOpen ? 90 : 0}deg)` }}>▸</span>
          </button>
        ) : null}

        {node.path ? (
          <div className={cls(!showLabels && "tooltip tooltip-right")} data-tip={!showLabels ? titleText : undefined}>
            <NavLink to={node.path} {...common} onClick={() => onNavigate(node.path)}>
              <IconSlot icon={node.icon} compact={collapsed} />
              {showLabels && <span className="truncate">{node.name}</span>}
            </NavLink>
          </div>
        ) : (
          <div className={cls(!showLabels && "tooltip tooltip-right")} data-tip={!showLabels ? titleText : undefined}>
            <div {...common}>
              <IconSlot icon={node.icon} compact={collapsed} />
              {showLabels && <span className="truncate font-semibold">{node.name}</span>}
            </div>
          </div>
        )}
      </div>

      {hasKids && isOpen ? (
        <ul>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              byId={byId}
              parentMap={parentMap}
              refMap={refMap}
              focusedId={focusedId}
              setFocusedId={setFocusedId}
              activeId={activeId}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
