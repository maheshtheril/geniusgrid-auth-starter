import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/** Build a robust tree: uses parent_id; if missing, infers from dotted code like "admin.users" -> parent "admin" */
function buildTree(items) {
  const rows = (items || []).map(r => ({ ...r, children: [] }));
  const byId = new Map(rows.map(r => [r.id, r]));
  const byCode = new Map(rows.map(r => [r.code, r]));

  // infer parent if not set
  for (const r of rows) {
    if (!r.parent_id && typeof r.code === "string" && r.code.includes(".")) {
      const parentCode = r.code.split(".")[0]; // "admin.users" -> "admin"
      const parent = byCode.get(parentCode);
      if (parent && parent.id !== r.id) r.parent_id = parent.id;
    }
  }

  const roots = [];
  for (const r of rows) {
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(r);
    else roots.push(r);
  }

  const cmp = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.name).localeCompare(String(b.name));

  const sortRec = (n) => { n.children.sort(cmp); n.children.forEach(sortRec); };
  roots.sort(cmp); roots.forEach(sortRec);

  return { roots, byId };
}

/** Small caret icon (no deps) */
function Caret({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden
         style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .18s ease" }}>
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Height transition wrapper for smooth collapse */
function Collapse({ open, children, id }) {
  const ref = useRef(null);
  const [h, setH] = useState(open ? "auto" : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const full = el.scrollHeight;
      setH(full);
      const t = setTimeout(() => setH("auto"), 180);
      return () => clearTimeout(t);
    } else {
      const full = el.scrollHeight;
      setH(full);
      requestAnimationFrame(() => setH(0));
    }
  }, [open, children?.length]);

  return (
    <div id={id} ref={ref}
         style={{
           maxHeight: typeof h === "number" ? h + "px" : h,
           overflow: "hidden",
           transition: "max-height .18s ease",
           marginLeft: 10, paddingLeft: 8,
           borderLeft: "1px solid rgba(255,255,255,.08)"
         }}>
      {children}
    </div>
  );
}

export default function AppSidebar() {
  const { menus } = useEnv();
  const { roots, byId } = useMemo(() => buildTree(menus), [menus]);
  const location = useLocation();

  // open state persists
  const [open, setOpen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("__gg_menu_open") || "[]")); }
    catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open", JSON.stringify(Array.from(open)));
  }, [open]);

  // auto-open parents for current route
  useEffect(() => {
    if (!menus?.length) return;
    const active = menus.find(m => m.path && location.pathname.startsWith(m.path));
    if (!active) return;
    const next = new Set(open);
    let cur = active;
    for (let guard = 0; guard < 50 && cur?.parent_id; guard++) {
      next.add(cur.parent_id);
      cur = byId.get(cur.parent_id);
    }
    if (next.size !== open.size) setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, menus]);

  const toggle = (id) => setOpen(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const Leaf = ({ node, depth }) => (
    <div className="nav-node">
      <NavLink
        to={node.path || "#"}
        end
        className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        style={{ paddingLeft: 12 + depth * 14 }}>
        <span style={{ width: 12, display: "inline-block" }} />
        <span className="nav-dot" /> <span>{node.name}</span>
      </NavLink>
    </div>
  );

  const Group = ({ node, depth }) => {
    const isOpen = open.has(node.id) || depth === 0; // roots open by default
    return (
      <div className="nav-node">
        <button
          type="button"
          className="nav-item nav-toggle"
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => toggle(node.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(node.id); } }}
          aria-expanded={isOpen}
          aria-controls={`group-${node.id}`}>
          <Caret open={isOpen} />
          <span className="nav-label">{node.name}</span>
          {node.path && (
            <NavLink to={node.path} className="nav-mini-link" onClick={(e) => e.stopPropagation()}>
              Open
            </NavLink>
          )}
        </button>

        <Collapse open={isOpen} id={`group-${node.id}`}>
          {node.children.map(ch =>
            ch.children?.length ? (
              <Group key={ch.id} node={ch} depth={depth + 1} />
            ) : (
              <Leaf key={ch.id} node={ch} depth={depth + 1} />
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
        {roots.length
          ? roots.map(n => (n.children?.length ? <Group key={n.id} node={n} depth={0} /> : <Leaf key={n.id} node={n} depth={0} />))
          : <div className="text-muted">No menus</div>}
      </nav>
      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
