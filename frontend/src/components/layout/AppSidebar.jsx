import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import { useEnv } from "@/store/useEnv";

function toTree(items) {
  const map = new Map(items.map(i => [i.id, { ...i, children: [] }]));
  const roots = [];
  items.forEach(i => {
    if (i.parent_id && map.has(i.parent_id)) map.get(i.parent_id).children.push(map.get(i.id));
    else roots.push(map.get(i.id));
  });
  return roots;
}

function Item({ node, depth = 0 }) {
  const pad = 12 + depth * 14;
  const base = "nav-item";
  return (
    <div className="nav-node">
      {node.path ? (
        <NavLink
          to={node.path}
          end
          className={({ isActive }) => base + (isActive ? " active" : "")}
          style={{ paddingLeft: pad }}
        >
          <span className="nav-dot" /> {node.name}
        </NavLink>
      ) : (
        <div className="nav-section" style={{ paddingLeft: pad }}>{node.name}</div>
      )}
      {!!node.children?.length && (
        <div className="nav-children">
          {node.children.map(ch => <Item key={ch.id} node={ch} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function AppSidebar() {
  const { menus } = useEnv();
  const tree = useMemo(() => toTree(menus || []), [menus]);
  return (
    <aside className="app-sidebar panel glass">
      <div className="sidebar-head text-muted small">Menu</div>
      <nav className="nav-vertical">
        {tree.length ? tree.map(n => <Item key={n.id} node={n} />) : <div className="text-muted">No menus</div>}
      </nav>
      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
