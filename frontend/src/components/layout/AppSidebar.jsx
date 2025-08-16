// -----------------------------------------------
// src/components/AppSidebar.jsx  (DB-first, no hardcoded sections)
// -----------------------------------------------
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ------------- tiny helpers ------------- */
function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
}
function pathParts(p) {
  return (normPath(p) || "").split("/").filter(Boolean);
}
const cmp = (a, b) =>
  (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0) ||
  String(a.name || "").localeCompare(String(b.name || ""));

/* ------------- normalize a DB row exactly (no assumptions) ------------- */
function norm(row) {
  const codeRaw = String(row.code ?? row.name ?? "").trim();
  const parentCodeRaw = row.parent_code != null ? String(row.parent_code).trim() : null;
  const moduleRaw = row.module ?? row.module_code ?? row.moduleCode ?? null;

  return {
    id: String(row.id ?? row.menu_id ?? row.menuId ?? row.code ?? Math.random().toString(36).slice(2)),
    code: codeRaw,
    code_lc: codeRaw.toLowerCase(),
    parent_code: parentCodeRaw,
    parent_code_lc: parentCodeRaw ? parentCodeRaw.toLowerCase() : null,
    name: String(row.name ?? row.label ?? row.code ?? "Untitled"),
    path: normPath(row.path ?? row.url ?? row.route),
    icon: row.icon ?? null,
    sort_order: row.sort_order ?? row.order ?? 0,
    order: row.order ?? row.sort_order ?? 0,
    parent_id: row.parent_id ? String(row.parent_id) : null,
    module_hint: moduleRaw ? String(moduleRaw) : null,
    module_hint_lc: moduleRaw ? String(moduleRaw).toLowerCase() : null,
    type: row.type ?? null, // some of your rows use 'group' or 'item'
  };
}

/* ------------- build tree purely from DB; synthesize missing roots per module if needed ------------- */
function buildTree(items = []) {
  // Normalize just what's needed (match your DB columns exactly)
  const src = (items || []).map((row) => ({
    id: String(row.id),                                     // menu_templates.id
    code: String(row.code ?? ""),                           // menu_templates.code
    name: String(row.name ?? row.label ?? row.code ?? "Untitled"),
    path: normPath(row.path ?? row.url ?? row.route),       // menu_templates.path
    icon: row.icon ?? null,                                  // menu_templates.icon
    sort_order: row.sort_order ?? row.order ?? 0,           // menu_templates.sort_order
    order: row.order ?? row.sort_order ?? 0,
    parent_id: row.parent_id ? String(row.parent_id) : null // menu_templates.parent_id
  }));

  // Index by id
  const byId = Object.fromEntries(src.map(r => [r.id, { ...r, children: [] }]));

  // Attach strictly by parent_id; if parent missing/not assigned, it’s a root
  const roots = [];
  for (const r of src) {
    const node = byId[r.id];
    if (r.parent_id && byId[r.parent_id]) {
      byId[r.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Deep sort (by sort_order then name)
  const sortDeep = (arr) => {
    arr.sort((a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      String(a.name || "").localeCompare(String(b.name || ""))
    );
    arr.forEach((n) => n.children?.length && sortDeep(n.children));
    return arr;
  };

  return sortDeep(roots);
}



/* ------------- UI widgets ------------- */
function Caret({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden
         style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .18s ease" }}>
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
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
      const t = setTimeout(() => setHeight("auto"), 200);
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
         style={{
           maxHeight: typeof height === "number" ? height + "px" : height,
           overflow: "hidden",
           transition: "max-height .2s ease",
           marginLeft: 10, paddingLeft: 8,
           borderLeft: "1px solid var(--border)",
           willChange: "max-height", contain: "layout",
         }}>
      {children}
    </div>
  );
}

function NodeIcon({ icon }) {
  if (!icon) return <span className="nav-dot" />;
  return <span className="nav-emoji" aria-hidden>{icon}</span>;
}

/* ------------- Leaf/Group items ------------- */
function Leaf({ node, depth, onActiveRef }) {
  const location = useLocation();
  const ref = useRef(null);
  useEffect(() => {
    const isActive = node.path && location.pathname === node.path;
    if (isActive && ref.current && onActiveRef) onActiveRef(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, node.path]);

  return (
    <div className="nav-node" ref={ref}>
      <NavLink to={node.path || "#"} end
               className={({ isActive }) => "app-link" + (isActive ? " active" : "")}
               style={{ paddingLeft: 12 + depth * 14 }}>
        <NodeIcon icon={node.icon} />
        <span className="truncate">{node.name}</span>
      </NavLink>
    </div>
  );
}

function Group({ node, depth, parents, openSet, setOpen, onActiveRef }) {
  const parentKey = node.path || `__group__${node.code || node.id}`;
  const idSlug = `group_${parentKey.replaceAll("/", "_")}`;
  const isOpen = openSet.has(parentKey);

  const toggle = () =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(parentKey) ? n.delete(parentKey) : n.add(parentKey);
      return n;
    });

  return (
    <div className="nav-node">
      <button type="button" className="app-link nav-toggle"
              style={{ paddingLeft: 12 + depth * 14 }}
              onClick={toggle} aria-expanded={isOpen} aria-controls={idSlug}
              title={node.name}>
        <NodeIcon icon={node.icon} />
        <span className="nav-label truncate">{node.name}</span>
        <span className="ml-auto opacity-60"><Caret open={isOpen} /></span>
      </button>
      <Collapse open={isOpen} id={idSlug}>
        {node.children.map((ch) =>
          parents.has(ch) ? (
            <Group key={ch.id || ch.path} node={ch} depth={depth + 1}
                   parents={parents} openSet={openSet} setOpen={setOpen}
                   onActiveRef={onActiveRef} />
          ) : (
            <Leaf key={ch.id || ch.path} node={ch} depth={depth + 1}
                  onActiveRef={onActiveRef} />
          )
        )}
      </Collapse>
    </div>
  );
}

/* ------------- Sidebar ------------- */
export default function AppSidebar() {
  const { menus, branding, tenant } = useEnv() || {};
  const tree = useMemo(() => buildTree(menus || []), [menus]);

  // determine which nodes are parents
  const allParents = useMemo(() => {
    const set = new Set();
    const scan = (nodes) => {
      nodes.forEach((n) => {
        if (n.children?.length) set.add(n);
        n.children?.length && scan(n.children);
      });
    };
    scan(tree);
    return set;
  }, [tree]);

  useLocation(); // keep NavLink active state in sync

  // Persisted open groups
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem("__gg_menu_open_keys");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open_keys", JSON.stringify([...open]));
  }, [open]);

  // ---- vertical scroll only (inside .nav-scroll) ----
  const scrollAreaRef = useRef(null);
  const onActiveRef = (el) => {
    const scroller = scrollAreaRef.current;
    if (!scroller || !el) return;
    const elRect = el.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    const above = elRect.top < scRect.top;
    const below = elRect.bottom > scRect.bottom;
    if (above || below) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };

  // Brand header (falls back gracefully)
  const appName    = branding?.app_name || branding?.appName || "GeniusGrid";
  const tenantName = tenant?.name || branding?.tenant_name || branding?.tenantName || "";
  const logoUrl    = branding?.logo_url || branding?.logoUrl || branding?.logo || null;

  return (
    <aside className="app-sidebar"
           style={{
             display: "flex", flexDirection: "column",
             height: "100dvh", minHeight: 0, width: 280, maxWidth: 320,
             borderRight: "1px solid var(--border)", overflow: "hidden",
           }}>
      {/* ---- Brand header ---- */}
      <NavLink to="/app" className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl hover:bg-white/5">
        {logoUrl ? (
          <img src={logoUrl} alt={`${appName} logo`} className="w-8 h-8 rounded-md object-contain bg-white/10" />
        ) : (
          <div className="w-8 h-8 rounded-md grid place-items-center bg-white/10 text-white/80 text-sm font-semibold">
            {String(appName).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">{appName}</div>
          {tenantName ? <div className="text-[11px] text-white/60 leading-tight truncate">{tenantName}</div> : null}
        </div>
      </NavLink>

      {/* ---- Scrollable middle (vertical only) ---- */}
      <div className="nav-scroll" ref={scrollAreaRef}
           style={{
             flex: "1 1 auto", minHeight: 0,
             overflowY: "auto", overflowX: "hidden",
             overscrollBehavior: "contain", scrollBehavior: "smooth",
             paddingBottom: "0.75rem",
           }}>
        <div className="sidebar-head px-3 py-1 text-xs uppercase opacity-70">Menu</div>

        <nav className="app-nav" style={{ paddingRight: 8 }}>
          {tree.length ? (
            tree.map((n) =>
              allParents.has(n) ? (
                <Group key={n.id || n.path} node={n} depth={0}
                       parents={allParents} openSet={open} setOpen={setOpen}
                       onActiveRef={onActiveRef} />
              ) : (
                <Leaf key={n.id || n.path} node={n} depth={0} onActiveRef={onActiveRef} />
              )
            )
          ) : (
            <div className="gg-muted px-3 py-2 text-sm">No menus</div>
          )}
        </nav>
      </div>

      {/* ---- Footer (does not scroll) ---- */}
      <div className="sidebar-foot px-3 py-2 text-xs opacity-70">© {appName}</div>
    </aside>
  );
}
