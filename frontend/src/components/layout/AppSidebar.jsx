// src/components/layout/AppSidebar.jsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

/* ---------- constants ---------- */
const LS_EXPANDED = "gg:sidebar:expanded:v1";
const LS_PINS = "gg:sidebar:pins:v1"; // favorites
const INDENT_PX = 10; // indent
const ITEM_PAD_Y = "py-[2px]"; // tight vertical padding
const ENABLE_FLYOUT = (import.meta.env.VITE_SIDEBAR_FLYOUT ?? "1") === "1";

/* ---------- api helper (unchanged) ---------- */
function api(path) {
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  const base = raw ? raw.replace(/\/+$/, "") : "";
  const withApi = base ? (base.endsWith("/api") ? base : `${base}/api`) : "/api";
  return `${withApi}${path}`;
}

/* ---------- utils ---------- */
const cls = (...xs) => xs.filter(Boolean).join(" ");
const normalize = (s) => (s || "").toString().toLowerCase();

/* ---------- fuzzy + highlight (unchanged logic) ---------- */
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
      out.push(<mark key={i} className="bg-primary/20 text-primary rounded px-0.5">{ch}</mark>);
      qi++;
    } else out.push(<span key={i}>{ch}</span>);
    i++;
  }
  return out;
}

/* ---------- icons ---------- */
const ICON_SVGS = {
  settings: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 008.6 3.4 1.65 1.65 0 0010.11 2H10a2 2 0 014 0v.09a1.65 1.65 0 001.51 1 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>),
  sparkles: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 3.9L18 8.7l-3.3 2.4.9 4.2L12 13.8 8.4 15.3l.9-4.2L6 8.7l4.2-.8L12 3z" /><path d="M19 3.5l.7 1.6 1.7.3-1.4 1 .4 1.7-1.4-.8-1.4.8.4-1.7-1.4-1 1.7-.3.7-1.6z" /><path d="M5 17l.9 2 2.1.4-1.6 1.1.5 2.1L5 21.6 3.1 22.6l.5-2.1L2 19.4l2.1-.4L5 17z" /></svg>),
  shield:  (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-3 8-10V6l-8-3-8 3v6c0 7 8 10 8 10z" /></svg>),
  plug:    (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22v-6" /><path d="M9 7V2" /><path d="M15 7V2" /><path d="M7 7h10v3a5 5 0 1 1-10 0z" /></svg>),
  users:   (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  building:(<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01" /><path d="M13 10h.01" /></svg>),
  key:     (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5" /><path d="M14 12l7-7" /><path d="M15 5h6v6" /></svg>),
  webhooks:(<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 16a3 3 0 1 0 3 3" /><path d="M12 3a3 3 0 1 1-3 3" /><path d="M3 18a3 3 0 1 0 3-3" /><path d="M8 15l2-4 4 8 2-4" /></svg>),
  chart:   (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 13l3-3 4 4 5-7" /></svg>),
  creditcard:(<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" /></svg>),
  filetext:(<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>),
  flag:    (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22V15" /></svg>),
  phone:   (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3A2 2 0 0 1 19.82 22a19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.09 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.48-1.15a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92z" /></svg>),
};
const ICONS_ALIAS = {
  sparkles: "sparkles", ai: "sparkles", "ai-settings": "sparkles",
  shield: "shield", security: "shield", sso: "shield", lock: "shield",
  plug: "plug", integrations: "plug",
  users: "users", user: "users", contacts: "users", crm: "users",
  org: "building", building: "building", company: "building",
  "api-keys": "key", key: "key",
  webhook: "webhooks", webhooks: "webhooks",
  usage: "chart", reports: "chart", analytics: "chart",
  billing: "creditcard", "credit-card": "creditcard",
  logs: "filetext", templates: "filetext",
  "feature-flags": "flag", approvals: "flag", calls: "phone",
  admin: "settings",
};
function defaultIconByLabel(label) {
  const l = normalize(label);
  if (l === "admin") return ICON_SVGS.settings;
  if (l === "crm") return ICON_SVGS.users;
  if (l.includes("billing")) return ICON_SVGS.creditcard;
  if (l.includes("security") || l.includes("compliance")) return ICON_SVGS.shield;
  if (l.includes("integration") || l.includes("developer")) return ICON_SVGS.plug;
  if (l.includes("user") || l.includes("contact") || l.includes("team")) return ICON_SVGS.users;
  if (l.includes("org") || l.includes("organization")) return ICON_SVGS.building;
  if (l.includes("api")) return ICON_SVGS.key;
  if (l.includes("webhook")) return ICON_SVGS.webhooks;
  if (l.includes("report") || l.includes("usage")) return ICON_SVGS.chart;
  if (l.includes("template") || l.includes("log")) return ICON_SVGS.filetext;
  if (l.includes("flag") || l.includes("approval")) return ICON_SVGS.flag;
  if (l.includes("ai") || l.includes("automation")) return ICON_SVGS.sparkles;
  if (l.includes("call")) return ICON_SVGS.phone;
  return null;
}
function resolveIcon(icon) {
  if (!icon) return null;
  const raw = ("" + icon).trim();
  if (raw.includes("✨")) return ICON_SVGS.sparkles;
  const key = raw.replace(/:/g, "").toLowerCase();
  const name = ICONS_ALIAS[key] || key;
  if (ICON_SVGS[name]) return ICON_SVGS[name];
  if (/[\u{1F300}-\u{1FAFF}]/u.test(raw)) return <span aria-hidden="true">{raw}</span>;
  return null;
}
function IconSlot({ icon, label, compact }) {
  const resolved = resolveIcon(icon) || defaultIconByLabel(label);
  return (
    <span className={cls("shrink-0 inline-flex items-center justify-center", compact ? "w-6" : "w-5", "text-base-content/80")}>
      {resolved || (<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="opacity-70" aria-hidden="true"><circle cx="12" cy="12" r="3" /></svg>)}
    </span>
  );
}

/* ---- Expand/Collapse all icons (double chevrons) ---- */
const ExpandAllIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...props}
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 7l6 6 6-6" />
    <path d="M6 12l6 6 6-6" />
  </svg>
);
const CollapseAllIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...props}
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 17l-6-6-6 6" />
    <path d="M18 12l-6-6-6 6" />
  </svg>
);

/* ---------- smooth collapsible ---------- */
function Collapsible({ open, children }) {
  const ref = React.useRef(null);
  const [h, setH] = React.useState(open ? "auto" : 0);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
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
    <div ref={ref} style={{ height: h, overflow: "hidden", transition: "height 220ms cubic-bezier(.2,.9,.25,1.2)" }}>
      {children}
    </div>
  );
}

/* ---------- HMR-safe wrapper ---------- */
export default function AppSidebar(props) {
  const BUILD_KEY = import.meta.env.DEV ? import.meta.url : "prod";
  return <SidebarCore key={BUILD_KEY} {...props} />;
}

/* ---------- main component body ---------- */
function SidebarCore({ onRequestClose, collapsed = false, onToggleCollapse }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState(() => {
    try { const raw = localStorage.getItem(LS_EXPANDED); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr) ? arr : []); }
    catch { return new Set(); }
  });

  // favorites (pins)
  const [pins, setPins] = React.useState(() => {
    try { const raw = localStorage.getItem(LS_PINS); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr) ? arr : []); }
    catch { return new Set(); }
  });
  const togglePin = React.useCallback((id) => {
    setPins(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(LS_PINS, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const [focusedId, setFocusedId] = React.useState(null);
  const refMap = React.useRef(new Map());
  const searchRef = React.useRef(null);

  /* ---------- fetch menus (unchanged) ---------- */
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
      } catch (e) { if (!alive) return; setError(e); }
    })();
    return () => { alive = false; };
  }, []);

  /* ---------- persist expanded ---------- */
  React.useEffect(() => {
    try { localStorage.setItem(LS_EXPANDED, JSON.stringify([...expanded])); } catch {}
  }, [expanded]);

  /* ---------- build maps (unchanged logic) ---------- */
  const maps = React.useMemo(() => {
    const byId = Object.create(null);
    const parentMap = Object.create(null);
    const inOrder = (a, b) => {
      const s = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      return s !== 0 ? s : (a.name || "").localeCompare(b.name || "");
    };
    (items || []).forEach((i) => { byId[i.id] = { ...i, children: [] }; if (i.parent_id) parentMap[i.id] = i.parent_id; });
    (items || []).forEach((i) => { if (i.parent_id && byId[i.parent_id]) byId[i.parent_id].children.push(byId[i.id]); });
    Object.values(byId).forEach((n) => n.children.sort(inOrder));
    const roots = (items || []).filter((i) => !i.parent_id).map((i) => byId[i.id]).sort(inOrder);
    return { byId, parentMap, roots };
  }, [items]);

  const activeId = React.useMemo(() => {
    if (!items) return null;
    const best = items
      .filter((i) => i.path && pathname.startsWith(i.path))
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
    return best?.id || null;
  }, [items, pathname]);

  const visibleList = React.useMemo(() => {
    const vis = [];
    const walk = (node, depth) => {
      vis.push({ id: node.id, depth, node });
      if (expanded.has(node.id)) node.children.forEach((c) => walk(c, depth + 1));
    };
    maps.roots.forEach((r) => walk(r, 0));
    return vis;
  }, [maps.roots, expanded]);

  const lastAutoKey = React.useRef(null);
  React.useEffect(() => {
    if (!activeId) return;
    const key = String(activeId);
    if (lastAutoKey.current === key) return;
    lastAutoKey.current = key;
    setExpanded((prev) => {
      const next = new Set(prev);
      let p = maps.parentMap[activeId];
      while (p) { next.add(p); p = maps.parentMap[p]; }
      return next;
    });
  }, [activeId, maps.parentMap]);

  React.useEffect(() => {
    if (!focusedId && (activeId || visibleList[0]?.id)) setFocusedId(activeId || visibleList[0].id);
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
  const handleNavigate = (path) => { if (path) { navigate(path); onRequestClose?.(); } };

  // flat & search
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
    while (cur) { const n = maps.byId[cur]; if (!n) break; chain.push(n); cur = maps.parentMap[cur]; }
    return chain.reverse();
  };

  // pinned list (kept ABOVE guards)
  const pinned = React.useMemo(() => {
    if (!pins.size) return [];
    const list = [];
    pins.forEach((id) => {
      const n = maps.byId[id];
      if (n && n.path) list.push(n);
    });
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [pins, maps.byId]);

  // hotkeys: / or Cmd/Ctrl+K focus search
  React.useEffect(() => {
    const onKey = (e) => {
      const isCmdK = (e.key.toLowerCase() === 'k') && (e.metaKey || e.ctrlKey);
      if (e.key === '/' || isCmdK) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // —— hamburger handler: mobile hides, desktop collapses —— //
  const handleHamburger = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      onRequestClose?.();   // hide drawer on mobile/tablet
    } else {
      onToggleCollapse?.(); // collapse/expand width on desktop
    }
  };

  /* ---------- render ---------- */
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
    <div className="relative flex h-full flex-col text-sm gg-sidebar">
      <div className="gg-ambient" aria-hidden />

      {/* top bar */}
      <div className="p-2 border-b border-base-300 sticky top-0 bg-base-100/80 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <img src="/images/company-logo.png" alt="Company logo" className="w-12 h-12 rounded shadow-sm" draggable="false" />
            {showLabels && <span className="font-semibold truncate tracking-wide">GeniusGrid</span>}
          </div>

          <div className="flex-1" />

          {/* Sidebar hamburger (in sidebar). Mobile: closes drawer. Desktop: toggles collapse. */}
          <button
            className="btn btn-ghost btn-xs"
            onClick={handleHamburger}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            {/* hamburger icon */}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>

        {/* search */}
        <div className="mt-2 relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showLabels ? "Search…  ( /  or  ⌘/Ctrl+K )" : "Search"}
            className={cls(
              "input input-sm input-bordered w-full pr-10 rounded-xl",
              "bg-base-200/60 shadow-inner border-base-300/70",
              "focus:ring-2 focus:ring-primary/30 focus:outline-none",
              showLabels ? "" : "text-xs"
            )}
            aria-label="Search menu"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
        </div>

        {/* expand/collapse all (double chevrons) */}
        {showLabels && (
          <div className="mt-2 flex items-center gap-1">
            <button
              className="btn btn-ghost btn-xs gap-1 hover:text-primary"
              title="Expand all"
              onClick={() => {
                const next = new Set(expanded);
                (items || []).forEach((i) => {
                  if (items.find((x) => x.parent_id === i.id)) next.add(i.id);
                });
                setExpanded(next);
              }}
            >
              <ExpandAllIcon />
            </button>
            <button
              className="btn btn-ghost btn-xs gap-1 hover:text-secondary"
              title="Collapse all"
              onClick={() => setExpanded(new Set())}
            >
              <CollapseAllIcon />
            </button>
          </div>
        )}
      </div>

      {/* pinned favorites */}
      {showLabels && pinned.length > 0 && !results && (
        <div className="px-2 pt-2 overflow-x-auto thin-scroll">
          <div className="text-[11px] uppercase tracking-wider opacity-60 px-2 mb-1">Pinned</div>
          <div className="flex flex-nowrap gap-1.5 min-w-max">
            {pinned.map(n => (
              <NavLink
                key={n.id}
                to={n.path}
                onClick={() => onRequestClose?.()}
                className="inline-flex items-center gap-2 px-2 h-7 rounded-lg bg-base-200 hover:bg-base-300 transition shadow-sm"
                title={n.name}
              >
                <IconSlot icon={n.icon} label={n.name} compact={false} />
                <span className="truncate">{n.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(n.id); }}
                  className="ml-0.5 opacity-70 hover:opacity-100"
                  title="Unpin"
                >
                  ★
                </button>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* search results */}
      {results && (
        <div className="overflow-y-auto overflow-x-auto p-1 thin-scroll">
          <ul className="menu menu-compact p-1 min-w-max whitespace-nowrap">
            {results.map((r) => {
              const chain = crumb(r.id);
              const label = (showLabels
                ? <span className="truncate">{highlightSubseq(chain.at(-1)?.name || r.name, query)}</span>
                : null);
              const title = showLabels ? undefined : (chain.map((n) => n.name).join(" / ") || r.name);
              const isPinned = pins.has(r.id);
              return (
                <li key={r.id} className={cls(!showLabels && "tooltip tooltip-right")} data-tip={title}>
                  <div className="flex items-center justify-between">
                    {r.path ? (
                      <NavLink to={r.path} onClick={() => onRequestClose?.()} className={cls("flex items-center gap-1.5 px-2", ITEM_PAD_Y, "rounded hover:bg-base-200 transition")}>
                        <IconSlot icon={r.icon} label={r.name} compact={collapsed} />
                        {label}
                      </NavLink>
                    ) : (
                      <span className={cls("flex items-center gap-1.5 px-2 opacity-80", ITEM_PAD_Y)}>
                        <IconSlot icon={r.icon} label={r.name} compact={collapsed} />
                        {label}
                      </span>
                    )}
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => togglePin(r.id)}
                      aria-label={isPinned ? "Unpin" : "Pin"}
                      title={isPinned ? "Unpin" : "Pin"}
                    >{isPinned ? "★" : "☆"}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* tree */}
      {!results && (
        <nav className="flex-1 overflow-y-auto overflow-x-auto thin-scroll" role="tree" aria-label="Application navigation">
          <ul className="menu menu-compact p-1 min-w-max whitespace-nowrap">
            {maps.roots.map((n) => (
              <TreeNode
                key={n.id}
                node={n}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                refMap={refMap}
                focusedId={focusedId}
                setFocusedId={setFocusedId}
                activeId={activeId}
                onNavigate={handleNavigate}
                collapsed={collapsed}
                pins={pins}
                onTogglePin={togglePin}
              />
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

/* ---------- tree node ---------- */
function TreeNode({
  node, depth,
  expanded, toggle,
  refMap,
  focusedId, setFocusedId,
  activeId,
  onNavigate,
  collapsed,
  pins, onTogglePin,
}) {
  const isOpen = expanded.has(node.id);
  const hasKids = (node.children?.length || 0) > 0;
  const isActive = node.id === activeId;
  const isPinned = pins?.has(node.id);

  const selfRef = React.useCallback((el) => { if (el) refMap.current.set(node.id, el); }, [node.id, refMap]);
  const showLabels = !collapsed;
  const titleText = node.name;

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight" && hasKids && !isOpen) { e.preventDefault(); toggle(node.id); }
    else if (e.key === "ArrowLeft" && hasKids && isOpen) { e.preventDefault(); toggle(node.id); }
    else if ((e.key === "Enter" || e.key === " ") && node.path) { e.preventDefault(); onNavigate(node.path); }
    else if ((e.key === "Enter" || e.key === " ") && !node.path && hasKids) { e.preventDefault(); toggle(node.id); }
  };

  const common = {
    role: "treeitem",
    "aria-level": depth + 1,
    "aria-expanded": hasKids ? isOpen : undefined,
    "aria-current": isActive ? "page" : undefined,
    tabIndex: node.id === focusedId ? 0 : -1,
    ref: selfRef,
    onFocus: () => setFocusedId(node.id),
    onKeyDown,
    className: cls(
      "relative flex items-center gap-2 px-2 rounded-lg outline-none group/item gg-item",
      ITEM_PAD_Y,
      isActive ? "gg-item-active" : "gg-item-hover",
      "focus-visible:ring-2 focus-visible:ring-primary/30"
    ),
    ...(showLabels ? { style: { paddingLeft: `${depth * INDENT_PX}px` } } : {}),
    title: !showLabels ? titleText : undefined,
  };

  const Chevron = (
    <button
      className={cls(
        "mr-0.5 px-1 py-1 rounded-md hover:bg-base-200/70 transition-transform chev-spring",
        hasKids ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-label={isOpen ? "Collapse" : "Expand"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(node.id); }}
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-200 ease-out drop-shadow-sm"
        style={{ transform: `rotate(${isOpen ? 90 : 0}deg)` }}
      >
        <path d="M8 5l8 7-8 7" />
      </svg>
    </button>
  );

  const PinBtn = node.path && (
    <button
      className="ml-auto btn btn-ghost btn-xs opacity-0 group-hover/item:opacity-100 transition-opacity"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin?.(node.id); }}
      aria-label={isPinned ? "Unpin" : "Pin"}
      title={isPinned ? "Unpin" : "Pin"}
    >
      {isPinned ? "★" : "☆"}
    </button>
  );

  const LabelInner = (
    <>
      <IconSlot icon={node.icon} label={node.name} compact={collapsed} />
      {showLabels && (
        <span
          className={cls(
            "truncate",
            !node.path && "font-semibold uppercase tracking-wide text-xs opacity-80"
          )}
        >
          {node.name}
        </span>
      )}
      {PinBtn}
    </>
  );

  const enableFlyout = collapsed && ENABLE_FLYOUT && depth === 0 && hasKids;

  return (
    <li className={enableFlyout ? "relative group/fly" : undefined}>
      <div className="flex items-center gap-1">
        {showLabels ? Chevron : null}

        {node.path ? (
          <NavLink to={node.path} {...common} onClick={() => onNavigate(node.path)}>
            {LabelInner}
          </NavLink>
        ) : (
          <div {...common} onClick={() => { if (hasKids) toggle(node.id); }}>
            {LabelInner}
          </div>
        )}
      </div>

      {/* children (animated) */}
      {hasKids && !enableFlyout && (
        <Collapsible open={isOpen}>
          <ul>
            {node.children.map((c) => (
              <TreeNode
                key={c.id}
                node={c}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                refMap={refMap}
                focusedId={focusedId}
                setFocusedId={setFocusedId}
                activeId={activeId}
                onNavigate={onNavigate}
                collapsed={collapsed}
                pins={pins}
                onTogglePin={onTogglePin}
              />
            ))}
          </ul>
        </Collapsible>
      )}

      {/* collapsed flyout (top-level only) */}
      {enableFlyout && (
        <div className="absolute left-full top-0 ml-2 z-50 opacity-0 translate-y-2 scale-95 pointer-events-none group-hover/fly:opacity-100 group-hover/fly:translate-y-0 group-hover/fly:scale-100 group-hover/fly:pointer-events-auto transition duration-150">
          <div className="bg-base-100/95 backdrop-blur rounded-2xl shadow-xl border border-base-300 w-72 p-2">
            <ul className="menu menu-compact">
              {node.children.map((c) => (
                <li key={c.id}>
                  {c.path ? (
                    <NavLink
                      to={c.path}
                      onClick={() => onNavigate(c.path)}
                      className={cls("flex items-center gap-2 px-2", ITEM_PAD_Y, "rounded-lg hover:bg-base-200/70")}
                      title={c.name}
                    >
                      <IconSlot icon={c.icon} label={c.name} />
                      <span className="truncate">{c.name}</span>
                      <button
                        className="ml-auto btn btn-ghost btn-xs opacity-70 hover:opacity-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin?.(c.id); }}
                        title={pins?.has(c.id) ? "Unpin" : "Pin"}
                      >
                        {pins?.has(c.id) ? "★" : "☆"}
                      </button>
                    </NavLink>
                  ) : (
                    <span className={cls("flex items-center gap-2 px-2 opacity-80", ITEM_PAD_Y)}>
                      <IconSlot icon={c.icon} label={c.name} />
                      <span className="truncate">{c.name}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
