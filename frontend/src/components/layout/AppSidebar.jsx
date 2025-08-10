import { NavLink } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useEnv } from "@/store/useEnv";

function toTree(items) {
  const map = new Map(items.map(i => [i.id, { ...i, children: [] }]));
  const roots = [];
  items.forEach(i => {
    const n = map.get(i.id);
    if (i.parent_id && map.has(i.parent_id)) map.get(i.parent_id).children.push(n);
    else roots.push(n);
  });
  // order children by sort_order then name
  const sort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name));
  map.forEach(n => n.children.sort(sort));
  roots.sort(sort);
  return roots;
}

export default function AppSidebar() {
  const { menus } = useEnv();
  const tree = useMemo(() => toTree(menus || []), [menus]);

  // remember expanded nodes
  const [open, setOpen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("__gg_menu_open") || "[]")); }
    catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open", JSON.stringify(Array.from(open)));
  }, [open]);

  const toggle = (id) => setOpen(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const Node = ({ node, depth = 0 }) => {
    const hasChildren = (node.children?.length || 0) > 0;
    const padded = { paddingLeft: 12 + depth * 14 };
    const isOpen = open.has(node.id) || depth === 0; // open roots by default

    return (
      <div className="nav-node">
        {node.path ? (
          <NavLink to={node.path} end className={({isActive}) => "nav-item" + (isActive ? " active" : "")} style={padded}>
            <span className="nav-caret-spacer" />
            <span className="nav-dot" /> {node.name}
          </NavLink>
        ) : (
          <button type="button" className="nav-item nav-toggle" style={padded} onClick={() => toggle(node.id)}>
            <span className={"nav-caret" + (isOpen ? " open" : "")}>▸</span>
            <span className="nav-label">{node.name}</span>
          </button>
        )}

        {hasChildren && (
          <div className={"nav-children" + (isOpen ? " open" : "")}>
            {node.children.map(ch => <Node key={ch.id} node={ch} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="app-sidebar panel glass">
      <div className="sidebar-head text-muted small">Menu</div>
      <nav className="nav-vertical">
        {tree.length ? tree.map(n => <Node key={n.id} node={n} />) : <div className="text-muted">No menus</div>}
      </nav>
      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
