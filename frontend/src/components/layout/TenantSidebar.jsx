// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ----------------------------- Icons ----------------------------- */

function EmojiIcon({ glyph, className }) {
  return (
    <span className={`inline-flex items-center justify-center ${className || ""}`} aria-hidden="true">
      {glyph}
    </span>
  );
}

function isEmoji(str) {
  if (!str) return false;
  try { return /[\p{Extended_Pictographic}]/u.test(str); } catch { return /[^\w\s]/.test(str); }
}

function iconByName(name) {
  if (!name) return IconSet.Dot;
  if (isEmoji(name)) return (props) => <EmojiIcon glyph={name} {...props} />;
  if (IconSet[name]) return IconSet[name];
  const pascal = String(name).split(/[-_ ]+/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
  return IconSet[pascal] || IconSet.Dot;
}

/* ----------------------------- Tree ----------------------------- */

function normalizeItem(i) {
  // accept snake_case or camelCase from API
  const id         = i.id ?? i.menu_id ?? i.menuId;
  const parent_id  = i.parent_id ?? i.parentId ?? null;
  const name       = i.name ?? i.label ?? i.code ?? "Untitled";
  const path       = i.path ?? i.url ?? i.route ?? null;
  const icon       = i.icon ?? i.emoji ?? null;
  const sort_order = i.sort_order ?? i.sortOrder ?? 999;
  return { ...i, id, parent_id, name, path, icon, sort_order, children: [] };
}

function buildTree(items) {
  const primed = (items || []).map(normalizeItem).filter(i => i.id);
  const byId   = Object.fromEntries(primed.map(i => [i.id, i]));
  const roots  = [];

  primed.forEach((i) => {
    if (i.parent_id) {
      const p = byId[i.parent_id];
      if (p) p.children.push(i);
      else roots.push(i); // orphan safety
    } else {
      roots.push(i);
    }
  });

  const sortFn = (a, b) =>
    (a.sort_order ?? 999) - (b.sort_order ?? 999) ||
    String(a.name || "").localeCompare(String(b.name || ""));

  const sortDeep = (nodes) => {
    nodes.sort(sortFn);
    nodes.forEach(n => n.children?.length && sortDeep(n.children));
    return nodes;
  };

  return sortDeep(roots);
}

/* ----------------------------- Node ----------------------------- */

function NodeItem({ node, depth = 0, defaultOpen = false, onNavigate }) {
  const hasChildren = (node.children?.length || 0) > 0;
  const isLeaf = !hasChildren && !!node.path; // leaf only if NO children
  const [open, setOpen] = useState(defaultOpen);
  const Icon = iconByName(node.icon);

  const pad = 16 + depth * 18; // clearer indentation
  const baseCls = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";

  if (isLeaf) {
    return (
      <NavLink
        to={node.path}
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `${baseCls} ${isActive ? "bg-white/10 text-white" : "text-gray-300 hover:text-white hover:bg-white/5"}`
        }
        style={{ paddingLeft: pad }}
      >
        <Icon className="w-4 h-4 opacity-80" />
        <span className="truncate">{node.name}</span>
      </NavLink>
    );
  }

  // Group / parent
  return (
    <div>
      <button
        type="button"
        className={`${baseCls} text-gray-300 hover:text-white hover:bg-white/5 w-full text-left font-medium`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
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
              style={{ marginLeft: pad }}
            >
              <div className="border-l border-white/10 pl-3">
                {node.children.map(ch => (
                  <NodeItem key={ch.id} node={ch} depth={depth + 1} onNavigate={onNavigate} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ----------------------------- Sidebar ----------------------------- */

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
