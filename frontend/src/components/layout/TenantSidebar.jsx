import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ───────────── Icons ───────────── */
function EmojiIcon({ glyph, className }) {
  return <span className={className} aria-hidden="true">{glyph}</span>;
}
function isEmoji(x){ try{ return /[\p{Extended_Pictographic}]/u.test(x||""); }catch{ return /[^\w\s]/.test(x||""); } }
function iconByName(name){
  if(!name) return IconSet.Dot;
  if(isEmoji(name)) return (p)=><EmojiIcon glyph={name} className={`w-4 h-4 ${p?.className||""}`}/>;
  if(IconSet[name]) return IconSet[name];
  const pascal = String(name).split(/[-_ ]+/).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join("");
  return IconSet[pascal] || IconSet.Dot;
}

/* ───────────── Admin grouping (by code) ───────────── */
const ADMIN = "admin";
const ADMIN_GROUPS = [
  { code:"admin.grp.org",  name:"Organization & Compliance", icon:"🏢", sort:21,
    kids:new Set(["admin.org","admin.branding","admin.localization","admin.taxes","admin.units","admin.locations","admin.calendars","admin.numbering","admin.compliance"]) },
  { code:"admin.grp.rbac", name:"Access Control (RBAC)", icon:"🛡️", sort:22,
    kids:new Set(["admin.users","admin.roles","admin.permissions","admin.teams"]) },
  { code:"admin.grp.sec",  name:"Security & Compliance", icon:"🔐", sort:23,
    kids:new Set(["admin.security","admin.sso","admin.domains","admin.audit"]) },
  { code:"admin.grp.data", name:"Data & Customization", icon:"🧩", sort:24,
    kids:new Set(["admin.settings","admin.custom-fields","admin.pipelines","admin.templates","admin.notifications","admin.import_export","admin.backups"]) },
  { code:"admin.grp.int",  name:"Integrations & Developer", icon:"🔌", sort:25,
    kids:new Set(["admin.integrations","admin.marketplace","admin.api_keys","admin.webhooks","admin.features"]) },
  { code:"admin.grp.ai",   name:"AI & Automation", icon:"✨", sort:26,
    kids:new Set(["admin.ai","admin.automation","admin.approvals"]) },
  { code:"admin.grp.bill", name:"Billing & Observability", icon:"💳", sort:27,
    kids:new Set(["admin.billing","admin.usage","admin.logs"]) },
];

function findAdminGroup(code){
  for(const g of ADMIN_GROUPS) if(g.kids.has(code)) return g.code;
  return null;
}

/* ───────────── Normalization ───────────── */
function norm(r){
  const code = r.code ?? String(r.id ?? r.menu_id ?? r.menuId ?? "");
  const name = r.name ?? r.label ?? code;
  const path = r.path ?? r.url ?? r.route ?? null; // keep '/app' (your router uses it)
  const icon = r.icon ?? r.emoji ?? null;
  const sort = r.sort_order ?? r.sortOrder ?? 999;
  return { code, name, path, icon, sort, children: [] };
}

/* ───────────── Deterministic tree (no parent_id needed) ───────────── */
function buildTree(rawRows){
  const rows = (rawRows||[]).map(norm).filter(x=>x.code);
  const byCode = Object.fromEntries(rows.map(r=>[r.code, r]));
  const nodes = new Map(); // code -> node

  const ensure = (code, init) => {
    if(!nodes.has(code)) nodes.set(code, { code, name:init?.name??code, path:init?.path??null, icon:init?.icon??null, sort:init?.sort??999, children: [] });
    return nodes.get(code);
  };
  const addChild = (parentCode, childCode) => {
    const p = nodes.get(parentCode);
    const c = nodes.get(childCode);
    if(!p || !c) return;
    if(!p.children.some(x=>x.code===childCode)) p.children.push(c);
  };

  // 1) Seed known module roots (from data)
  //    Any top-level code without a dot (e.g., admin, crm, sales…) becomes a root.
  for(const r of rows){
    if(!r.code.includes(".")){
      const root = ensure(r.code, r);
      // prefer real row values over synthetic
      root.name = r.name ?? root.name;
      root.path = r.path ?? root.path;
      root.icon = r.icon ?? root.icon;
      root.sort = r.sort ?? root.sort;
    }
  }

  // 2) Ensure Admin root exists if any admin.* item is present
  if(rows.some(r=>r.code.startsWith("admin"))){
    const r = byCode[ADMIN];
    ensure(ADMIN, { name: r?.name ?? "Admin", path: r?.path ?? "/app/admin", icon: r?.icon ?? "Settings", sort: r?.sort ?? 10 });
  }

  // 3) Ensure Admin groups exist (headings, non-clickable)
  for(const g of ADMIN_GROUPS){
    const row = byCode[g.code];
    ensure(g.code, { name: row?.name ?? g.name, path: null, icon: row?.icon ?? g.icon, sort: row?.sort ?? g.sort });
    addChild(ADMIN, g.code);
  }

  // 4) Place every item deterministically
  for(const r of rows){
    ensure(r.code, r); // register node with its real props

    if(r.code === ADMIN) continue;
    if(r.code.startsWith("admin.grp.")) {
      // group headings already attached to admin (step 3)
      nodes.get(r.code).path = null; // enforce non-clickable
      continue;
    }
    if(r.code.startsWith("admin.")) {
      const gcode = findAdminGroup(r.code);
      if(gcode) addChild(gcode, r.code);
      else addChild(ADMIN, r.code); // fallback if a page isn’t mapped yet
      continue;
    }

    // Non-admin modules: use prefix before the first dot as parent.
    // Example: "crm.leads" → parent "crm"
    const mod = r.code.split(".")[0];
    // Ensure module root exists even if not in data
    if(!nodes.has(mod)){
      const maybe = byCode[mod];
      ensure(mod, { name: maybe?.name ?? mod.toUpperCase(), path: maybe?.path ?? `/app/${mod}`, icon: maybe?.icon ?? "Folder", sort: maybe?.sort ?? 50 });
    }
    if(r.code !== mod) addChild(mod, r.code);
  }

  // 5) Collect roots (nodes never added as children)
  const childCodes = new Set();
  for(const n of nodes.values()) for(const c of n.children) childCodes.add(c.code);
  const roots = [...nodes.values()].filter(n => !childCodes.has(n.code) && (!n.code.startsWith("admin.grp.")));

  // 6) Sort everything
  const byName = (a,b)=> String(a.name||"").localeCompare(String(b.name||""));
  const bySort = (a,b)=> (a.sort??999)-(b.sort??999) || byName(a,b);
  const sortDeep = (arr)=>{ arr.sort(bySort); arr.forEach(n=>n.children?.length && sortDeep(n.children)); return arr; };
  return sortDeep(roots);
}

/* ───────────── Node component ───────────── */
function NodeItem({ node, depth=0, defaultOpen=false, onNavigate }){
  const hasChildren = (node.children?.length||0) > 0;
  const linkPath = node.path; // keep '/app' prefix (your routes use it)
  const isLeaf = !!linkPath && !hasChildren;
  const [open, setOpen] = useState(defaultOpen);
  const Icon = iconByName(node.icon);
  const pad = 16 + depth*18;
  const base = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";

  if(isLeaf){
    return (
      <NavLink
        to={linkPath}
        end
        onClick={onNavigate}
        className={({isActive}) => `${base} ${isActive ? "bg-white/10 text-white" : "text-gray-300 hover:text-white hover:bg-white/5"}`}
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
        className={`${base} text-gray-300 hover:text-white hover:bg-white/5 w-full text-left font-medium`}
        onClick={()=>setOpen(v=>!v)} aria-expanded={open} style={{ paddingLeft: pad }}
      >
        <Icon className="w-4 h-4 opacity-80" />
        <span className="flex-1 truncate">{node.name}</span>
        {open ? <IconSet.ChevronDown className="w-4 h-4" /> : <IconSet.ChevronRight className="w-4 h-4" />}
      </button>
      {hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden" style={{ marginLeft: pad }}>
              <div className="border-l border-white/10 pl-3">
                {node.children.map(ch=>(
                  <NodeItem key={ch.code} node={ch} depth={depth+1} onNavigate={onNavigate}/>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ───────────── Sidebar ───────────── */
export default function TenantSidebar({ onNavigate }){
  const { menus } = useEnv();  // can be v_menu_for_tenant OR your existing rows
  const tree = useMemo(()=>buildTree(menus||[]), [menus]);
  return (
    <aside className="w-64 shrink-0 hidden md:flex md:flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10 p-3">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Menu</div>
      <div className="mt-2 space-y-1">
        {tree.length ? tree.map(n=>(
          <NodeItem key={n.code} node={n} defaultOpen={true} onNavigate={onNavigate}/>
        )) : <div className="text-sm opacity-70">No menus</div>}
      </div>
      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}
