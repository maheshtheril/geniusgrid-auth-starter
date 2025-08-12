import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

function normPath(p){ if(!p) return null; const s=String(p).trim(); return s.startsWith("/")? s.replace(/\/+$/,"") : "/"+s; }
function pathParts(p){ return (normPath(p)||"").split("/").filter(Boolean); }

function isParentPath(p, items){
  const parts = pathParts(p);
  return items.some(r => r.path && r.path.startsWith(p+"/") && pathParts(r.path).length > parts.length);
}

function buildTreeByPath(items=[]){
  const rows = items.map(r => ({...r, path:normPath(r.path), children:[]}));
  const parents = rows.filter(r => r.path && isParentPath(r.path, rows));

  const roots = rows.filter(r =>
    !rows.some(other =>
      other.path &&
      r.path?.startsWith(other.path + "/") &&
      pathParts(other.path).length < pathParts(r.path).length
    )
  );

  for(const parent of parents){
    const pref = parent.path + "/";
    const kids = rows.filter(r => r!==parent && r.path && r.path.startsWith(pref));
    const targetLen = pathParts(parent.path).length + 1;
    parent.children = kids.filter(k => pathParts(k.path).length === targetLen);
  }

  const cmp = (a,b)=>(a.sort_order??0)-(b.sort_order??0) || String(a.name).localeCompare(String(b.name));
  roots.sort(cmp); parents.forEach(p => p.children.sort(cmp));

  return { roots, parents, byPath:new Map(rows.map(r=>[r.path,r])) };
}

function Caret({ open }){
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden
         style={{ transform:`rotate(${open?90:0}deg)`, transition:"transform .18s ease" }}>
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Collapse({ open, children, id }){
  const ref = useRef(null);
  const [height,setHeight] = useState(open ? "auto" : 0);

  useEffect(() => {
    const el = ref.current; if(!el) return;
    if(open){
      setHeight(el.scrollHeight);
      const t = setTimeout(()=>setHeight("auto"), 200);
      return () => clearTimeout(t);
    }else{
      if(height==="auto"){ setHeight(el.scrollHeight); requestAnimationFrame(()=>setHeight(0)); }
      else setHeight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div id={id} ref={ref}
         style={{
           maxHeight: typeof height==="number" ? height+"px" : height,
           overflow:"hidden", transition:"max-height .2s ease",
           marginLeft:10, paddingLeft:8, borderLeft:"1px solid var(--border)", /* ← theme */
           willChange:"max-height"
         }}>
      {children}
    </div>
  );
}

export default function AppSidebar(){
  const { menus } = useEnv();
  const { roots, parents } = useMemo(() => buildTreeByPath(menus), [menus]);
  useLocation(); // keeps NavLink active state in sync

  // Persisted open groups
  const [open, setOpen] = useState(() => {
    try{
      const raw = localStorage.getItem("__gg_menu_open_paths");
      return new Set(raw ? JSON.parse(raw) : []);
    }catch{ return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open_paths", JSON.stringify([...open]));
  }, [open]);

  const toggle = (parentPath) => setOpen(prev => {
    const n = new Set(prev); n.has(parentPath) ? n.delete(parentPath) : n.add(parentPath); return n;
  });

  const Leaf = ({ node, depth }) => (
    <div className="nav-node">
      <NavLink
        to={node.path || "#"} end
        className={({ isActive }) => "app-link" + (isActive ? " active" : "")}
        style={{ paddingLeft: 12 + depth*14 }}
      >
        <span className="nav-dot" />
        <span>{node.name}</span>
      </NavLink>
    </div>
  );

  const Group = ({ node, depth }) => {
    const parentPath = node.path;
    const idSlug = `group_${String(parentPath).replaceAll("/", "_")}`;
    const isOpen = open.has(parentPath); // ← only open if toggled

    return (
      <div className="nav-node">
        <button type="button"
                className="app-link nav-toggle"
                style={{ paddingLeft: 12 + depth*14 }}
                onClick={() => toggle(parentPath)}
                onKeyDown={(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggle(parentPath); } }}
                aria-expanded={isOpen} aria-controls={idSlug}>
          <Caret open={isOpen} />
          <span className="nav-label">{node.name}</span>
        </button>

        <Collapse open={isOpen} id={idSlug}>
          {node.children.map(ch =>
            parents.find(p => p.path === ch.path)
              ? <Group key={ch.id||ch.path} node={ch} depth={depth+1} />
              : <Leaf  key={ch.id||ch.path} node={ch} depth={depth+1} />
          )}
        </Collapse>
      </div>
    );
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-head">Menu</div>

      <nav className="app-nav">
        {roots.length
          ? roots.map(n => n.children?.length
              ? <Group key={n.id||n.path} node={n} depth={0} />
              : <Leaf  key={n.id||n.path} node={n} depth={0} />)
          : <div className="gg-muted px-3 py-2 text-sm">No menus</div>}
      </nav>

      <div className="sidebar-foot">© GeniusGrid</div>
    </aside>
  );
}
