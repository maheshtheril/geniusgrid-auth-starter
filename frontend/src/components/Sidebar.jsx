// -----------------------------------------------
// src/components/Sidebar.jsx  (final)
// -----------------------------------------------
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEnv } from "@/store/useEnv";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";
import { Icon } from "@/components/ui/Icon";

/* ---------- Brand avatar (fallback to initial) ---------- */
function BrandAvatar({ name = "GeniusGrid", logoUrl }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="w-8 h-8 rounded-lg object-cover border border-white/10"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  const initial = (name || "G").trim().charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/90 text-sm font-semibold">
      {initial}
    </div>
  );
}

/* ---------- Admin grouping (by code) ---------- */
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
  { code:"admin.grp.org" , name:"Organization & Compliance", icon:"Building",    sort:21, kids:G.org  },
  { code:"admin.grp.rbac", name:"Access Control (RBAC)",     icon:"Shield",      sort:22, kids:G.rbac },
  { code:"admin.grp.sec" , name:"Security & Compliance",     icon:"Lock",        sort:23, kids:G.sec  },
  { code:"admin.grp.data", name:"Data & Customization",      icon:"Puzzle",      sort:24, kids:G.data },
  { code:"admin.grp.int" , name:"Integrations & Developer",  icon:"Plug",        sort:25, kids:G.int  },
  { code:"admin.grp.ai"  , name:"AI & Automation",           icon:"Sparkles",    sort:26, kids:G.ai   },
  { code:"admin.grp.bill", name:"Billing & Observability",   icon:"CreditCard",  sort:27, kids:G.bill },
];

/* ---------- Helpers ---------- */
function normalizeIconName(s = "") {
  return s
    .split(/[-_ ]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("") || "Dot";
}
const byOrderThenName = (a, b) => {
  const ao = Number.isFinite(a.order) ? a.order : Number.isFinite(a.sort_order) ? a.sort_order : 999;
  const bo = Number.isFinite(b.order) ? b.order : Number.isFinite(b.sort_order) ? b.sort_order : 999;
  if (ao !== bo) return ao - bo;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
};

/** Normalize a record coming from your DB/view/store */
function norm(i) {
  return {
    id:         String(i.id ?? i.menu_id ?? i.menuId ?? i.code ?? cryptoRandom()),
    code:       String(i.code ?? i.name ?? ""),
    name:       String(i.name ?? i.label ?? i.code ?? "Untitled"),
    path:       i.path ?? i.url ?? i.route ?? null, // keep /app prefix as-is
    icon:       normalizeIconName(i.icon ?? "Folder"),
    order:      i.order ?? i.sort_order ?? i.sortOrder ?? 999,
    sort_order: i.sort_order ?? i.order ?? 999,
    parent_id:  i.parent_id ? String(i.parent_id) : null,
    parent_code:i.parent_code ?? i.parentCode ?? null,
  };
}
function cryptoRandom() { try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); } }

function inferAdminGroupCode(code) {
  for (const g of ADMIN_GROUPS) if (g.kids.has(code)) return g.code;
  return null;
}

/** Build a tree using: 1) parent_id (preferred), 2) parent_code, 3) code patterns */
function buildTree(rawItems) {
  const rows = (Array.isArray(rawItems) ? rawItems : []).map(norm).filter(r => r.code);
  const byId   = Object.fromEntries(rows.map(r => [r.id, r]));
  const byCode = Object.fromEntries(rows.map(r => [r.code, r]));

  // Initial nodes (copy) and a quick map for children
  const nodes = new Map(rows.map(r => [r.id, { ...r, children: [] }]));

  // Attach by parent_id when valid
  const roots = [];
  rows.forEach(r => {
    if (r.parent_id && byId[r.parent_id]) {
      const p = nodes.get(r.parent_id);
      const n = nodes.get(r.id);
      p.children.push(n);
    } else {
      roots.push(nodes.get(r.id));
    }
  });

  // Create Admin / CRM synthetic roots if any children exist but the root is missing
  const needAdmin = rows.some(r => r.code === "admin" || r.code.startsWith("admin."));
  const needCrm   = rows.some(r => r.code === "crm" || r.code.startsWith("crm."));
  const ensureRoot = (code, name, path, icon, order = 10) => {
    let node = [...nodes.values()].find(n => n.code === code);
    if (!node) {
      node = { id: code, code, name, path, icon, order, children: [] };
      nodes.set(node.id, node);
      roots.push(node);
    }
    return node;
  };
  const adminRoot = needAdmin ? ensureRoot("admin", "Admin", "/app/admin", "Settings", 10) : null;
  const crmRoot   = needCrm   ? ensureRoot("crm",   "CRM",   "/app/crm",   "Handshake", 10) : null;

  // Attach by parent_code if provided and not already parented
  rows.forEach(r => {
    if (!r.parent_id && r.parent_code) {
      const parentExisting = [...nodes.values()].find(n => n.code === r.parent_code);
      const self = nodes.get(r.id);
      if (parentExisting && !parentExisting.children.some(c => c.id === self.id)) {
        parentExisting.children.push(self);
        // remove self from roots if it now has a parent
        const idx = roots.indexOf(self); if (idx >= 0) roots.splice(idx, 1);
      }
    }
  });

  // Code-based Admin grouping: if a node is admin.* and has no valid parent, place under group → admin
  if (adminRoot) {
    ADMIN_GROUPS.forEach(g => {
      // find or create group node
      let gNode = [...nodes.values()].find(n => n.code === g.code);
      if (!gNode) {
        gNode = { id: g.code, code: g.code, name: g.name, path: null, icon: g.icon, order: g.sort, children: [] };
        nodes.set(gNode.id, gNode);
        adminRoot.children.push(gNode);
      } else if (!adminRoot.children.some(c => c.id === gNode.id)) {
        adminRoot.children.push(gNode);
      }
      // attach the kids under this group
      rows
        .filter(r => r.code.startsWith("admin.") && !r.code.startsWith("admin.grp."))
        .forEach(r => {
          if (g.kids.has(r.code)) {
            const self = nodes.get(r.id);
            // if self still in roots (unparented) or wrongly parented, put under gNode
            if (!gNode.children.some(c => c.id === self.id)) {
              gNode.children.push(self);
            }
            const idx = roots.indexOf(self); if (idx >= 0) roots.splice(idx, 1);
          }
        });
    });
  }

  // Code-based CRM grouping: crm.* under CRM
  if (crmRoot) {
    rows
      .filter(r => r.code.startsWith("crm.") && r.code !== "crm")
      .forEach(r => {
        const self = nodes.get(r.id);
        if (!crmRoot.children.some(c => c.id === self.id)) crmRoot.children.push(self);
        const idx = roots.indexOf(self); if (idx >= 0) roots.splice(idx, 1);
      });
  }

  // Generic modules like purchase.*, sales.*, etc.
  rows.forEach(r => {
    if (!r.code.startsWith("admin.") && !r.code.startsWith("crm.") && r.code.includes(".")) {
      const mod = r.code.split(".")[0];
      const modRoot = ensureRoot(mod, mod.toUpperCase(), `/app/${mod}`, "Folder", 20);
      const self = nodes.get(r.id);
      if (!modRoot.children.some(c => c.id === self.id)) modRoot.children.push(self);
      const idx = roots.indexOf(self); if (idx >= 0) roots.splice(idx, 1);
    }
  });

  // Sort deep
  const sortDeep = (arr) => { arr.sort(byOrderThenName); arr.forEach(n => n.children?.length && sortDeep(n.children)); return arr; };
  return sortDeep(roots);
}

/* ---------- Active-branch auto-open ---------- */
function branchHasActive(node, pathname) {
  if (node.path && pathname.startsWith(node.path)) return true;
  return (node.children || []).some((ch) => branchHasActive(ch, pathname));
}

/* ---------- Item component ---------- */
function ItemLink({ node, depth = 0 }) {
  const pad = 10 + depth * 14;
  const hasChildren = (node.children?.length || 0) > 0;
  const location = useLocation();
  const activeBranch = useMemo(() => branchHasActive(node, location.pathname), [node, location.pathname]);
  const [open, setOpen] = useState(depth < 1 || activeBranch);

  useEffect(() => { if (activeBranch) setOpen(true); }, [activeBranch]);

  const iconName = node.icon || "Folder";
  const base = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all";

  return (
    <div>
      {node.path ? (
        <NavLink
          to={node.path}
          title={node.name}
          className={({ isActive }) =>
            `${base} ${isActive ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"}`
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
          className={`${base} text-gray-300 hover:text-white hover:bg-white/5 w-full text-left font-medium`}
          style={{ paddingLeft: pad }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
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
              {/* subtle left rail */}
              <div className="ml-3 border-l border-white/10 pl-2">
                {node.children.map((ch) => (
                  <ItemLink key={ch.id} node={ch} depth={depth + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ---------- Sidebar ---------- */
export default function Sidebar() {
  const { menus, brand, tenant } = useEnv(); // menus: flat rows (id, code, name/label, path, icon, parent_id, order/sort_order)
  const orgName = (brand?.name || tenant?.name || "GeniusGrid");
  const logoUrl = (brand?.logo_url || brand?.logoURL || null);

  const { ent } = useEntitlements();
  const hasAI = !!(ent?.features && ent.features.ai_prospecting);

  // Add "Discover (AI)" under CRM if entitled and not present
  const mergedMenus = useMemo(() => {
    const base = Array.isArray(menus) ? [...menus] : [];
    const already = base.some(i => i.path === "/app/crm/discover" || i.code === "crm.discover");
    if (hasAI && !already) {
      // Try to find CRM parent by code or path
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

  // one-time debug to ensure nesting is built
  useEffect(() => {
    if (tree?.length && !window.__GG_TREE_DUMPED__) {
      window.__GG_TREE_DUMPED__ = true;
      try {
        console.log("Sidebar tree:");
        const dump = (n, d=0) => {
          // eslint-disable-next-line no-console
          console.log(" ".repeat(d*2) + `- ${n.code} (${n.name}) ${n.path ? "→ "+n.path : ""}`);
          (n.children||[]).forEach(c => dump(c, d+1));
        };
        tree.forEach(n => dump(n));
      } catch {}
    }
  }, [tree]);

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10 p-3">
      {/* BRAND HEADER */}
      <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-white/5">
        <BrandAvatar name={orgName} logoUrl={logoUrl} />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{orgName}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">ERP</div>
        </div>
      </div>

      {/* SECTION: Menu */}
      <div className="px-2 py-1 text-xs uppercase tracking-wider text-white/40">Menu</div>

      <div className="mt-2 space-y-1">
        {tree.length ? (
          tree
            // Keep Admin & CRM at top if present
            .sort((a, b) => {
              const rank = (node) => (node.code === "admin" ? -100 : node.code === "crm" ? -90 : 0);
              const r = rank(a) - rank(b);
              return r !== 0 ? r : byOrderThenName(a, b);
            })
            .map((node, idx) => (
              <div key={node.id || idx}>
                {/* Divider between major roots */}
                {idx > 0 && <div className="my-1 border-t border-white/10" />}
                <ItemLink node={node} />
              </div>
            ))
        ) : (
          <div className="text-sm opacity-70">No menus</div>
        )}
      </div>

      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}
