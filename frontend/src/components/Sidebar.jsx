// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import { useEnv } from "../store/useEnv";

function buildTree(items) {
  const byId = Object.fromEntries(items.map(i => [i.id, { ...i, children: [] }]));
  const roots = [];
  items.forEach(i => {
    if (i.parent_id) byId[i.parent_id]?.children.push(byId[i.id]);
    else roots.push(byId[i.id]);
  });
  return roots;
}

export default function Sidebar() {
  const { menus } = useEnv();
  const tree = useMemo(() => buildTree(menus), [menus]);

  return (
    <aside className="w-64 border-r p-3">
      {tree.map(node => (
        <MenuNode key={node.id} node={node} />
      ))}
    </aside>
  );
}

function MenuNode({ node }) {
  return (
    <div className="mb-2">
      {node.path && (
        <NavLink className={({isActive}) => `block px-2 py-1 rounded ${isActive?"bg-gray-200":""}`} to={node.path}>
          {node.name}
        </NavLink>
      )}
      {!!node.children?.length && (
        <div className="ml-3 border-l pl-2">
          {node.children.map(ch => <MenuNode key={ch.id} node={ch} />)}
        </div>
      )}
    </div>
  );
}