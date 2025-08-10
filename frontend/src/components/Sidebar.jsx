// components/Sidebar.jsx
import { NavLink } from "react-router-dom";

export default function Sidebar({ tree }) {
  return (
    <aside className="w-72 border-r bg-white dark:bg-zinc-900 dark:border-zinc-800 h-screen overflow-y-auto">
      <nav className="p-3 space-y-1">
        {tree.map(node => (
          <div key={node.id} className="mb-2">
            <div className="px-3 py-2 text-xs uppercase tracking-wide text-zinc-400">
              {node.icon ? `${node.icon} ` : ""}{node.label}
            </div>
            {node.children.map(child => (
              <NavLink
                key={child.id}
                to={child.path || "#"}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm
                   ${isActive ? "bg-zinc-100 dark:bg-zinc-800 font-medium" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`
                }
              >
                {child.icon ? `${child.icon} ` : ""}{child.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
