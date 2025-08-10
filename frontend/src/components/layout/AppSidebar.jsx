import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useEnv } from "@/store/useEnv";

/** Build a tree from menus (uses parent_id). */
function buildTree(items) {
  const map = new Map(items.map(i => [i.id, { ...i, children: [] }]));
  const roots = [];
  items.forEach(i => {
    const n = map.get(i.id);
    if (i.parent_id && map.has(i.parent_id)) map.get(i.parent_id).children.push(n);
    else roots.push(n);
  });
  const cmp = (a,b)=>(a.sort_order??0)-(b.sort_order??0)||String(a.name).localeCompare(String(b.name));
  map.forEach(n => n.children.sort(cmp));
  roots.sort(cmp);
  return { roots, map };
}

export default function AppSidebar() {
  const { menus } = useEnv();
  const { roots, map } = useMemo(() => buildTree(menus || []), [menus]);
  const location = useLocation();

  // remember expanded groups
  const [open, setOpen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("__gg_menu_open") || "[]")); }
    catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open", JSON.stringify(Array.from(open)));
  }, [open]);

  // auto-open parents that contain current route
  useEffect(() => {
    if (!menus?.length) return;
    const active = menus.find(m => m.path && location.pathname.startsWith(m.path));
    if (!active) return;
    const next = new Set(open);
    let cur = active;
    for (let guard=0; guard<50 && cur?.parent_id; guard++) {
      next.add(cur.parent_id);
      cur = map.get(cur.parent_id);
    }
    if (next.size !== open.size) setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, menus]);

  const toggle = (id) => setOpen(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const Node = ({ node, depth = 0 }) => {
    const hasChildren = (node.children?.length || 0) > 0;
    const isOpen = open.has(node.id) || depth === 0; // root open by default
    const pad = { paddingLeft: 12 + depth * 14 };

    // Parent group → toggle row (caret + optional inline "Open" link)
    if (hasChildren) {
      return (
        <div className="nav-node">
          <button
            type="button"
            className="nav-item nav-toggle"
            style={pad}
            onClick={() => toggle(node.id)}
            aria-expanded={isOpen}
            aria-controls={`group-${node.id}`}
          >
            <span className={"nav-caret" + (isOpen ? " open" : "")}>▸</span>
            <span className="nav-label">{node.name}</span>
            {node.path && (
              <NavLink
                to={node.path}
                className="nav-mini-link"
                onClick={(e)=>e.stopPropagation()}
              >
                Open
              </NavLink>
            )}
          </button>

          <div id={`group-${node.id}`} className={"nav-children" + (isOpen ? " open" : "")}>
            {node.children.map(ch => <Node key={ch.id} node={ch} depth={depth + 1} />)}
          </div>
        </div>
      );
    }

    // Leaf → regular link
    return (
      <div className="nav-node">
        <NavLink
          to={node.path || "#"}
          end
          className={({isActive}) => "nav-item" + (isActive ? " active" : "")}
          style={pad}
        >
          <span className="nav-caret-spacer" />
          <span className="nav-dot" /> {node.name}
        </NavLink>
      </div>
    );
  };

  return (
    <aside className="app-sidebar panel glass">
      <div className="sidebar-head text-muted small">Menu</div>
      <nav className="nav-vertical">
        {roots.length ? roots.map(n => <Node key={n.id} node={n} />) : <div className="text-muted">No menus</div>}
      </nav>
      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
