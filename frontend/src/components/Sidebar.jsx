// -----------------------------------------------
// src/components/Sidebar.jsx (redesigned + AI gate + debug + env force)
// -----------------------------------------------
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEnv } from "@/store/useEnv";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";
import Icon from "@/components/ui/Icon";

/** Normalize icon names like "sparkles" -> "Sparkles", "chevron-right" -> "ChevronRight" */
function normalizeIconName(s = "") {
  return s
    .split(/[-_ ]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("") || "Dot";
}

/** Build a parent→children tree, preserving/sorting by optional `order`, then `name`. */
function buildTree(items) {
  const copy = Array.isArray(items) ? [...items] : [];
  const byId = Object.fromEntries(copy.map((i) => [i.id, { ...i, children: [] }]));
  const roots = [];
  copy.forEach((i) => {
    if (i.parent_id && byId[i.parent_id]) byId[i.parent_id].children.push(byId[i.id]);
    else roots.push(byId[i.id]);
  });

  const sortFn = (a, b) => {
    const ao = Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY;
    const bo = Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
  };

  const sortTree = (nodes) => {
    nodes.sort(sortFn);
    nodes.forEach((n) => n.children && sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

function branchHasActive(node, pathname) {
  if (node.path && pathname.startsWith(node.path)) return true;
  return (node.children || []).some((ch) => branchHasActive(ch, pathname));
}

function ItemLink({ node, depth = 0 }) {
  const pad = 8 + depth * 12;
  const hasChildren = (node.children?.length || 0) > 0;
  const iconName = normalizeIconName(node.icon);
  const location = useLocation();

  // Auto-open top levels and the branch that contains the active route
  const activeBranch = useMemo(() => branchHasActive(node, location.pathname), [node, location.pathname]);
  const [open, setOpen] = useState(depth < 1 || activeBranch);
  useEffect(() => {
    if (activeBranch) setOpen(true);
  }, [activeBranch]);

  return (
    <div>
      {node.path ? (
        <NavLink
          to={node.path}
          title={node.name}
          className={({ isActive }) =>
            [
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all",
              isActive ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white",
            ].join(" ")
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
          title={node.name}
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
  const { menus } = useEnv();                   // server-provided menus (id, name, path, icon, parent_id, order?)
  const { ent } = useEntitlements();           // { features, capabilities? }

  // --- Debug + force switches (remove in prod if you’d like)
  const DEBUG = true;
  const forceAi = String(import.meta.env.VITE_FORCE_AI_MENU || "") === "1";
  if (DEBUG) {
    // See what the sidebar actually receives
    // eslint-disable-next-line no-console
    console.log("[Sidebar] ent:", ent);
    // eslint-disable-next-line no-console
    console.log("[Sidebar] menus:", menus);
  }

  // Accept either features boolean or capabilities list, or env force
  const hasAI =
    forceAi ||
    !!(ent?.features && ent.features.ai_prospecting) ||
    (Array.isArray(ent?.capabilities) && ent.capabilities.includes("leads:discover"));

  // Merge a gated "Discover (AI)" entry if entitlement present and not already in menus
  const mergedMenus = useMemo(() => {
    const base = Array.isArray(menus) ? [...menus] : [];

    // Only add if allowed and not present
    if (hasAI && !base.some((i) => i.path === "/app/leads/discover")) {
      // Try to find a sensible parent: explicit path first, then by name, then CRM bucket
      const leadsParent =
        base.find((i) => i.path?.startsWith?.("/app/leads")) ||
        base.find((i) => /(^|\s)leads?(\s|$)/i.test(i.name || "")) ||
        base.find((i) => /crm/i.test(i.name || ""));

      base.push({
        id: "nav_ai_prospecting",
        name: "Discover (AI)",
        path: "/app/leads/discover",
        icon: "sparkles",
        parent_id: leadsParent?.id || null,
        order: Number.isFinite(leadsParent?.order) ? leadsParent.order + 1 : undefined,
      });
    }
    return base;
  }, [menus, hasAI]);

  const tree = useMemo(() => buildTree(mergedMenus), [mergedMenus]);

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
