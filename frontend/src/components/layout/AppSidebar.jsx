// -----------------------------------------------
// src/components/AppSidebar.jsx  (structure-first + brand header, pro edition)
// -----------------------------------------------
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";
import {
  Building, Key, Shield, Sliders, Code, Cpu, CreditCard, Phone,
  Users, Briefcase, BarChart, Sparkles, Globe, Calendar, Flag,
  Bell, Download, Database, Link as LinkIcon, ShoppingBag,
  KeyRound, Webhook, Settings, User, Layers, Puzzle
} from "lucide-react";

/* ---------------- helpers ---------------- */
const normPath = (p) => (p ? (p[0] === "/" ? p.replace(/\/+$/, "") : "/" + p) : null);
const parts = (p) => (normPath(p) || "").split("/").filter(Boolean);
const cmp = (a, b) =>
  (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0) ||
  String(a.name || "").localeCompare(String(b.name || ""));

const EMOJI_RE = /(\p{Extended_Pictographic})/u;
const isEmoji = (s) => typeof s === "string" && EMOJI_RE.test(s);

/* icon mapping (names -> lucide). Your data already uses emojis; this covers string names gracefully. */
const ICONS = {
  Building, Key, Shield, Sliders, Code, Cpu, CreditCard, Phone,
  Users, Briefcase, BarChart, Sparkles, Globe, Calendar, Flag,
  Bell, Download, Database, Link: LinkIcon, ShoppingBag, KeyRound,
  Webhook, Settings, User, Layers, Puzzle,
};
function Icon({ icon, className = "w-4 h-4" }) {
  if (!icon) return <span className="inline-block w-2 h-2 rounded-full bg-current/60" />;
  if (isEmoji(icon) || [...icon].length > 1 && !/^[A-Za-z]+$/.test(icon)) {
    return <span aria-hidden className="text-base leading-none">{icon}</span>;
  }
  const Keyed = ICONS[icon] || ICONS[icon?.replace(/(^\w)/, (m) => m.toUpperCase())];
  return Keyed ? <Keyed className={className} aria-hidden /> : <Layers className={className} aria-hidden />;
}

/* ---------------- normalize ---------------- */
function norm(row) {
  return {
    id: String(row.id ?? row.menu_id ?? row.menuId ?? row.code ?? Math.random().toString(36).slice(2)),
    code: String(row.code ?? row.name ?? ""),
    name: String(row.name ?? row.label ?? row.code ?? "Untitled"),
    path: normPath(row.path ?? row.url ?? row.route),
    icon: row.icon ?? null,
    sort_order: row.sort_order ?? row.order ?? 0,
    order: row.order ?? row.sort_order ?? 0,
    parent_id: row.parent_id ? String(row.parent_id) : null,
    parent_code: row.parent_code ?? null,
    module_code: row.module_code ?? row.moduleCode ?? null,
    module_type: row.module_type ?? row.moduleType ?? null,
  };
}

/* ---------------- tree builder ---------------- */
function buildTree(items = []) {
  const src = items.map(norm);
  const byId = Object.fromEntries(src.map((r) => [r.id, { ...r, children: [] }]));
  const byCode = {};
  Object.values(byId).forEach((n) => (byCode[n.code] = n));

  // infer parent_code from parent_id if missing
  for (const r of src) {
    if (!r.parent_code && r.parent_id && byId[r.parent_id]) {
      byId[r.id].parent_code = byId[r.parent_id].code;
    }
  }

  const roots = [];
  // attach using parent_id
  for (const r of src) {
    const node = byId[r.id];
    if (r.parent_id && byId[r.parent_id]) {
      const p = byId[r.parent_id];
      if (!p.children.some((c) => c.id === node.id)) p.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // attach using parent_code
  for (const r of src) {
    const node = byId[r.id];
    if ((!r.parent_id || !byId[r.parent_id]) && node.parent_code && byCode[node.parent_code]) {
      const p = byCode[node.parent_code];
      if (!p.children.some((c) => c.id === node.id)) p.children.push(node);
      const idx = roots.indexOf(node);
      if (idx >= 0) roots.splice(idx, 1);
    }
  }
  // path-based fallback (closest prefix)
  const rowsWithPath = Object.values(byId).filter((n) => n.path);
  const closestByPath = (child) => {
    if (!child.path) return null;
    const ps = parts(child.path);
    for (let i = ps.length - 1; i >= 1; i--) {
      const prefix = "/" + ps.slice(0, i).join("/");
      const cand = rowsWithPath.find((r) => r.path === prefix);
      if (cand && cand.id !== child.id) return cand;
    }
    return null;
  };
  for (const node of [...roots]) {
    const p = closestByPath(node);
    if (p) {
      if (!p.children.some((c) => c.id === node.id)) p.children.push(node);
      const idx = roots.indexOf(node);
      if (idx >= 0) roots.splice(idx, 1);
    }
  }

  // ensure Admin/CRM roots exist if any child or path indicates them
  const anyAdmin = src.some((r) => r.code === "admin" || r.code?.startsWith("admin.") || r.path?.startsWith("/app/admin"));
  const anyCrm   = src.some((r) => r.code === "crm"   || r.code?.startsWith("crm.")   || r.path?.startsWith("/app/crm"));
  function ensureRoot(code, name, path, icon, order = 10) {
    let node = Object.values(byId).find((n) => n.code === code);
    if (!node) {
      node = { id: `root:${code}`, code, name, path: normPath(path), icon, sort_order: order, order, children: [] };
      byId[node.id] = node;
      roots.push(node);
      byCode[code] = node;
    } else if (!roots.includes(node) && !Object.values(byId).some((p) => p.children?.includes(node))) {
      roots.push(node);
    }
    return node;
  }
  const adminRoot = anyAdmin ? ensureRoot("admin", "Admin", "/app/admin", "Settings", 10) : null;
  const crmRoot   = anyCrm   ? ensureRoot("crm",   "CRM",   "/app/crm",   "Handshake" /* will fallback to 🤝 */, 10) : null;

  // move stray admin.* & crm.* under their roots
  if (adminRoot) {
    Object.values(byId)
      .filter((n) => n.code?.startsWith("admin.") && n !== adminRoot)
      .forEach((n) => {
        const isTop = roots.includes(n);
        if (isTop && !adminRoot.children.some((c) => c.id === n.id)) {
          adminRoot.children.push(n);
          roots.splice(roots.indexOf(n), 1);
        }
      });
  }
  if (crmRoot) {
    Object.values(byId)
      .filter((n) => n.code?.startsWith("crm.") && n !== crmRoot)
      .forEach((n) => {
        const isTop = roots.includes(n);
        if (isTop && !crmRoot.children.some((c) => c.id === n.id)) {
          crmRoot.children.push(n);
          roots.splice(roots.indexOf(n), 1);
        }
      });
  }

  // sort deep
  const sortDeep = (arr) => {
    arr.sort(cmp);
    arr.forEach((n) => n.children?.length && sortDeep(n.children));
    return arr;
  };
  return sortDeep(roots);
}

/* ---------------- search (filter + highlight) ---------------- */
function matchScore(node, q) {
  const s = q.toLowerCase();
  const hay = `${node.name} ${node.code} ${node.path || ""}`.toLowerCase();
  if (!s) return 0;
  if (hay.includes(s)) return s.length;
  return 0;
}
function highlight(text, q) {
  if (!q) return text;
  const idx = String(text).toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const mid = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="bg-yellow-300/40 rounded px-0.5">{mid}</mark>
      {after}
    </>
  );
}
function flatten(nodes, parentTrail = []) {
  const out = [];
  for (const n of nodes) {
    const trail = [...parentTrail, n];
    out.push({ node: n, trail });
    if (n.children?.length) out.push(...flatten(n.children, trail));
  }
  return out;
}

/* ---------------- UI widgets ---------------- */
function Caret({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden
      style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .18s ease" }}>
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
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
      const t = setTimeout(() => setHeight("auto"), 180);
      return () => clearTimeout(t);
    } else {
      if (height === "auto") {
        setHeight(el.scrollHeight);
        requestAnimationFrame(() => setHeight(0));
      } else setHeight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div id={id} ref={ref}
      style={{ maxHeight: typeof height === "number" ? height + "px" : height,
               overflow: "hidden", transition: "max-height .18s ease",
               marginLeft: 10, paddingLeft: 8, borderLeft: "1px solid var(--border)", willChange: "max-height" }}>
      {children}
    </div>
  );
}

function Leaf({ node, depth, collapsed, onActiveRef }) {
  const location = useLocation();
  const isActive = node.path && location.pathname === node.path;
  const ref = useRef(null);
  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", inline: "nearest" });
      onActiveRef?.(ref.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <div className="nav-node" ref={ref}>
      <NavLink
        to={node.path || "#"}
        end
        className={({ isActive }) => "app-link" + (isActive ? " active" : "")}
        style={{ paddingLeft: 10 + depth * 14 }}
        data-active={isActive ? "true" : "false"}
        title={collapsed ? node.name : undefined}
      >
        <span className="mr-2 inline-flex items-center justify-center w-4"><Icon icon={node.icon} /></span>
        {!collapsed && <span>{node.name}</span>}
      </NavLink>
    </div>
  );
}

function Group({ node, depth, parents, openSet, setOpen, collapsed, onActiveRef }) {
  const parentKey = node.path || `__group__${node.code || node.id}`;
  const idSlug = `group_${(parentKey || "").replaceAll("/", "_")}`;
  const isOpen = openSet.has(parentKey);

  const toggle = () =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(parentKey) ? n.delete(parentKey) : n.add(parentKey);
      return n;
    });

  return (
    <div className="nav-node">
      <button
        type="button"
        className="app-link nav-toggle"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={idSlug}
        title={collapsed ? node.name : undefined}
      >
        <span className="mr-2 inline-flex items-center justify-center w-4"><Icon icon={node.icon} /></span>
        {!collapsed && <span className="nav-label">{node.name}</span>}
        {!collapsed && <span className="ml-auto opacity-60"><Caret open={isOpen} /></span>}
      </button>

      {!collapsed && (
        <Collapse open={isOpen} id={idSlug}>
          {node.children.map((ch) =>
            parents.has(ch) ? (
              <Group
                key={ch.id || ch.path}
                node={ch}
                depth={depth + 1}
                parents={parents}
                openSet={openSet}
                setOpen={setOpen}
                collapsed={collapsed}
                onActiveRef={onActiveRef}
              />
            ) : (
              <Leaf
                key={ch.id || ch.path}
                node={ch}
                depth={depth + 1}
                collapsed={collapsed}
                onActiveRef={onActiveRef}
              />
            )
          )}
        </Collapse>
      )}
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
export default function AppSidebar() {
  const { menus, branding, tenant, ui, saveUIState } = useEnv() || {};
  const location = useLocation();

  const appName   = branding?.app_name ?? branding?.appName ?? "GeniusGrid";
  const tenantName = tenant?.name ?? branding?.tenant_name ?? branding?.tenantName ?? "";
  const logoUrl    = branding?.logo_url ?? branding?.logoUrl ?? branding?.logo ?? null;

  const tree = useMemo(() => buildTree(menus || []), [menus]);

  // parent detection
  const allParents = useMemo(() => {
    const set = new Set();
    const walk = (nodes) => nodes.forEach((n) => { if (n.children?.length) set.add(n); if (n.children?.length) walk(n.children); });
    walk(tree);
    return set;
  }, [tree]);

  // compute keys needed to reveal current path
  const neededOpenKeys = useMemo(() => {
    if (!location?.pathname) return [];
    const pathNow = normPath(location.pathname);
    const flat = flatten(tree);
    const active = flat.find(({ node }) => node.path === pathNow);
    if (!active) return [];
    const keys = [];
    for (const anc of active.trail.slice(0, -1)) {
      keys.push(anc.path || `__group__${anc.code || anc.id}`);
    }
    return keys;
  }, [tree, location.pathname]);

  // open groups come from server ui state, merged with ancestors of active route
  const [open, setOpen] = useState(() => new Set([...(ui?.menuOpenKeys || []), ...neededOpenKeys]));
  useEffect(() => {
    // keep open set revealing current page's ancestors
    setOpen((prev) => new Set([...(prev || []), ...neededOpenKeys]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, neededOpenKeys.join("|")]);

  // persist to server (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      saveUIState?.({ menuOpenKeys: [...open] });
    }, 160);
    return () => clearTimeout(t);
  }, [open, saveUIState]);

  // collapsed (rail) state (server-driven; fallback false)
  const [collapsed, setCollapsed] = useState(!!ui?.sidebarCollapsed);
  useEffect(() => { if (typeof ui?.sidebarCollapsed === "boolean") setCollapsed(!!ui.sidebarCollapsed); }, [ui?.sidebarCollapsed]);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveUIState?.({ sidebarCollapsed: next });
  };

  // search
  const [q, setQ] = useState("");
  const flat = useMemo(() => flatten(tree), [tree]);
  const results = useMemo(() => {
    if (!q) return [];
    const scored = flat
      .map((r) => ({ ...r, score: matchScore(r.node, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || cmp(a.node, b.node));
    return scored.slice(0, 50);
  }, [flat, q]);

  const sidebarRef = useRef(null);
  const onActiveRef = () => {
    const el = sidebarRef.current;
    if (!el) return;
    const active = el.querySelector('.app-link.active');
    if (active) active.scrollIntoView({ block: "nearest" });
  };

  return (
    <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`} ref={sidebarRef}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 hover:bg-white/5 focus:outline-none"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Icon icon="Layers" />
        </button>

        <NavLink to="/app" className="flex items-center gap-3 flex-1 rounded-xl hover:bg-white/5 px-2 py-1">
          {logoUrl ? (
            <img src={logoUrl} alt={`${appName} logo`} className="w-8 h-8 rounded-md object-contain bg-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-md grid place-items-center bg-white/10 text-white/80 text-sm font-semibold">
              {String(appName).slice(0, 2).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">{appName}</div>
              {tenantName ? <div className="text-[11px] text-white/60 leading-tight truncate">{tenantName}</div> : null}
            </div>
          )}
        </NavLink>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <div className="relative">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={collapsed ? "Search…" : "Search menus…"}
            className="w-full px-3 py-1.5 text-sm rounded-md bg-white/10 outline-none focus:ring-2 ring-white/20 placeholder:text-white/50"
            aria-label="Search menus"
          />
          {q && (
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-white/70 hover:text-white"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-head">{collapsed ? "Menu" : "Menu"}</div>

      <nav className="app-nav">
        {q ? (
          results.length ? (
            <div className="px-2 py-1 text-xs text-white/60">{results.length} results</div>
          ) : (
            <div className="px-3 py-2 text-sm text-white/60">No matches</div>
          )
        ) : null}

        {/* Search results mode */}
        {q
          ? results.map(({ node, trail }) => (
              <div key={node.id} className="nav-node">
                <NavLink to={node.path || "#"} className="app-link">
                  <span className="mr-2 inline-flex items-center justify-center w-4"><Icon icon={node.icon} /></span>
                  {!collapsed && (
                    <span className="truncate">
                      {trail.slice(0, -1).map((t, i) => (
                        <span key={t.id} className="text-white/50">{t.name}{i < trail.length - 2 ? " › " : " › "}</span>
                      ))}
                      <strong>{highlight(node.name, q)}</strong>
                    </span>
                  )}
                </NavLink>
              </div>
            ))
          : tree.length ? (
              tree.map((n) =>
                allParents.has(n) ? (
                  <Group
                    key={n.id || n.path}
                    node={n}
                    depth={0}
                    parents={allParents}
                    openSet={open}
                    setOpen={setOpen}
                    collapsed={collapsed}
                    onActiveRef={onActiveRef}
                  />
                ) : (
                  <Leaf
                    key={n.id || n.path}
                    node={n}
                    depth={0}
                    collapsed={collapsed}
                    onActiveRef={onActiveRef}
                  />
                )
              )
            ) : (
              <div className="gg-muted px-3 py-2 text-sm">No menus</div>
            )}
      </nav>

      <div className="sidebar-foot">© {appName}</div>
    </aside>
  );
}

/* ---------------- tiny styles (optional, tweak to your design system) ----------------
.app-sidebar { width: 280px; min-width: 240px; max-width: 320px; overflow: auto; }
.app-sidebar.collapsed { width: 72px; min-width: 64px; }
.app-link { display:flex; align-items:center; gap:.5rem; padding:.4rem .5rem; border-radius:.5rem; color:inherit; text-decoration:none; }
.app-link:hover { background: rgba(255,255,255,.06); }
.app-link.active { background: rgba(255,255,255,.12); font-weight:600; }
.nav-toggle { width:100%; text-align:left; }
.sidebar-head, .sidebar-foot { padding:.5rem .75rem; font-size:11px; text-transform:uppercase; letter-spacing:.08em; opacity:.6; }
------------------------------------------------------------------------------- */
