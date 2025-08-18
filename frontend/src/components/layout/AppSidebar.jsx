// src/components/layout/AppSidebar.jsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

/* ---------------- helpers ---------------- */
const LS_EXPANDED = "gg:sidebar:expanded:v1";

// Ensure we always call /api even if VITE_API_URL is missing or incomplete
function api(path) {
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  const base = raw ? raw.replace(/\/+$/, "") : "";
  const withApi = base ? (base.endsWith("/api") ? base : `${base}/api`) : "/api";
  return `${withApi}${path}`;
}

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

/* ---------- icon resolver (no extra deps) ---------- */
const ICON_SVGS = {
  // minimal, crisp icons (24x24, stroke-current)
  sparkles: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 3.9L18 8.7l-3.3 2.4.9 4.2L12 13.8 8.4 15.3l.9-4.2L6 8.7l4.2-.8L12 3z"></path>
      <path d="M19 3.5l.7 1.6 1.7.3-1.4 1 .4 1.7-1.4-.8-1.4.8.4-1.7-1.4-1 1.7-.3.7-1.6z"></path>
      <path d="M5 17l.9 2 2.1.4-1.6 1.1.5 2.1L5 21.6 3.1 22.6l.5-2.1L2 19.4l2.1-.4L5 17z"></path>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-3 8-10V6l-8-3-8 3v6c0 7 8 10 8 10z"></path>
    </svg>
  ),
  plug: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22v-6"></path><path d="M9 7V2"></path><path d="M15 7V2"></path>
      <path d="M7 7h10v3a5 5 0 1 1-10 0z"></path>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18"></path><path d="M4 21V8l8-5 8 5v13"></path>
      <path d="M9 21v-6h6v6"></path><path d="M9 10h.01"></path><path d="M13 10h.01"></path>
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5"></circle>
      <path d="M14 12l7-7"></path><path d="M15 5h6v6"></path>
    </svg>
  ),
  webhooks: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 16a3 3 0 1 0 3 3"></path>
      <path d="M12 3a3 3 0 1 1-3 3"></path>
      <path d="M3 18a3 3 0 1 0 3-3"></path>
      <path d="M8 15l2-4 4 8 2-4"></path>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18"></path>
      <path d="M7 13l3-3 4 4 5-7"></path>
    </svg>
  ),
  creditcard: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
      <path d="M2 10h20"></path>
    </svg>
  ),
  filetext: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12V8z"></path>
      <path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path>
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
      <path d="M4 22V15"></path>
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.09 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.48-1.15a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92z"></path>
    </svg>
  ),
};

// try to map a lot of possible icon strings to consistent SVGs
function resolveIcon(icon) {
  if (!icon) return null;
  const raw = ("" + icon).trim();

  // emojis → map sparkles to svg for consistency
  if (raw.includes("✨")) return ICON_SVGS.sparkles;

  // :sparkles: or sparkles
  const key = raw.replace(/:/g, "").toLowerCase();
  if (ICONS_ALIAS[key]) return ICON_SVGS[ICONS_ALIAS[key]];

  // if it looks like a single emoji (not ASCII), still allow it
  if (/[\u{1F300}-\u{1FAFF}]/u.test(raw)) return <span aria-hidden="true">{raw}</span>;

  // fallback dot
  return null;
}

const ICONS_ALIAS = {
  // common names used in your dataset
  sparkles: "sparkles",
  ai: "sparkles",
  "ai-settings": "sparkles",
  shield: "shield",
  security: "shield",
  sso: "shield",
  lock: "shield",
  plug: "plug",
  integrations: "plug",
  users: "users",
  user: "users",
  org: "building",
  building: "building",
  company: "building",
  "api-keys": "key",
  key: "key",
  webhook: "webhooks",
  webhooks: "webhooks",
  usage: "chart",
  reports: "chart",
  analytics: "chart",
  billing: "creditcard",
  "credit-card": "creditcard",
  logs: "filetext",
  templates: "filetext",
  "feature-flags": "flag",
  calls: "phone",
};

// icon slot with consistent width
function IconSlot({ icon, compact }) {
  const resolved = resolveIcon(icon);
  return (
    <span className={cls("shrink-0 inline-flex items-center justify-center", compact ? "w-6" : "w-5")}>
      {resolved || (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="opacity-70" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </span>
  );
}

/* ---------- polished collapsible (smooth height) ---------- */
function Collapsible({ open, children }) {
  const ref = React.useRef(null);
  const [h, setH] = React.useState(open ? "auto" : 0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const sh = el.scrollHeight;
      setH(sh);
      const t = setTimeout(() => setH("auto"), 200);
      return () => clearTimeout(t);
    } else {
      const sh = el.scrollHeight;
      setH(sh);
      requestAnimationFrame(() => setH(0));
    }
  }, [open]);

  return (
    <div
      ref={ref}
      style={{ height: h, overflow: "hidden", transition: "height 200ms ease" }}
    >
      {children}
    </div>
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
      const url = api("/tenant/menus");
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

    // visible linear list (for focus management)
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
          {/* collapse toggle (desktop) */}
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

        {/* expand/collapse all for tree (hidden in mini to keep tidy) */}
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

  // keyboard polish: arrows + enter/space to toggle/navigate
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight" && hasKids && !isOpen) { e.preventDefault(); toggle(node.id); }
    else if (e.key === "ArrowLeft" && hasKids && isOpen) { e.preventDefault(); toggle(node.id); }
    else if ((e.key === "Enter" || e.key === " ") && node.path) { e.preventDefault(); onNavigate(node.path); }
  };

  const common = {
    role: "treeitem",
    "aria-expanded": hasKids ? isOpen : undefined,
    "aria-current": isActive ? "page" : undefined,
    tabIndex: node.id === focusedId ? 0 : -1,
    ref: selfRef,
    onFocus: () => setFocusedId(node.id),
    onKeyDown,
    className: cls(
      "relative flex items-center gap-2 px-2 py-1 rounded outline-none transition-all duration-200",
      isActive ? "bg-primary/10 text-primary" : "hover:bg-base-200",
      // slim left active bar
      isActive && "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded"
    ),
    ...(showLabels ? { style: { paddingLeft: `${depth * 12}px` } } : {}),
  };

  return (
    <li>
      <div className="flex items-center">
        {/* disclosure (hide in mini) */}
        {showLabels ? (
          <button
            className={cls(
              "btn btn-ghost btn-xs mr-1 transition-transform duration-200",
              hasKids ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            aria-label={isOpen ? "Collapse" : "Expand"}
            onClick={() => toggle(node.id)}
          >
            <span
              className="inline-block transition-transform"
              style={{ transform: `rotate(${isOpen ? 90 : 0}deg)` }}
            >▸</span>
          </button>
        ) : null}

        {/* item */}
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

      {/* children (smooth) */}
      {hasKids && (
        <Collapsible open={isOpen}>
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
        </Collapsible>
      )}
    </li>
  );
}
