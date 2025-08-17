// src/components/layout/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ========================================================================
   HARD-CODED MENUS (parents + children). DB is ignored on purpose.
   ======================================================================== */
const MENUS = [
  // ---------------- ROOTS ----------------
  { id: "admin-root", code: "admin", label: "Admin", path: null, icon: "⚙️", parent_id: null, module_code: "core", sort_order: 10 },
  { id: "crm-root",   code: "crm",   label: "CRM",   path: null, icon: "🤝", parent_id: null, module_code: "crm",  sort_order: 10 },

  // ---------------- ADMIN GROUPS ----------------
  { id: "admin-grp-org",  code: "admin.grp.org",  label: "Organization & Compliance",           icon: "🏢", parent_id: "admin-root", sort_order: 21 },
  { id: "admin-grp-rbac", code: "admin.grp.rbac", label: "Access Control (RBAC)",               icon: "🛡️", parent_id: "admin-root", sort_order: 22 },
  { id: "admin-grp-sec",  code: "admin.grp.sec",  label: "Security & Compliance",               icon: "🔐", parent_id: "admin-root", sort_order: 23 },
  { id: "admin-grp-data", code: "admin.grp.data", label: "Data & Customization",                icon: "🧩", parent_id: "admin-root", sort_order: 24 },
  { id: "admin-grp-int",  code: "admin.grp.int",  label: "Integrations & Developer",            icon: "🔌", parent_id: "admin-root", sort_order: 25 },
  { id: "admin-grp-ai",   code: "admin.grp.ai",   label: "AI & Automation",                     icon: "✨", parent_id: "admin-root", sort_order: 26 },
  { id: "admin-grp-bill", code: "admin.grp.bill", label: "Billing & Observability",             icon: "💳", parent_id: "admin-root", sort_order: 27 },

  // Admin → Organization & Compliance
  { id: "admin-org",          code: "admin.org",          label: "Organization Profile",  path: "/app/admin/org",          icon: "🏢", parent_id: "admin-grp-org",  sort_order: 211 },
  { id: "admin-branding",     code: "admin.branding",     label: "Branding / Theme",      path: "/app/admin/branding",     icon: "🎨", parent_id: "admin-grp-org",  sort_order: 212 },
  { id: "admin-localization", code: "admin.localization", label: "Localization",          path: "/app/admin/localization", icon: "🌐", parent_id: "admin-grp-org",  sort_order: 213 },
  { id: "admin-taxes",        code: "admin.taxes",        label: "Tax & Compliance",      path: "/app/admin/taxes",        icon: "🧾", parent_id: "admin-grp-org",  sort_order: 214 },
  { id: "admin-units",        code: "admin.units",        label: "Business Units & Depts",path: "/app/admin/units",        icon: "🏢", parent_id: "admin-grp-org",  sort_order: 215 },
  { id: "admin-locations",    code: "admin.locations",    label: "Locations",             path: "/app/admin/locations",    icon: "📍", parent_id: "admin-grp-org",  sort_order: 216 },
  { id: "admin-calendars",    code: "admin.calendars",    label: "Calendars & Holidays",  path: "/app/admin/calendars",    icon: "📅", parent_id: "admin-grp-org",  sort_order: 217 },
  { id: "admin-numbering",    code: "admin.numbering",    label: "Numbering Schemes",     path: "/app/admin/numbering",    icon: "🔢", parent_id: "admin-grp-org",  sort_order: 218 },
  { id: "admin-compliance",   code: "admin.compliance",   label: "Compliance Policies",   path: "/app/admin/compliance",   icon: "🛡️", parent_id: "admin-grp-org",  sort_order: 219 },

  // Admin → RBAC
  { id: "admin-users",       code: "admin.users",       label: "Users",              path: "/app/admin/users",       icon: "👤", parent_id: "admin-grp-rbac", sort_order: 311 },
  { id: "admin-roles",       code: "admin.roles",       label: "Roles",              path: "/app/admin/roles",       icon: "🛡️", parent_id: "admin-grp-rbac", sort_order: 312 },
  { id: "admin-permissions", code: "admin.permissions", label: "Permissions Matrix", path: "/app/admin/permissions", icon: "🗂️", parent_id: "admin-grp-rbac", sort_order: 313 },
  { id: "admin-teams",       code: "admin.teams",       label: "Teams & Territories",path: "/app/admin/teams",       icon: "🧭", parent_id: "admin-grp-rbac", sort_order: 314 },

  // Admin → Security
  { id: "admin-security", code: "admin.security", label: "Security Policies", path: "/app/admin/security", icon: "🔐", parent_id: "admin-grp-sec", sort_order: 411 },
  { id: "admin-sso",      code: "admin.sso",      label: "SSO & MFA",        path: "/app/admin/sso",      icon: "🧷", parent_id: "admin-grp-sec", sort_order: 412 },
  { id: "admin-domains",  code: "admin.domains",  label: "Domains",          path: "/app/admin/domains",  icon: "🌐", parent_id: "admin-grp-sec", sort_order: 413 },
  { id: "admin-audit",    code: "admin.audit",    label: "Audit Logs",       path: "/app/admin/audit",    icon: "📜", parent_id: "admin-grp-sec", sort_order: 414 },

  // Admin → Data & Customization
  { id: "admin-settings",      code: "admin.settings",      label: "Settings",        path: "/app/admin/settings",      icon: "🧩", parent_id: "admin-grp-data", sort_order: 511 },
  { id: "admin-custom-fields", code: "admin.custom-fields", label: "Custom Fields",   path: "/app/admin/custom-fields", icon: "🏷️", parent_id: "admin-grp-data", sort_order: 512 },
  { id: "admin-pipelines",     code: "admin.pipelines",     label: "Pipelines & Stages", path: "/app/admin/pipelines", icon: "🪜", parent_id: "admin-grp-data", sort_order: 513 },
  { id: "admin-templates",     code: "admin.templates",     label: "Templates",       path: "/app/admin/templates",     icon: "🧾", parent_id: "admin-grp-data", sort_order: 514 },
  { id: "admin-notifications", code: "admin.notifications", label: "Notifications",   path: "/app/admin/notifications", icon: "🔔", parent_id: "admin-grp-data", sort_order: 515 },
  { id: "admin-import",        code: "admin.import_export", label: "Import / Export", path: "/app/admin/import",       icon: "⬇️", parent_id: "admin-grp-data", sort_order: 516 },
  { id: "admin-backups",       code: "admin.backups",       label: "Backups",         path: "/app/admin/backups",      icon: "💾", parent_id: "admin-grp-data", sort_order: 517 },

  // Admin → Integrations
  { id: "admin-integrations", code: "admin.integrations", label: "Integrations", path: "/app/admin/integrations", icon: "🔌", parent_id: "admin-grp-int", sort_order: 611 },
  { id: "admin-marketplace",  code: "admin.marketplace",  label: "Marketplace",  path: "/app/admin/marketplace",  icon: "🛍️", parent_id: "admin-grp-int", sort_order: 612 },
  { id: "admin-api-keys",     code: "admin.api_keys",     label: "API Keys",     path: "/app/admin/api-keys",     icon: "🗝️", parent_id: "admin-grp-int", sort_order: 613 },
  { id: "admin-webhooks",     code: "admin.webhooks",     label: "Webhooks",     path: "/app/admin/webhooks",     icon: "🪝", parent_id: "admin-grp-int", sort_order: 614 },
  { id: "admin-features",     code: "admin.features",     label: "Feature Flags",path: "/app/admin/features",     icon: "🚩", parent_id: "admin-grp-int", sort_order: 615 },

  // Admin → AI & Automation
  { id: "admin-ai",         code: "admin.ai",         label: "AI Settings",      path: "/app/admin/ai",         icon: "✨", parent_id: "admin-grp-ai", sort_order: 711 },
  { id: "admin-automation", code: "admin.automation", label: "Automation Rules", path: "/app/admin/automation", icon: "🤖", parent_id: "admin-grp-ai", sort_order: 712 },
  { id: "admin-approvals",  code: "admin.approvals",  label: "Approvals",        path: "/app/admin/approvals",  icon: "✅", parent_id: "admin-grp-ai", sort_order: 713 },

  // Admin → Billing & Observability
  { id: "admin-billing", code: "admin.billing", label: "Billing & Subscription", path: "/app/admin/billing", icon: "💳", parent_id: "admin-grp-bill", sort_order: 811 },
  { id: "admin-usage",   code: "admin.usage",   label: "Usage & Limits",        path: "/app/admin/usage",   icon: "📈", parent_id: "admin-grp-bill", sort_order: 812 },
  { id: "admin-logs",    code: "admin.logs",    label: "System Logs",           path: "/app/admin/logs",    icon: "🧾", parent_id: "admin-grp-bill", sort_order: 813 },

  // ---------------- CRM CHILDREN ----------------
  { id: "crm-leads",     code: "crm.leads",     label: "Leads",            path: "/app/crm/leads",     icon: "📇", parent_id: "crm-root", sort_order: 11 },
  { id: "crm-discover",  code: "crm.discover",  label: "Discover (AI)",    path: "/app/crm/discover",  icon: "✨", parent_id: "crm-root", sort_order: 12 },
  { id: "crm-companies", code: "crm.companies", label: "Companies",        path: "/app/crm/companies", icon: "🏢", parent_id: "crm-root", sort_order: 13 },
  { id: "crm-contacts",  code: "crm.contacts",  label: "Contacts",         path: "/app/crm/contacts",  icon: "👥", parent_id: "crm-root", sort_order: 14 },
  { id: "crm-calls",     code: "crm.calls",     label: "Calls",            path: "/app/crm/calls",     icon: "📞", parent_id: "crm-root", sort_order: 15 },
  { id: "crm-deals",     code: "crm.deals",     label: "Deals / Pipeline", path: "/app/crm/deals",     icon: "📊", parent_id: "crm-root", sort_order: 16 },
  { id: "crm-reports",   code: "crm.reports",   label: "Reports",          path: "/app/crm/reports",   icon: "📈", parent_id: "crm-root", sort_order: 91 },

  // CRM → Incentives (Commission)
  { id: "crm-incentives",           code: "crm.incentives",           label: "Incentives / Commission", icon: "🏆", parent_id: "crm-root", sort_order: 70 },
  { id: "crm-incentives-plans",     code: "crm.incentives.plans",     label: "Plans",        path: "/app/crm/incentives/plans",     icon: "🗂️", parent_id: "crm-incentives", sort_order: 701 },
  { id: "crm-incentives-rules",     code: "crm.incentives.rules",     label: "Rules",        path: "/app/crm/incentives/rules",     icon: "⚖️", parent_id: "crm-incentives", sort_order: 702 },
  { id: "crm-incentives-tiers",     code: "crm.incentives.tiers",     label: "Slabs & Tiers",path: "/app/crm/incentives/tiers",     icon: "🪜", parent_id: "crm-incentives", sort_order: 703 },
  { id: "crm-incentives-programs",  code: "crm.incentives.programs",  label: "Programs",     path: "/app/crm/incentives/programs",  icon: "🎯", parent_id: "crm-incentives", sort_order: 704 },
  { id: "crm-incentives-payouts",   code: "crm.incentives.payouts",   label: "Payouts",      path: "/app/crm/incentives/payouts",   icon: "💸", parent_id: "crm-incentives", sort_order: 705 },
  { id: "crm-incentives-adjust",    code: "crm.incentives.adjust",    label: "Adjustments",  path: "/app/crm/incentives/Adjustments",    icon: "🧾", parent_id: "crm-incentives", sort_order: 706 },
  { id: "crm-incentives-approvals", code: "crm.incentives.approvals", label: "Approvals",    path: "/app/crm/incentives/approvals", icon: "✅", parent_id: "crm-incentives", sort_order: 707 },
  { id: "crm-incentives-reporting", code: "crm.incentives.reporting", label: "Reports",      path: "/app/crm/incentives/reports",   icon: "📊", parent_id: "crm-incentives", sort_order: 708 },
  { id: "crm-incentives-audit",     code: "crm.incentives.audit",     label: "Audit",        path: "/app/crm/incentives/audit",     icon: "📜", parent_id: "crm-incentives", sort_order: 709 },
];

/* =============================== helpers =============================== */
const normPath = (p) => {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const byOrderThenName = (a, b) => {
  const ao = Number.isFinite(a.sort_order) ? a.sort_order : 999999;
  const bo = Number.isFinite(b.sort_order) ? b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  const an = String(a.label || a.name || a.code || "");
  const bn = String(b.label || b.name || b.code || "");
  return an.localeCompare(bn, undefined, { sensitivity: "base" });
};
function buildTreeDbFirst(items) {
  const byId = new Map();
  const children = new Map();
  (items || []).forEach((raw) => {
    const n = {
      id: raw.id,
      code: raw.code,
      label: raw.label ?? raw.name ?? raw.code ?? "",
      name: raw.label ?? raw.name ?? raw.code ?? "",
      path: normPath(raw.path || ""),
      icon: raw.icon ?? null,
      parent_id: raw.parent_id ?? null,
      module_code: raw.module_code ?? null,
      sort_order: raw.sort_order ?? null,
    };
    if (!n.id) return;
    byId.set(n.id, n);
    children.set(n.id, []);
  });
  byId.forEach((n) => { if (n.parent_id && byId.has(n.parent_id)) children.get(n.parent_id).push(n); });
  const sortRec = (node) => {
    const kids = children.get(node.id) || [];
    kids.sort(byOrderThenName);
    return { ...node, children: kids.map(sortRec) };
  };
  const roots = Array.from(byId.values()).filter((n) => !n.parent_id);
  roots.sort(byOrderThenName);
  return roots.map(sortRec);
}

/* =========================== search / highlight ========================== */
function walk(nodes, fn, parentId = null) {
  (nodes || []).forEach((n) => { fn(n, parentId); if (n.children?.length) walk(n.children, fn, n.id); });
}
function buildParentMap(nodes) {
  const m = new Map(); walk(nodes, (n, p) => m.set(n.id, p)); return m;
}
function ancestorsOf(id, parentMap) {
  const list = []; let cur = parentMap.get(id);
  while (cur) { list.push(cur); cur = parentMap.get(cur); }
  return list;
}
function findNodeByPath(nodes, path) {
  let found = null;
  walk(nodes, (n) => { if (!found && n.path && path && path.startsWith(n.path)) found = n; });
  return found;
}
function filterTree(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { pruned: nodes, expandIds: new Set() };
  const expandIds = new Set();
  const hit = (n) => String(n.label || n.name || n.code || "").toLowerCase().includes(q);
  const recur = (arr) => {
    const out = [];
    for (const n of arr) {
      const kids = n.children ? recur(n.children) : [];
      const selfHit = hit(n);
      if (selfHit || kids.length) {
        if (kids.length) expandIds.add(n.id);
        out.push({ ...n, children: kids });
      }
    }
    return out;
  };
  return { pruned: recur(nodes), expandIds };
}
function Highlight({ text, query }) {
  if (!query) return <>{text}</>;
  const q = query.trim(); if (!q) return <>{text}</>;
  const s = String(text ?? ""); const idx = s.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (<>{s.slice(0, idx)}<mark className="bg-yellow-600/40 rounded px-0.5">{s.slice(idx, idx + q.length)}</mark>{s.slice(idx + q.length)}</>);
}

/* ================================ UI bits ================================= */
const ARROW = 18;
const Chevron = ({ open }) => (
  <svg width={ARROW} height={ARROW} viewBox="0 0 24 24" className="opacity-80" aria-hidden>
    <path d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Spacer = () => <span style={{ width: ARROW, height: ARROW, display: "inline-block" }} />;

/* ============================== COMPONENT ================================ */
export default function AppSidebar({ onRequestClose }) {
  const { branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const roots = useMemo(() => buildTreeDbFirst(MENUS), []);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState("");

  const parentMap = useMemo(() => buildParentMap(roots), [roots]);
  const { pruned: visibleTree, expandIds } = useMemo(() => filterTree(roots, query), [roots, query]);

  const isOpen = (id) => openIds.has(id);
  const openMany = (ids) => setOpenIds((prev) => { const next = new Set(prev); ids.forEach((i)=>next.add(i)); return next; });
  const closeAll = () => setOpenIds(new Set());
  const openAll = () => { const all = new Set(); walk(roots, (n) => { if (n.children?.length) all.add(n.id); }); setOpenIds(all); };
  const toggle = (id) => setOpenIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  useEffect(() => {
    const match = findNodeByPath(roots, loc.pathname);
    if (match) openMany(ancestorsOf(match.id, parentMap));
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + (eTop - cTop - 120), behavior: "smooth" });
    }
  }, [loc.pathname, roots, parentMap]);

  useEffect(() => { if (query) openMany(expandIds); }, [query, expandIds]);

  function Node({ node, depth = 0 }) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const open = isOpen(node.id);
    const pad = depth > 0 ? "ml-3" : "";
    const label = node.label || node.name || node.code || "";

    if (hasChildren) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className={["no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full text-left","text-gray-300 hover:bg-gray-800/50 transition",pad].join(" ")}
            aria-expanded={open}
            aria-controls={`children-${node.id}`}
          >
            <Chevron open={open} />
            {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
            <span className="truncate"><Highlight text={label} query={query} /></span>
          </button>
          {open && (
            <div id={`children-${node.id}`} className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="group" key={node.id}>
        <NavLink
          to={node.path || "#"}
          end
          className={({ isActive }) =>
            ["no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm", isActive ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-800/50", pad].join(" ")
          }
          onClick={() => { if (typeof onRequestClose === "function") onRequestClose(); }}
        >
          <Spacer />
          {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
          <span className="truncate"><Highlight text={label} query={query} /></span>
        </NavLink>
      </div>
    );
  }

  return (
    <aside className="h-full flex flex-col bg-gray-900 text-gray-100 border-r border-gray-800">
      {/* Header: brand + expand/collapse + close (mobile) */}
      <div className="h-14 px-3 flex items-center justify-between gap-2 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding?.appName || "Logo"} className="h-8 w-8 rounded-md object-contain bg-white/5 p-1" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-gray-800 flex items-center justify-center text-lg">🧠</div>
          )}
          <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={openAll} className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" title="Expand all" aria-label="Expand all">⤢</button>
          <button type="button" onClick={closeAll} className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" title="Collapse all" aria-label="Collapse all">⤡</button>
          {typeof onRequestClose === "function" && (
            <button type="button" onClick={onRequestClose} className="md:hidden px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" aria-label="Close menu" title="Close">✖</button>
          )}
        </div>
      </div>

      {/* Scroll area with sticky search */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-2 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="w-full bg-gray-800/60 text-sm text-gray-100 rounded-lg px-8 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-gray-400"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70">🔎</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
                aria-label="Clear"
                title="Clear"
              >
                ✖
              </button>
            )}
          </div>
        </div>

        <div className="p-2">
          {visibleTree.map((root) => <Node key={root.id} node={root} />)}
        </div>
      </div>
    </aside>
  );
}
