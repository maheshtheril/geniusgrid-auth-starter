// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

function iconByName(name) {
  if (!name) return IconSet.Dot;
  // try exact export, otherwise try PascalCase from kebab-case
  const try1 = IconSet[name];
  if (try1) return try1;
  const pascal = name
    .split(/[-_ ]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return IconSet[pascal] || IconSet.Dot;
}

function buildTree(items) {
  const byId = Object.fromEntries(items.map(i => [i.id, { ...i, children: [] }]));
  const roots = [];
  items.forEach(i => {
    if (i.parent_id) byId[i.parent_id]?.children.push(byId[i.id]);
    else roots.push(byId[i.id]);
  });
  return roots;
}

function NodeItem({ node, depth = 0, defaultOpen = false, onNavigate }) {
  const hasChildren = (node.children?.length || 0) > 0;
  const [open, setOpen] = useState(defaultOpen);
  const Icon = iconByName(node.icon);

  const pad = 12 + depth * 12;
  const baseCls =
    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";

  if (node.path) {
    return (
      <NavLink
        to={node.path}
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `${baseCls} ${
            isActive
              ? "bg-white/10 text-white"
              : "text-gray-300 hover:text-white hover:bg-white/5"
          }`
        }
        style={{ paddingLeft: pad }}
      >
        <Icon className="w-4 h-4 opacity-80" />
        <span className="truncate">{node.name}</span>
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={`${baseCls} text-gray-300 hover:text-white hover:bg-white/5 w-full text-left`}
        onClick={() => setOpen(v => !v)}
        style={{ paddingLeft: pad }}
      >
        <Icon className="w-4 h-4 opacity-80" />
        <span className="flex-1 truncate">{node.name}</span>
        {open ? <IconSet.ChevronDown className="w-4 h-4" /> : <IconSet.ChevronRight className="w-4 h-4" />}
      </button>

      {hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {node.children.map(ch => (
                <NodeItem key={ch.id} node={ch} depth={depth + 1} onNavigate={onNavigate} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default function TenantSidebar({ onNavigate }) {
  const { menus } = useEnv();
  const tree = useMemo(() => buildTree(menus || []), [menus]);

  return (
    <aside className="w-64 shrink-0 hidden md:flex md:flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10 p-3">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Menu</div>
      <div className="mt-2 space-y-1">
        {tree.length ? (
          tree.map(node => (
            <NodeItem key={node.id} node={node} defaultOpen={true} onNavigate={onNavigate} />
          ))
        ) : (
          <div className="text-sm opacity-70">No menus</div>
        )}
      </div>
      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}
