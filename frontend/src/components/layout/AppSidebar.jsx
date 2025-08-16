import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ------------------ HARD-CODED TREE: Admin + FULL CRM ------------------ */
const TREE = [
  // ---- Admin ----
  {
    id: "c0551da9-0d0b-4dae-9160-63f8f9e3bd27",
    label: "Admin",
    path: "/app/admin",
    icon: "⚙️",
    children: [
      {
        id: "df01cefd-066f-467a-8b60-1eb80e6bc766",
        label: "Organization & Compliance",
        icon: "🏢",
        children: [
          { id: "4f7052c5-d54e-4e80-9a97-18f5b807e1f6", label: "Organization Profile", path: "/app/admin/org", icon: "🏢" },
          { id: "1ebd45b9-ccd7-4ef6-afee-5d5a9d63a086", label: "Branding / Theme", path: "/app/admin/branding", icon: "🎨" },
          { id: "08ed696a-4f8c-41d1-85ae-70a66b312e28", label: "Localization", path: "/app/admin/localization", icon: "🌐" },
          { id: "d8e587a4-17f9-4a4b-9de9-9021c40f9ffb", label: "Tax & Compliance", path: "/app/admin/taxes", icon: "🧾" },
          { id: "4f81d8b8-3fa2-4b5e-afef-39558a540584", label: "Business Units & Depts", path: "/app/admin/units", icon: "🏢" },
          { id: "9bb28719-23f1-471e-89ee-9debac65805f", label: "Locations", path: "/app/admin/locations", icon: "📍" },
          { id: "e688fd45-4389-4ebf-bbdb-7400d911501e", label: "Calendars & Holidays", path: "/app/admin/calendars", icon: "📅" },
          { id: "e838bfbd-e571-4223-80e8-a304ca8428ad", label: "Numbering Schemes", path: "/app/admin/numbering", icon: "🔢" },
          { id: "31291e57-74a6-4ddb-a97e-9ece1f6bd855", label: "Compliance Policies", path: "/app/admin/compliance", icon: "🛡️" },
        ],
      },
      {
        id: "cce5095b-7aa1-4c8c-af9c-53203b8c6b11",
        label: "Access Control (RBAC)",
        icon: "🛡️",
        children: [
          { id: "7045a9c2-2110-4710-9ada-1325f43d0ffd", label: "Users", path: "/app/admin/users", icon: "👤" },
          { id: "4a4611f8-2a16-499e-bd3c-3b97ba1d9eab", label: "Roles", path: "/app/admin/roles", icon: "🛡️" },
          { id: "d8639e8e-b202-4fac-83f5-da2541e97da8", label: "Permissions Matrix", path: "/app/admin/permissions", icon: "🗂️" },
          { id: "794c4598-adb3-43aa-a7e9-cce95e6dc903", label: "Teams & Territories", path: "/app/admin/teams", icon: "🧭" },
        ],
      },
      {
        id: "405fd86c-d329-4a3f-a705-be541deb5002",
        label: "Security & Compliance",
        icon: "🔐",
        children: [
          { id: "c6354bf5-2bbf-4d6e-8d61-56b8e1800a15", label: "Security Policies", path: "/app/admin/security", icon: "🔐" },
          { id: "0563c6c8-00db-4921-a367-2bfbeb038402", label: "SSO & MFA", path: "/app/admin/sso", icon: "🧷" },
          { id: "5c696323-4394-4b55-a04b-a16b55611e79", label: "Domains", path: "/app/admin/domains", icon: "🌐" },
          { id: "450645a5-c362-4263-9a91-66ab1d998c53", label: "Audit Logs", path: "/app/admin/audit", icon: "📜" },
        ],
      },
      {
        id: "a39f43d4-9562-4f60-b0e9-4cd9bdb87858",
        label: "Data & Customization",
        icon: "🧩",
        children: [
          { id: "fb5c3948-dce3-4d6e-abdb-7e6e5bef941a", label: "Settings", path: "/app/admin/settings", icon: "🧩" },
          { id: "8b2f1075-8d51-4e75-88c5-2b105bbdb9f8", label: "Custom Fields", path: "/app/admin/custom-fields", icon: "🏷️" },
          { id: "702357e7-226b-43c6-b1b8-0d6f1278f615", label: "Pipelines & Stages", path: "/app/admin/pipelines", icon: "🪜" },
          { id: "bc7db83e-25a0-4d05-96e3-6a660f7fd91c", label: "Templates", path: "/app/admin/templates", icon: "🧾" },
          { id: "aec1b75a-6c2-4631-8599-aea90dbd51dc", label: "Notifications", path: "/app/admin/notifications", icon: "🔔" },
          { id: "bf12fb22-1e9e-45ff-9fc2-185b62f2b2f6", label: "Import / Export", path: "/app/admin/import", icon: "⬇️" },
          { id: "e0e71edb-41e0-40e4-829c-7f7b9ab56c38", label: "Backups", path: "/app/admin/backups", icon: "💾" },
        ],
      },
      {
        id: "687d1032-9011-4df3-b8ec-5b98ed9bab74",
        label: "Integrations & Developer",
        icon: "🔌",
        children: [
          { id: "a494d3ec-bcbf-44b1-88bd-038a1333ffea", label: "Integrations", path: "/app/admin/integrations", icon: "🔌" },
          { id: "a6655acd-7fc3-4894-9071-36d449432937", label: "Marketplace", path: "/app/admin/marketplace", icon: "🛍️" },
          { id: "74009359-f8dc-46f2-ac93-fd87e96a753d", label: "API Keys", path: "/app/admin/api-keys", icon: "🗝️" },
          { id: "f00ed247-77b5-4691-98d7-4cc64ce1d8a4", label: "Webhooks", path: "/app/admin/webhooks", icon: "🪝" },
          { id: "9dfe1f7d-1d95-4a98-9a55-d9e6782c9181", label: "Feature Flags", path: "/app/admin/features", icon: "🚩" },
        ],
      },
      {
        id: "e556a0df-fb07-42ea-b35d-5a1fb1898b92",
        label: "AI & Automation",
        icon: "✨",
        children: [
          { id: "fe316357-ab65-4960-aa52-13ec401c7a5c", label: "AI Settings", path: "/app/admin/ai", icon: "✨" },
          { id: "8febc35d-0673-415a-a9a8-5664bd84a15a", label: "Automation Rules", path: "/app/admin/automation", icon: "🤖" },
          { id: "404b8db8-1ec2-42a4-9b6d-7b1698d78240", label: "Approvals", path: "/app/admin/approvals", icon: "✅" },
        ],
      },
      {
        id: "1b50ac86-2dd1-469c-b8bd-cc8089141196",
        label: "Billing & Observability",
        icon: "💳",
        children: [
          { id: "215f2f54-39d6-4185-874b-9f32514e2b3a", label: "Billing & Subscription", path: "/app/admin/billing", icon: "💳" },
          { id: "ec70c96b-1036-47b8-a2be-7e2182fbb33d", label: "Usage & Limits", path: "/app/admin/usage", icon: "📈" },
          { id: "d3376529-968d-44b3-8080-a14189da48db", label: "System Logs", path: "/app/admin/logs", icon: "🧾" },
        ],
      },
    ],
  },

  // ---- CRM ----
  {
    id: "561b9761-5642-4d4f-8826-8cadf9822f8a",
    label: "CRM",
    path: "/app/crm",
    icon: "🤝",
    children: [
      {
        id: "crm.grp.workspace",
        label: "Workspace",
        icon: "🗂️",
        children: [
          { id: "crm.home", label: "Overview", path: "/app/crm", icon: "🏠" },
          { id: "crm.myday", label: "My Day", path: "/app/crm/my-day", icon: "📆" },
          { id: "crm.inbox", label: "Inbox", path: "/app/crm/inbox", icon: "📥" },
          { id: "crm.tasks", label: "Tasks", path: "/app/crm/tasks", icon: "✅" },
        ],
      },
      {
        id: "crm.grp.sales",
        label: "Sales Execution",
        icon: "🚀",
        children: [
          { id: "c50dd780-69b6-4384-adc7-10469d7d865c", label: "Leads", path: "/app/crm/leads", icon: "📇" },
          { id: "803d2d5e-37c4-466a-af24-d1a7bc3dc780", label: "Contacts", path: "/app/crm/contacts", icon: "👥" },
          { id: "0254b519-fafb-48d7-8604-7a989f102511", label: "Companies", path: "/app/crm/companies", icon: "🏢" },
          { id: "5aa1de70-b3ab-4b98-af6d-f707e2701b7a", label: "Deals / Pipeline", path: "/app/crm/deals", icon: "📊" },
          { id: "595ba687-af32-4689-9307-4de879e9c7a2", label: "Calls", path: "/app/crm/calls", icon: "📞" },
          { id: "crm.meetings", label: "Meetings / Calendar", path: "/app/crm/meetings", icon: "📅" },
          { id: "crm.email", label: "Email", path: "/app/crm/email", icon: "✉️" },
          { id: "crm.chat", label: "Chat", path: "/app/crm/chat", icon: "💬" },
          { id: "crm.documents", label: "Documents", path: "/app/crm/documents", icon: "📄" },
        ],
      },
      {
        id: "crm.grp.ai",
        label: "AI & Intelligence",
        icon: "✨",
        children: [
          { id: "60b102de-53a2-4ce6-8bc6-021c8812f2c0", label: "Discover (AI)", path: "/app/crm/discover", icon: "✨" },
          { id: "crm.ai.copilot", label: "Sales Copilot", path: "/app/crm/ai/copilot", icon: "🤖" },
          { id: "crm.ai.scoring", label: "Lead Scoring", path: "/app/crm/ai/lead-scoring", icon: "🎯" },
          { id: "crm.ai.dealinsights", label: "Deal Insights", path: "/app/crm/ai/deal-insights", icon: "🔮" },
          { id: "crm.ai.summaries", label: "Summaries & Next Steps", path: "/app/crm/ai/summaries", icon: "📝" },
          { id: "crm.ai.convintel", label: "Conversation Intelligence", path: "/app/crm/ai/conversations", icon: "🎧" },
        ],
      },
      {
        id: "crm.grp.outreach",
        label: "Outreach & Automation",
        icon: "📣",
        children: [
          { id: "crm.sequences", label: "Sequences", path: "/app/crm/sequences", icon: "🔁" },
          { id: "crm.campaigns", label: "Campaigns", path: "/app/crm/campaigns", icon: "📢" },
          { id: "crm.playbooks", label: "Playbooks", path: "/app/crm/playbooks", icon: "📘" },
          { id: "crm.templates", label: "Templates", path: "/app/crm/templates", icon: "🧾" },
        ],
      },
      {
        id: "crm.grp.analytics",
        label: "Analytics & Forecast",
        icon: "📈",
        children: [
          { id: "76c53d5b-2646-4683-862a-f8f3afaf5c8c", label: "Reports", path: "/app/crm/reports", icon: "📈" },
          { id: "crm.dashboards", label: "Dashboards", path: "/app/crm/dashboards", icon: "📊" },
          { id: "crm.forecast", label: "Forecast", path: "/app/crm/forecast", icon: "📉" },
          { id: "crm.targets", label: "Targets & Quotas", path: "/app/crm/targets", icon: "🎯" },
        ],
      },
      {
        id: "crm.grp.data",
        label: "Data & Enrichment",
        icon: "🧠",
        children: [
          { id: "crm.import", label: "Import", path: "/app/crm/import", icon: "⬇️" },
          { id: "crm.dedupe", label: "Deduplication", path: "/app/crm/dedupe", icon: "🧹" },
          { id: "crm.enrichment", label: "Enrichment", path: "/app/crm/enrichment", icon: "✨" },
          { id: "crm.merge", label: "Merge / Clean", path: "/app/crm/merge", icon: "🧽" },
        ],
      },
      {
        id: "crm.grp.integrations",
        label: "Integrations",
        icon: "🔌",
        children: [
          { id: "crm.int.telephony", label: "Telephony", path: "/app/crm/integrations/telephony", icon: "📞" },
          { id: "crm.int.email", label: "Email (Gmail/Outlook)", path: "/app/crm/integrations/email", icon: "✉️" },
          { id: "crm.int.calendar", label: "Calendar", path: "/app/crm/integrations/calendar", icon: "📅" },
          { id: "crm.int.slack", label: "Slack", path: "/app/crm/integrations/slack", icon: "💬" },
          { id: "crm.int.forms", label: "Web Forms", path: "/app/crm/integrations/forms", icon: "📝" },
        ],
      },
      {
        id: "crm.grp.comp",
        label: "Comp & Incentives",
        icon: "💰",
        children: [
          { id: "crm.incentives.dashboard", label: "Incentives", path: "/app/crm/incentives", icon: "📈" },
          { id: "crm.incentives.plans",     label: "Plans",      path: "/app/crm/incentives/plans", icon: "🗂️" },
          { id: "crm.incentives.payouts",   label: "Payouts",    path: "/app/crm/incentives/payouts", icon: "💳" },
          { id: "crm.incentives.leader",    label: "Leaderboard",path: "/app/crm/incentives/leaderboard", icon: "🏆" }
        ],
      },
    ],
  },
];

/* ------------------ UI helpers ------------------ */
const ARROW = 18;
const Chevron = ({ open }) => (
  <svg width={ARROW} height={ARROW} viewBox="0 0 24 24" className="opacity-80" aria-hidden>
    <path d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Spacer = () => <span style={{ width: ARROW, height: ARROW, display: "inline-block" }} />;

/* ------------------ Tree utilities ------------------ */
function walk(nodes, fn, parentId = null) {
  (nodes || []).forEach(n => {
    fn(n, parentId);
    if (n.children) walk(n.children, fn, n.id);
  });
}

function buildParentMap(nodes) {
  const parent = new Map(); // childId -> parentId
  walk(nodes, (n, p) => parent.set(n.id, p));
  return parent;
}

function findNodeByPath(nodes, path) {
  let found = null;
  walk(nodes, (n) => {
    if (!found && n.path && path && path.startsWith(n.path)) found = n;
  });
  return found;
}

function ancestorsOf(id, parentMap) {
  const list = [];
  let cur = parentMap.get(id);
  while (cur) {
    list.push(cur);
    cur = parentMap.get(cur);
  }
  return list; // nearest parent first
}

/* Search: prune tree by query; return pruned nodes + ids to auto-open */
function filterTree(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { pruned: nodes, expandIds: new Set() };

  const expandIds = new Set();

  const match = (label) => (label || "").toLowerCase().includes(q);

  const recur = (arr) => {
    const out = [];
    for (const n of arr) {
      const kids = n.children ? recur(n.children) : [];
      const selfHit = match(n.label);
      if (selfHit || kids.length) {
        if (kids.length) expandIds.add(n.id); // open ancestors of any match
        out.push({ ...n, children: kids });
      }
    }
    return out;
  };

  return { pruned: recur(nodes), expandIds };
}

/* Highlight query match in the label */
function Highlight({ text, query }) {
  if (!query) return <>{text}</>;
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = String(text).toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-600/40 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* ------------------ Component ------------------ */
export default function AppSidebar() {
  const { branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  // open state: ids in a Set
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState("");

  const parentMap = useMemo(() => buildParentMap(TREE), []);
  const { pruned: visibleTree, expandIds } = useMemo(
    () => filterTree(TREE, query),
    [query]
  );

  const isOpen = (id) => openIds.has(id);
  const openMany = (ids) => setOpenIds((prev) => {
    const next = new Set(prev);
    ids.forEach(i => next.add(i));
    return next;
  });
  const closeAll = () => setOpenIds(new Set());
  const openAll = () => {
    const all = new Set();
    walk(TREE, (n) => { if (n.children?.length) all.add(n.id); });
    setOpenIds(all);
  };
  const toggle = (id) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Auto-open ancestors of active route
  useEffect(() => {
    const match = findNodeByPath(TREE, loc.pathname);
    if (match) openMany(ancestorsOf(match.id, parentMap));
    // scroll active into view
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + (eTop - cTop - 120), behavior: "smooth" });
    }
  }, [loc.pathname, parentMap]);

  // When searching, auto-open all ancestors of matches
  useEffect(() => {
    if (query) openMany(expandIds);
  }, [query, expandIds]);

  function Node({ node, depth = 0 }) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const open = isOpen(node.id);
    const pad = depth > 0 ? "ml-3" : "";

    // Group (toggle via chevron or row)
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
            <span className="truncate">
              <Highlight text={node.label} query={query} />
            </span>
          </button>

          {open && (
            <div id={`children-${node.id}`} className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    // Leaf link
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
          <span className="truncate">
            <Highlight text={node.label} query={query} />
          </span>
        </NavLink>
      </div>
    );
  }

  return (
    <aside className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col" style={{ width: "16rem", minWidth: "16rem" }}>
      {/* Top: Logo + Brand */}
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
          <button
            type="button"
            onClick={openAll}
            className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700"
            title="Expand all"
          >
            ⤢
          </button>
          <button
            type="button"
            onClick={closeAll}
            className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700"
            title="Collapse all"
          >
            ⤡
          </button>
        </div>
      </div>

      {/* Menu list */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        {visibleTree.length === 0 ? (
          <div className="text-xs text-gray-400 px-3 py-2">No matches.</div>
        ) : (
          visibleTree.map((root) => <Node key={root.id} node={root} />)
        )}
      </div>
    </aside>
  );
}
