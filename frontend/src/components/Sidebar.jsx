// -----------------------------------------------
// src/components/Sidebar.jsx (robust tree builder)
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

/** --- Admin grouping (by code) --- */
const G = {
  org : new Set(["admin.org","admin.branding","admin.localization","admin.taxes","admin.units","admin.locations","admin.calendars","admin.numbering","admin.compliance"]),
  rbac: new Set(["admin.users","admin.roles","admin.permissions","admin.teams"]),
  sec : new Set(["admin.security","admin.sso","admin.domains","admin.audit"]),
  data: new Set(["admin.settings","admin.custom-fields","admin.pipelines","admin.templates","admin.notifications","admin.import_export","admin.backups"]),
  int : new Set(["admin.integrations","admin.marketplace","admin.api_keys","admin.webhooks","admin.features"]),
  ai  : new Set(["admin.ai","admin.automation","admin.approvals"]),
  bill: new Set(["admin.billing","admin.usage","admin.logs"]),
};
const ADMIN_GROUPS = [
  { code:"admin.grp.org" , name:"Organization & Compliance", icon:"Building", sort:21, kids:G.org  },
  { code:"admin.grp.rbac", name:"Access Control (RBAC)"    , icon:"Shield",   sort:22, kids:G.rbac },
  { code:"admin.grp.sec" , name:"Security & Compliance"    , icon:"Lock",     sort:23, kids:G.sec  },
  { code:"admin.grp.data", name:"Data & Customization"     , icon:"Puzzle",   sort:24, kids:G.data },
  { code:"admin.grp.int" , name:"Integrations & Developer" , icon:"Plug",     sort:25, kids:G.int  },
  { code:"admin.grp.ai"  , name:"AI & Automation"          , icon:"Sparkles", sort:26, kids:G.ai   },
  { code:"admin.grp.bill", name:"Billing & Observability"  , icon:"CreditCard",sort:27, kids:G.bill},
];

/** Normalize an incoming row. Works with your DB view or existing payload. */
function norm(i){
  return {
    id:        i.id ?? i.menu_id ?? i.menuId ?? i.code ?? String(Math.random()),
    code:      i.code ?? i.name ?? "",
    name:      i.name ?? i.label ?? i.code ?? "Untitled",
    path:      i.path ?? i.url ?? i.route ?? null,     // keep /app prefix
    icon:      normalizeIconName(i.icon ?? "Folder"),
    order:     i.order ?? i.sort_order ?? i.sortOrder ?? 999,
    parent_id: i.parent_id ?? null,
    parent_code: i.parent_code ?? i.parentCode ?? null,
  };
}

/** Build a tree using: 1) parent_id (if present), else 2) parent_code (if present), else 3) code patterns */
function buildTree(items) {
  const rows = (Array.isArray(items) ? items : []).map(norm).filter(r => r.code);

  // One-time debug: see what frontend actually receives
  if (typeof window !== "undefined" && !window.__GG_MENU_DUMPED__) {
    window.__GG_MENU_DUMPED__ = true;
    try { console.table(rows.map(({code,name,path,parent_id,parent_code,order})=>({code,name,path,parent_id,parent_code,order}))); } catch {}
  }

  // Indexes
  const byId   = Object.fromEntries(rows.map(r => [String(r.id), r]));
  const byCode = Object.fromEntries(rows.map(r => [r.code, r]));

  // Start by building via parent_id (original behavior)
  const nodesById = new Map();
  const ensureId = (r) => {
    if (!nodesById.has(r.id)) nodesById.set(r.id, {...r, children: []});
    return nodesById.get(r.id);
  };
  rows.forEach(r => ensureId(r));

  // Attach by parent_id if valid
  const rootsId = [];
  rows.forEach(r => {
    if (r.parent_id && byId[r.parent_id]) {
      const p = ensureId(byId[r.parent_id]);
      const n = ensureId(r);
      p.children.push(n);
    } else {
      rootsId.push(ensureId(r));
    }
  });

  // If tree still flat / wrong, augment with code-based hierarchy:
  // 1) Ensure Admin/CRM roots exist if implied by children
  const needAdmin = rows.some(r => r.code === "admin" || r.code.startsWith("admin."));
  const needCrm   = rows.some(r => r.code === "crm"   || r.code.startsWith("crm."));
  if (needAdmin && !byCode["admin"]) {
    const synthetic = { id:"admin", code:"admin", name:"Admin", path:"/app/admin", icon:"Settings", order:10, children:[] };
    nodesById.set(synthetic.id, synthetic);
    rootsId.push(synthetic);
  }
  if (needCrm && !byCode["crm"]) {
    const synthetic = { id:"crm", code:"crm", name:"CRM", path:"/app/crm", icon:"Handshake", order:10, children:[] };
    nodesById.set(synthetic.id, synthetic);
    rootsId.push(synthetic);
  }

  // Helper to find/create node by code (for groups/modules)
  const getByCodeNode = (code, fallback) => {
    // Look for existing node with that code
    for (const n of nodesById.values()) if (n.code === code) return n;
    // Create synthetic
    const base = byCode[code] || fallback || { code, name: code.toUpperCase(), path: null, icon: "Folder", order: 50 };
    const id = base.id ?? code;
    const node = { id, ...base, children: base.children || [] };
    nodesById.set(id, node);
    // put under roots if not attached later
    if (!rootsId.includes(node)) rootsId.push(node);
    return node;
  };

  // 2) Attach by parent_code where parent_id was missing
  rows.forEach(r => {
    if (!r.parent_id && r.parent_code) {
      const parent = getByCodeNode(r.parent_code);
      const self   = [...nodesById.values()].find(n => n.id === r.id) || getByCodeNode(r.code, r);
      if (!parent.children.some(c => c.id === self.id)) parent.children.push(self);
      // remove self from roots if it got a parent now
      const idx = rootsId.indexOf(self); if (idx >= 0) rootsId.splice(idx,1);
    }
  });

  // 3) Code rules for Admin groups and CRM
  if (needAdmin) {
    const adminRoot = getByCodeNode("admin", { code:"admin", name:"Admin", path:"/app/admin", icon:"Settings", order:10 });
    ADMIN_GROUPS.forEach(g => {
      const groupNode = getByCodeNode(g.code, { code:g.code, name:g.name, path:null, icon:g.icon, order:g.sort });
      // attach group to admin if not already
      if (!adminRoot.children.some(c => c.code === g.code)) adminRoot.children.push(groupNode);
      // attach its kids
      rows.filter(r => r.code.startsWith("admin.") && !r.code.startsWith("admin.grp."))
          .forEach(r => {
            if (g.kids.has(r.code)) {
              const self = getByCodeNode(r.code, r);
              if (!groupNode.children.some(c => c.id === self.id)) groupNode.children.push(self);
              const idx = rootsId.indexOf(self); if (idx >= 0) rootsId.splice(idx,1);
            }
          });
    });
  }
  if (needCrm) {
    const crmRoot = getByCodeNode("crm", { code:"crm", name:"CRM", path:"/app/crm", icon:"Handshake", order:10 });
    rows.filter(r => r.code.startsWith("crm.") && r.code !== "crm")
        .forEach(r => {
          const self = getByCodeNode(r.code, r);
          if (!crmRoot.children.some(c => c.id === self.id)) crmRoot.children.push(self);
          const idx = rootsId.indexOf(self); if (idx >= 0) rootsId.splice(idx,1);
        });
  }

  // 4) Other modules like purchase.*, sales.*, etc.
  rows.forEach(r => {
    if (!r.code.startsWith("admin.") && !r.code.startsWith("crm.") && r.code.includes(".")) {
      const mod = r.code.split(".")[0];
      const modRoot = getByCodeNode(mod, { code:mod, name:mod.toUpperCase(), path:`/app/${mod}`, icon:"Folder", order:20 });
      const self = getByCodeNode(r.code, r);
      if (!modRoot.children.some(c => c.id === self.id)) modRoot.children.push(self);
      const idx = rootsId.indexOf(self); if (idx >= 0) rootsId.splice(idx,1);
    }
  });

  // Sorting
  const byName = (a,b)=> String(a.name||"").localeCompare(String(b.name||""));
  const byOrder= (a,b)=> (Number.isFinite(a.order)?a.order:999) - (Number.isFinite(b.order)?b.order:999) || byName(a,b);
  const sortDeep = (arr)=>{ arr.sort(byOrder); arr.forEach(n=>n.children?.length && sortDeep(n.children)); return arr; };
  return sortDeep(rootsId);
}

function branchHasActive(node, pathname) {
  if (node.path && pathname.startsWith(node.path)) return true;
  return (node.children || []).some((ch) => branchHasActive(ch, pathname));
}

function ItemLink({ node, depth = 0 }) {
  const pad = 8 + depth * 12;
  const hasChildren = (node.children?.length || 0) > 0;
  const iconName = node.icon || "Folder";
  const location = useLocation();

  const activeBranch = useMemo(() => branchHasActive(node, location.pathname), [node, location.pathname]);
  const [open, setOpen] = useState(depth < 1 || activeBranch);
  useEffect(() => { if (activeBranch) setOpen(true); }, [activeBranch]);

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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {node.children.map((ch) => (
                <ItemLink key={ch.id || ch.code} node={ch} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { menus } = useEnv();            // expects flat rows (id, code, name/label, path, icon, parent_id?, order?)
  const { ent } = useEntitlements();
  const hasAI = !!(ent?.features && ent.features.ai_prospecting);

  // Add "Discover (AI)" under CRM if entitled and not present
  const mergedMenus = useMemo(() => {
    const base = Array.isArray(menus) ? [...menus] : [];
    const already = base.some(i => i.path === "/app/crm/discover" || i.code === "crm.discover");
    if (hasAI && !already) {
      // Find CRM parent
      const crmParent = base.find(i => i.code === "crm" || i.path === "/app/crm");
      base.push({
        id: "nav_ai_prospecting",
        code: "crm.discover",
        name: "Discover (AI)",
        path: "/app/crm/discover",
        icon: "Sparkles",
        parent_id: crmParent?.id ?? null,
        order: Number.isFinite(crmParent?.order) ? (crmParent.order + 1) : 12,
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
          tree.map((node) => <ItemLink key={node.id || node.code} node={node} />)
        ) : (
          <div className="text-sm opacity-70">No menus</div>
        )}
      </div>

      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}
