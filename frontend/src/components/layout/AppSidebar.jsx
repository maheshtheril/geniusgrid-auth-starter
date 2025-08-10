import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (!s.startsWith("/")) return "/" + s;
  return s.replace(/\/+$/,""); // no trailing slash
}
function pathParts(p) { return (normPath(p) || "").split("/").filter(Boolean); }
function isParentPath(p) { return pathParts(p).length === 2; } // e.g. /app/admin

// Build parent->children purely from path
function buildTreeByPath(items = []) {
  const rows = items.map(r => ({ ...r, path: normPath(r.path), children: [] }));
  const parents = rows.filter(r => r.path && isParentPath(r.path));
  const roots = [...parents];

  // Attach children whose path starts with parent.path + '/'
  for (const parent of parents) {
    const pref = parent.path + "/";
    const kids = rows.filter(r => r !== parent && r.path && r.path.startsWith(pref));
    // Only attach direct children (length === parentParts+1)
    const targetLen = pathParts(parent.path).length + 1;
    parent.children = kids.filter(k => pathParts(k.path).length === targetLen);
  }

  // Orphan leaves that don’t match any parent stay as roots
  const attachedIds = new Set(parents.flatMap(p => p.children.map(c => c.id)));
  for (const r of rows) {
    if (!parents.includes(r) && !attachedIds.has(r.id)) roots.push(r);
  }

  // Sort
  const cmp = (a,b)=>(a.sort_order??0)-(b.sort_order??0)||String(a.name).localeCompare(String(b.name));
  roots.sort(cmp);
  parents.forEach(p => p.children.sort(cmp));

  // Parent map for auto-open
  const byPath = new Map(rows.map(r => [r.path, r]));
  return { roots, parents, byPath };
}

function Caret({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden
      style={{ transform:`rotate(${open?90:0}deg)`, transition:"transform .18s ease" }}>
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Collapse({ open, children, id }) {
  const ref = useRef(null);
  const [h,setH] = useState(open ? "auto" : 0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (open) { const full = el.scrollHeight; setH(full); const t=setTimeout(()=>setH("auto"),180); return ()=>clearTimeout(t); }
    const full = el.scrollHeight; setH(full); requestAnimationFrame(()=>setH(0));
  }, [open, children?.length]);
  return (
    <div id={id} ref={ref} style={{
      maxHeight: typeof h==="number" ? h+"px" : h, overflow:"hidden", transition:"max-height .18s ease",
      marginLeft:10, paddingLeft:8, borderLeft:"1px solid rgba(255,255,255,.08)"
    }}>
      {children}
    </div>
  );
}

export default function AppSidebar() {
  const { menus } = useEnv();
  const { roots, parents, byPath } = useMemo(() => buildTreeByPath(menus), [menus]);
  const location = useLocation();

  // Persist open state by parent path
  const [open, setOpen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("__gg_menu_open_paths") || "[]")); }
    catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open_paths", JSON.stringify(Array.from(open)));
  }, [open]);

  // Auto-open the parent of the current route
  useEffect(() => {
    const cur = normPath(location.pathname);
    if (!cur) return;
    // find nearest parent segment: /app/{group}
    const parts = pathParts(cur);
    if (parts.length >= 2) {
      const parentPath = "/" + parts.slice(0,2).join("/");
      if (byPath.has(parentPath) && !open.has(parentPath)) {
        const next = new Set(open); next.add(parentPath); setOpen(next);
      }
    }
  }, [location.pathname, byPath, open]);

  const toggle = (parentPath) => setOpen(prev => {
    const n = new Set(prev); n.has(parentPath) ? n.delete(parentPath) : n.add(parentPath); return n;
  });

  const Leaf = ({ node, depth }) => (
    <div className="nav-node">
      <NavLink to={node.path || "#"} end
        className={({isActive})=>"nav-item"+(isActive?" active":"")}
        style={{ paddingLeft: 12 + depth*14 }}>
        <span style={{ width:12, display:"inline-block" }} />
        <span className="nav-dot" /> <span>{node.name}</span>
      </NavLink>
    </div>
  );

  const Group = ({ node, depth }) => {
    const parentPath = node.path;
    const isOpen = open.has(parentPath) || depth===0;
    return (
      <div className="nav-node">
        <button
          type="button"
          className="nav-item nav-toggle"
          style={{ paddingLeft: 12 + depth*14 }}
          onClick={() => toggle(parentPath)}
          onKeyDown={(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggle(parentPath); } }}
          aria-expanded={isOpen}
          aria-controls={`group-${parentPath}`}
        >
          <Caret open={isOpen} />
          <span className="nav-label">{node.name}</span>
          {node.path && (
            <NavLink to={node.path} className="nav-mini-link" onClick={(e)=>e.stopPropagation()}>
              Open
            </NavLink>
          )}
        </button>

        <Collapse open={isOpen} id={`group-${parentPath}`}>
          {node.children.map(ch =>
            parents.find(p => p.path === ch.path) // if a child is also parent-level (rare)
              ? <Group key={ch.id} node={ch} depth={depth+1}/>
              : <Leaf key={ch.id} node={ch} depth={depth+1}/>
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
          ? roots.map(n => (n.children?.length ? <Group key={n.id} node={n} depth={0}/> : <Leaf key={n.id} node={n} depth={0}/>))
          : <div className="text-muted">No menus</div>}
      </nav>
      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
