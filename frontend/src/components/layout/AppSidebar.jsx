import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ---------------- FALLBACK: used only if DB returns no menus ---------------- */
const FALLBACK_MENUS = [
  // --- Admin root ---
  { id: "c0551da9-0d0b-4dae-9160-63f8f9e3bd27", code: "admin", label: "Admin", path: "/app/admin", icon: "⚙️", parent_id: null, module_code: "core", sort_order: 10 },
  // Admin groups
  { id: "cce5095b-7aa1-4c8c-af9c-53203b8c6b11", code: "admin.grp.rbac", label: "Access Control (RBAC)", icon: "🛡️", parent_id: "c0551da9-0d0b-4dae-9160-63f8f9e3bd27", module_code: "core", sort_order: 22 },
  { id: "405fd86c-d329-4a3f-a705-be541deb5002", code: "admin.grp.sec",  label: "Security & Compliance", icon: "🔐", parent_id: "c0551da9-0d0b-4dae-9160-63f8f9e3bd27", module_code: "core", sort_order: 23 },
  { id: "a39f43d4-9562-4f60-b0e9-4cd9bdb87858", code: "admin.grp.data", label: "Data & Customization",  icon: "🧩", parent_id: "c0551da9-0d0b-4dae-9160-63f8f9e3bd27", module_code: "core", sort_order: 24 },

  // RBAC leaves
  { id: "7045a9c2-2110-4710-9ada-1325f43d0ffd", code: "admin.users",        label: "Users",               path: "/app/admin/users",        icon: "👤", parent_id: "cce5095b-7aa1-4c8c-af9c-53203b8c6b11", module_code: "core", sort_order: 311 },
  { id: "4a4611f8-2a16-499e-bd3c-3b97ba1d9eab", code: "admin.roles",        label: "Roles",               path: "/app/admin/roles",        icon: "🛡️", parent_id: "cce5095b-7aa1-4c8c-af9c-53203b8c6b11", module_code: "core", sort_order: 312 },
  { id: "d8639e8e-b202-4fac-83f5-da2541e97da8", code: "admin.permissions",  label: "Permissions Matrix",  path: "/app/admin/permissions",  icon: "🗂️", parent_id: "cce5095b-7aa1-4c8c-af9c-53203b8c6b11", module_code: "core", sort_order: 313 },

  // Security leaves
  { id: "c6354bf5-2bbf-4d6e-8d61-56b8e1800a15", code: "admin.security",     label: "Security Policies",   path: "/app/admin/security",     icon: "🔐", parent_id: "405fd86c-d329-4a3f-a705-be541deb5002", module_code: "core", sort_order: 411 },
  { id: "0563c6c8-00db-4921-a367-2bfbeb038402", code: "admin.sso",          label: "SSO & MFA",           path: "/app/admin/sso",          icon: "🧷", parent_id: "405fd86c-d329-4a3f-a705-be541deb5002", module_code: "core", sort_order: 412 },

  // Data leaves
  { id: "fb5c3948-dce3-4d6e-abdb-7e6e5bef941a", code: "admin.settings",     label: "Settings",            path: "/app/admin/settings",     icon: "🧩", parent_id: "a39f43d4-9562-4f60-b0e9-4cd9bdb87858", module_code: "core", sort_order: 511 },
  { id: "8b2f1075-8d51-4e75-88c5-2b105bbdb9f8", code: "admin.custom-fields",label: "Custom Fields",       path: "/app/admin/custom-fields",icon: "🏷️", parent_id: "a39f43d4-9562-4f60-b0e9-4cd9bdb87858", module_code: "core", sort_order: 512 },

  // --- CRM root ---
  { id: "561b9761-5642-4d4f-8826-8cadf9822f8a", code: "crm",  label: "CRM", path: "/app/crm", icon: "🤝", parent_id: null, module_code: "crm", sort_order: 10 },
  // CRM leaves
  { id: "c50dd780-69b6-4384-adc7-10469d7d865c", code: "crm.leads",       label: "Leads",            path: "/app/crm/leads",       icon: "📇", parent_id: "561b9761-5642-4d4f-8826-8cadf9822f8a", module_code: "crm", sort_order: 11 },
  { id: "0254b519-fafb-48d7-8604-7a989f102511", code: "crm.companies",    label: "Companies",        path: "/app/crm/companies",   icon: "🏢", parent_id: "561b9761-5642-4d4f-8826-8cadf9822f8a", module_code: "crm", sort_order: 13 },
  { id: "803d2d5e-37c4-466a-af24-d1a7bc3dc780", code: "crm.contacts",     label: "Contacts",         path: "/app/crm/contacts",    icon: "👥", parent_id: "561b9761-5642-4d4f-8826-8cadf9822f8a", module_code: "crm", sort_order: 14 },
  { id: "5aa1de70-b3ab-4b98-af6d-f707e2701b7a", code: "crm.deals",        label: "Deals / Pipeline", path: "/app/crm/deals",       icon: "📊", parent_id: "561b9761-5642-4d4f-8826-8cadf9822f8a", module_code: "crm", sort_order: 16 },
  { id: "76c53d5b-2646-4683-862a-f8f3afaf5c8c", code: "crm.reports",      label: "Reports",          path: "/app/crm/reports",     icon: "📈", parent_id: "561b9761-5642-4d4f-8826-8cadf9822f8a", module_code: "crm", sort_order: 91 },
];

/* ---------------- helpers ---------------- */
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
const isMain = (n) => String(n.label || n.name || n.code || "").trim().toLowerCase() === "main";

/* -------------- DB-first builder with fallback if empty --------------- */
function buildTree(items) {
  // Accept different shapes; if still empty -> use FALLBACK_MENUS
  let src = Array.isArray(items) ? items : (items?.data ?? items?.items ?? []);
  if (!src || src.length === 0) {
    console.warn("[Sidebar] DB returned no menus. Using FALLBACK_MENUS.");
    src = FALLBACK_MENUS;
  }

  const byId = new Map();
  const children = new Map();

  src.forEach((raw) => {
    const pidRaw = raw.parent_id ?? raw.parentId ?? raw.parentID ?? null;
    const parent_id = (pidRaw === "" || String(pidRaw).toLowerCase() === "null") ? null : pidRaw;

    const n = {
      id: raw.id,
      code: raw.code,
      label: raw.label ?? raw.name ?? raw.code ?? "",
      name: raw.label ?? raw.name ?? raw.code ?? "",
      path: normPath(raw.path ?? raw.Path ?? ""),
      icon: raw.icon ?? raw.Icon ?? null,
      parent_id,
      module_code: raw.module_code ?? raw.moduleCode ?? null,
      sort_order: raw.sort_order ?? raw.sortOrder ?? null,
    };
    if (!n.id) return;
    byId.set(n.id, n);
    children.set(n.id, []);
  });

  // attach strictly by parent_id when parent exists
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) {
      children.get(n.parent_id).push(n);
    }
  });

  const sortRec = (node) => {
    const kids = children.get(node.id) || [];
    kids.sort(byOrderThenName);
    return { ...node, children: kids.map(sortRec) };
  };

  // roots: parent_id null, drop any "Main"
  const roots = Array.from(byId.values()).filter((n) => !n.parent_id && !isMain(n));
  roots.sort(byOrderThenName);
  return roots.map(sortRec);
}

/* ---------------- search / highlight ---------------- */
function walk(nodes, fn, parentId = null) {
  (nodes || []).forEach((n) => {
    fn(n, parentId);
    if (n.children?.length) walk(n.children, fn, n.id);
  });
}
function buildParentMap(nodes) {
  const m = new Map();
  walk(nodes, (n, p) => m.set(n.id, p));
  return m;
}
function ancestorsOf(id, parentMap) {
  const list = [];
  let cur = parentMap.get(id);
  while (cur) {
    list.push(cur);
    cur = parentMap.get(cur);
  }
  return list;
}
function findNodeByPath(nodes, path) {
  let found = null;
  walk(nodes, (n) => {
    if (!found && n.path && path && path.startsWith(n.path)) found = n;
  });
  return found;
}
function filterTree(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { pruned: nodes, expandIds: new Set() };

  const expandIds = new Set();
  const hit = (n) =>
    String(n.label || n.name || n.code || "").toLowerCase().includes(q);

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

  return { pruned: recur(arr = nodes), expandIds };
}
function Highlight({ text, query }) {
  if (!query) return <>{text}</>;
  const q = query.trim();
  if (!q) return <>{text}</>;
  const s = String(text ?? "");
  const idx = s.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {s.slice(0, idx)}
      <mark className="bg-yellow-600/40 rounded px-0.5">{s.slice(idx, idx + q.length)}</mark>
      {s.slice(idx + q.length)}
    </>
  );
}

/* ---------------- UI bits ---------------- */
const ARROW = 18;
const Chevron = ({ open }) => (
  <svg width={ARROW} height={ARROW} viewBox="0 0 24 24" className="opacity-80" aria-hidden>
    <path d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Spacer = () => <span style={{ width: ARROW, height: ARROW, display: "inline-block" }} />;

/* ---------------- COMPONENT ---------------- */
export default function AppSidebar() {
  const { menus = [], branding, ready } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const roots = useMemo(() => buildTree(menus || []), [menus]);

  // collapsed by default + search
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState("");

  const parentMap = useMemo(() => buildParentMap(roots), [roots]);

  const { pruned: visibleTree, expandIds } = useMemo(() => {
    // filterTree uses recursion—ensure we pass a stable array
    return filterTree(roots, query);
  }, [roots, query]);

  const isOpen = (id) => openIds.has(id);
  const openMany = (ids) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => next.add(i));
      return next;
    });
  const closeAll = () => setOpenIds(new Set());
  const openAll = () => {
    const all = new Set();
    walk(roots, (n) => { if (n.children?.length) all.add(n.id); });
    setOpenIds(all);
  };
  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Auto-open ancestors of active route + scroll into view
  useEffect(() => {
    const match = findNodeByPath(roots, loc.pathname);
    if (match) openMany(ancestorsOf(match.id, parentMap));
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollTop + (eTop - cTop - 120),
        behavior: "smooth",
      });
    }
  }, [loc.pathname, roots, parentMap]);

  // While searching, open ancestors of matches
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
            className={[
              "no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full text-left",
              "text-gray-300 hover:bg-gray-800/50",
              pad,
            ].join(" ")}
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
            [
              "no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              isActive ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-800/50",
              pad,
            ].join(" ")
          }
        >
          <Spacer />
          {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
          <span className="truncate"><Highlight text={label} query={query} /></span>
        </NavLink>
      </div>
    );
  }

  return (
    <aside className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col" style={{ width: "16rem", minWidth: "16rem" }}>
      {/* Header: Logo + Brand */}
      <div className="h-14 px-3 flex items-center gap-3 border-b border-gray-800">
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={branding?.appName || "Logo"} className="h-8 w-8 rounded-md object-contain bg-white/5 p-1" />
        ) : (
          <div className="h-8 w-8 rounded-md bg-gray-800 flex items-center justify-center text-lg">🧠</div>
        )}
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      {/* Search + actions */}
      <div className="p-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search menu…"
              className="w-full bg-gray-800/60 text-sm text-gray-100 rounded-lg px-8 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-gray-400"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70">🔎</span>
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white" aria-label="Clear">
                ✖
              </button>
            )}
          </div>
          <button type="button" onClick={openAll} className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" title="Expand all">⤢</button>
          <button type="button" onClick={closeAll} className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" title="Collapse all">⤡</button>
        </div>
      </div>

      {/* Menu */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        {!ready && (Array.isArray(menus) ? menus.length === 0 : !menus) ? (
          <div className="text-xs text-gray-400 px-3 py-2">Loading menus…</div>
        ) : (
          (visibleTree.length === 0
            ? <div className="text-xs text-gray-400 px-3 py-2">No menus.</div>
            : visibleTree.map((root) => <Node key={root.id} node={root} />)
          )
        )}
      </div>
    </aside>
  );
}
