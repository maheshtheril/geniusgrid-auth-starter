// src/components/layout/AppSidebar.jsx
// DB-first Sidebar (React Router v6) — EXACT roots (Admin, CRM), no synthetic "Main".
// - Normalizes parent_id ("", "null", undefined → null)
// - Only true parents (code === 'admin' | 'crm' && parent_id === null) are roots
// - Strict children attachment via parent_id
// - Collapsed-by-default sections, auto-opens ancestors of active route
// - Menu search, big expand/collapse arrows, highlight active, no underline on parents
// - Incentives subtree under CRM (plans, rules, tiers, programs, payouts, adjustments, approvals, reports, audit)
// - Fallback Admin+CRM tree when menus[] is empty
// - If DB build misses CRM but crm-like items exist, synthesize a CRM root and group them there

import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useEnv } from "@/store/useEnv";
import {
  ChevronRight,
  ChevronDown,
  Search as SearchIcon,
  Layers,
  Settings,
  BadgePercent,
  Percent,
  Banknote,
  ClipboardList,
  ListChecks,
  ShieldCheck,
  FileText,
  BarChart3,
  FolderTree,
  Cog,
} from "lucide-react";

/* ----------------------------- tiny utilities ----------------------------- */
const toNull = (v) => (v === undefined || v === null || v === "" || v === "null" ? null : v);
const normPath = (p) => {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const isCrmLike = (m) =>
  String(m?.code || "").startsWith("crm.") ||
  String(m?.module_code || "") === "crm" ||
  String(m?.path || "").startsWith("/app/crm");
const isRootCandidate = (m) => toNull(m.parent_id) === null && (m.code === "admin" || m.code === "crm");
const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/* ------------------------------- icon mapper ------------------------------ */
const iconFor = (code = "") => {
  if (code === "admin") return <Settings className="h-4 w-4" />;
  if (code === "crm") return <Layers className="h-4 w-4" />;
  if (code.startsWith("crm.incentive") || code.startsWith("crm.incentives")) return <BadgePercent className="h-4 w-4" />;
  if (code.includes("rules")) return <ClipboardList className="h-4 w-4" />;
  if (code.includes("tiers")) return <Percent className="h-4 w-4" />;
  if (code.includes("program")) return <FolderTree className="h-4 w-4" />;
  if (code.includes("payout")) return <Banknote className="h-4 w-4" />;
  if (code.includes("adjust")) return <Cog className="h-4 w-4" />;
  if (code.includes("approval")) return <ShieldCheck className="h-4 w-4" />;
  if (code.includes("report")) return <BarChart3 className="h-4 w-4" />;
  if (code.includes("audit")) return <FileText className="h-4 w-4" />;
  return <Layers className="h-4 w-4" />;
};

/* ---------------------------- hardcoded fallback --------------------------- */
const FALLBACK = [
  // roots
  { id: "r-admin", code: "admin", label: "Admin", path: "/app/admin", parent_id: null, sort_order: 10 },
  { id: "r-crm", code: "crm", label: "CRM", path: "/app/crm", parent_id: null, sort_order: 20 },
  // Admin demo children
  { id: "a-01", code: "admin.users", label: "Users", path: "/app/admin/users", parent_id: "r-admin", sort_order: 11 },
  { id: "a-02", code: "admin.companies", label: "Companies", path: "/app/admin/companies", parent_id: "r-admin", sort_order: 12 },
  { id: "a-03", code: "admin.settings", label: "Settings", path: "/app/admin/settings", parent_id: "r-admin", sort_order: 13 },
  // CRM scaffold (incl. Incentives subtree)
  { id: "c-00", code: "crm.leads", label: "Leads", path: "/app/crm/leads", parent_id: "r-crm", sort_order: 21 },
  { id: "c-01", code: "crm.companies", label: "Companies", path: "/app/crm/companies", parent_id: "r-crm", sort_order: 22 },
  { id: "c-10", code: "crm.incentives", label: "Incentives", path: "/app/crm/incentives", parent_id: "r-crm", sort_order: 30 },
  { id: "c-11", code: "crm.incentives.plans", label: "Plans", path: "/app/crm/incentives/plans", parent_id: "c-10", sort_order: 31 },
  { id: "c-12", code: "crm.incentives.rules", label: "Rules", path: "/app/crm/incentives/rules", parent_id: "c-10", sort_order: 32 },
  { id: "c-13", code: "crm.incentives.tiers", label: "Tiers", path: "/app/crm/incentives/tiers", parent_id: "c-10", sort_order: 33 },
  { id: "c-14", code: "crm.incentives.programs", label: "Programs", path: "/app/crm/incentives/programs", parent_id: "c-10", sort_order: 34 },
  { id: "c-15", code: "crm.incentives.payouts", label: "Payouts", path: "/app/crm/incentives/payouts", parent_id: "c-10", sort_order: 35 },
  { id: "c-16", code: "crm.incentives.adjustments", label: "Adjustments", path: "/app/crm/incentives/adjustments", parent_id: "c-10", sort_order: 36 },
  { id: "c-17", code: "crm.incentives.approvals", label: "Approvals", path: "/app/crm/incentives/approvals", parent_id: "c-10", sort_order: 37 },
  { id: "c-18", code: "crm.incentives.reports", label: "Reports", path: "/app/crm/incentives/reports", parent_id: "c-10", sort_order: 38 },
  { id: "c-19", code: "crm.incentives.audit", label: "Audit", path: "/app/crm/incentives/audit", parent_id: "c-10", sort_order: 39 },
];

/* ----------------------------- tree construction --------------------------- */
function buildTree(dbMenus) {
  const items = (Array.isArray(dbMenus) ? dbMenus : []).map((m) => ({
    ...m,
    id: String(m.id ?? m.code ?? Math.random()).trim(),
    code: String(m.code ?? m.name ?? m.label ?? "").trim(),
    label: String(m.label ?? m.name ?? m.code ?? "").trim(),
    path: normPath(m.path),
    parent_id: toNull(m.parent_id),
    module_code: m.module_code ?? null,
    sort_order: m.sort_order ?? 0,
  }));

  const idMap = new Map(items.map((x) => [x.id, x]));
  const children = new Map();
  for (const it of items) {
    if (!children.has(it.parent_id)) children.set(it.parent_id, []);
    children.get(it.parent_id).push(it);
  }
  for (const arr of children.values()) arr.sort(byOrder);

  const roots = (children.get(null) || []).filter(isRootCandidate).sort(byOrder);

  // If no CRM root but crm-like items exist, synthesize CRM root and re-parent
  const hasCrmRoot = roots.some((r) => r.code === "crm");
  if (!hasCrmRoot) {
    const crmish = items.filter((m) => !isRootCandidate(m) && isCrmLike(m));
    if (crmish.length) {
      const crmRoot = {
        id: "__synthetic_crm__",
        code: "crm",
        label: "CRM",
        path: "/app/crm",
        parent_id: null,
        sort_order: (roots.at(-1)?.sort_order ?? 20) + 1,
      };
      roots.push(crmRoot);
      children.set(crmRoot.id, crmish);

      // prune crmish from any other parents to avoid duplicates
      for (const m of crmish) {
        const arr = children.get(m.parent_id);
        if (!arr) continue;
        const idx = arr.findIndex((x) => x.id === m.id);
        if (idx >= 0) arr.splice(idx, 1);
        m.parent_id = crmRoot.id;
      }
    }
  }

  return { roots, children, idMap };
}

/* ------------------------------ search filter ------------------------------ */
function filterTree({ roots, children }, q) {
  if (!q) return { roots, children, matches: new Set() };
  const term = q.toLowerCase();
  const matches = new Set();

  const visit = (id) => {
    const kids = children.get(id) || [];
    for (const k of kids) {
      const hit =
        k.label?.toLowerCase().includes(term) ||
        k.code?.toLowerCase().includes(term) ||
        k.path?.toLowerCase().includes(term);
      if (hit) matches.add(k.id);
      visit(k.id);
    }
  };
  for (const r of roots) {
    const hit = r.label?.toLowerCase().includes(term) || r.code?.toLowerCase().includes(term);
    if (hit) matches.add(r.id);
    visit(r.id);
  }
  return { roots, children, matches };
}

/* --------------------------------- UI bits -------------------------------- */
function Row({ item, depth, openSet, onToggle, isActive, onLeafClick }) {
  const hasChildren = openSet.children.has(item.id);
  const isOpen = openSet.open.has(item.id);
  const isLeaf = !hasChildren;

  return (
    <div
      className={`group flex items-center select-none ${
        depth === 0 ? "py-2" : "py-1"
      } ${isActive ? "bg-white/5 rounded-lg" : ""}`}
    >
      {/* indent */}
      <div style={{ width: depth * 14 }} />

      {/* caret / bullet */}
      {hasChildren ? (
        <button
          onClick={() => onToggle(item.id)}
          className="mr-2 p-1 rounded-lg hover:bg-white/5 focus:outline-none"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      ) : (
        <span className="mr-2 w-5 h-5 grid place-items-center opacity-70">•</span>
      )}

      {/* icon */}
      <span className="mr-2 opacity-90">{iconFor(item.code)}</span>

      {/* label / link */}
      {item.path ? (
        <NavLink
          to={item.path}
          className={({ isActive: active }) =>
            `flex-1 min-w-0 truncate no-underline ${active ? "text-white" : "text-white/90 hover:text-white"}`
          }
          onClick={() => isLeaf && onLeafClick?.(item)}
        >
          {item.label || item.code}
        </NavLink>
      ) : (
        <span className="flex-1 min-w-0 truncate no-underline cursor-default">{item.label || item.code}</span>
      )}
    </div>
  );
}

export default function AppSidebar() {
  const { branding, menus } = useEnv();
  const location = useLocation();

  // compute DB-first or fallback
  const sourceMenus = useMemo(() => (Array.isArray(menus) && menus.length ? menus : FALLBACK), [menus]);
  const { roots, children, idMap } = useMemo(() => buildTree(sourceMenus), [sourceMenus]);

  // build child map presence for quick checks
  const childrenPresence = useMemo(() => {
    const map = new Map();
    for (const r of roots) map.set(r.id, !!(children.get(r.id)?.length));
    for (const [pid, arr] of children.entries()) map.set(pid, !!arr?.length);
    return map;
  }, [roots, children]);

  // open state — collapsed by default
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState("");

  // expose which nodes have children
  const openSet = useMemo(
    () => ({ open: openIds, children: childrenPresence }),
    [openIds, childrenPresence]
  );

  // auto-open ancestors of active route
  useEffect(() => {
    const p = normPath(location.pathname);
    if (!p) return;

    // find the deepest item whose path is prefix of current path
    let active = null;
    for (const item of idMap.values()) {
      if (!item.path) continue;
      const ip = normPath(item.path);
      if (ip && p.startsWith(ip)) {
        if (!active || (ip?.length || 0) > (active.path?.length || 0)) active = item;
      }
    }
    if (!active) return;

    // climb ancestors to roots and open them
    const toOpen = new Set(openIds);
    let cursor = active;
    const reverseParent = new Map();
    for (const [pid, arr] of children.entries()) for (const it of arr) reverseParent.set(it.id, pid);

    let guard = 0;
    while (cursor && guard++ < 200) {
      const pid = reverseParent.get(cursor.id);
      if (pid === null || pid === undefined) break;
      toOpen.add(pid);
      cursor = idMap.get(pid);
    }
    setOpenIds(toOpen);
  }, [location.pathname, idMap, children]);

  // search filter (just determines which rows are emphasized/opened)
  const { matches } = useMemo(() => filterTree({ roots, children }, query), [roots, children, query]);
  useEffect(() => {
    if (!query) return; // when searching, auto-open all roots for visibility
    const nxt = new Set(openIds);
    for (const r of roots) nxt.add(r.id);
    setOpenIds(nxt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onToggle = (id) => {
    const next = new Set(openIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenIds(next);
  };

  const onLeafClick = () => {
    // keep sections state; no auto-collapse
  };

  /* ------------------------------ render helpers ------------------------------ */
  const renderBranch = (node, depth = 0) => {
    const kids = children.get(node.id) || [];
    const hasKids = kids.length > 0;
    const isOpen = openIds.has(node.id);

    const isActiveExact = normPath(node.path) === normPath(location.pathname);

    return (
      <div key={node.id}>
        <Row
          item={node}
          depth={depth}
          openSet={openSet}
          onToggle={onToggle}
          isActive={!!isActiveExact || matches.has(node.id)}
          onLeafClick={onLeafClick}
        />
        {hasKids && isOpen && (
          <div className="ml-0">
            {kids.map((c) => renderBranch(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  /* ----------------------------------- UI ----------------------------------- */
  return (
    <aside className="w-72 max-w-72 min-w-60 h-screen gg-surface text-white flex flex-col border-r border-white/10">
      {/* Brand header */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10">
        {branding?.logo_url ? (
          <img src={branding.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-sm">GG</div>
        )}
        <div className="font-semibold tracking-wide">GeniusGrid</div>
      </div>

      {/* Search */}
      <div className="p-3">
        <label className="relative block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            className="w-full pl-9 pr-3 h-9 rounded-lg bg-white/10 focus:bg-white/15 outline-none placeholder-white/60"
            placeholder="Search menus…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {/* Scrollable menu area (vertical auto-scroll) */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
        {/* Only show true roots: Admin, CRM */}
        {roots
          .filter((r) => r.code === "admin" || r.code === "crm")
          .sort(byOrder)
          .map((r) => renderBranch(r, 0))}
      </div>

      {/* Footer (optional) */}
      <div className="h-10 border-t border-white/10 text-xs text-white/60 grid place-items-center">
        v1 · Sidebar
      </div>
    </aside>
  );
}
