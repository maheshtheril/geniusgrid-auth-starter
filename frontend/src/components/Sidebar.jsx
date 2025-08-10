// -----------------------------------------------
// src/components/Sidebar.jsx (redesigned)
// -----------------------------------------------
import { NavLink } from "react-router-dom";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEnv } from "@/store/useEnv";
import Icon from "@/components/ui/Icon";

function buildTree(items) {
  const byId = Object.fromEntries(items.map((i) => [i.id, { ...i, children: [] }]));
  const roots = [];
  items.forEach((i) => {
    if (i.parent_id) byId[i.parent_id]?.children.push(byId[i.id]);
    else roots.push(byId[i.id]);
  });
  return roots;
}

function ItemLink({ node, depth = 0 }) {
  const pad = 8 + depth * 12;
  const hasChildren = node.children?.length > 0;
  const [open, setOpen] = useState(depth < 1); // auto-open level 0/1
  const iconName = node.icon?.replace(/(^.|-)(.)/g, (_, a, b) => b.toUpperCase()) || "Dot"; // crude name normalize

  return (
    <div>
      {node.path ? (
        <NavLink
          to={node.path}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all` +
            ` ${isActive ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"}`
          }
          style={{ paddingLeft: pad }}
          end
        >
          <Icon name={iconName} className="w-4 h-4 opacity-80" />
          <span className="truncate">{node.name}</span>
        </NavLink>
      ) : (
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5"
          style={{ paddingLeft: pad }}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={iconName} className="w-4 h-4 opacity-80" />
          <span className="flex-1 truncate">{node.name}</span>
          <Icon name={open ? "ChevronDown" : "ChevronRight"} className="w-4 h-4" />
        </button>
      )}

      {hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {node.children.map((ch) => (
                <ItemLink key={ch.id} node={ch} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { menus } = useEnv();
  const tree = useMemo(() => buildTree(menus || []), [menus]);

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10 p-3">
      <div className="px-2 py-1 text-xs uppercase tracking-wider text-white/40">Menu</div>
      <div className="mt-2 space-y-1">
        {tree.length ? (
          tree.map((node) => <ItemLink key={node.id} node={node} />)
        ) : (
          <div className="text-sm opacity-70">No menus</div>
        )}
      </div>
      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}