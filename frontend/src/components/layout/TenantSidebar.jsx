// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ── Icons ── */
function EmojiIcon({ glyph, className }) { return <span className={className} aria-hidden="true">{glyph}</span>; }
function isEmoji(x){ try{ return /[\p{Extended_Pictographic}]/u.test(x||""); }catch{ return /[^\w\s]/.test(x||""); } }
function iconByName(name){
  if(!name) return IconSet.Folder;
  if(isEmoji(name)) return (p)=><EmojiIcon glyph={name} className={`w-4 h-4 ${p?.className||""}`} />;
  if(IconSet[name]) return IconSet[name];
  const pascal = String(name).split(/[-_ ]+/).map(s=>s[0]?.toUpperCase()+s.slice(1)).join("");
  return IconSet[pascal] || IconSet.Folder;
}

/* ── Admin grouping (deterministic by code) ── */
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
const ADMIN_FALLBACK = { code: ADMIN, name: "Admin", path: "/app/admin", icon: "Settings", sort: 10 };

/* ── Normalization ── */
function norm(r){
  const code = r.code ?? String(r.id ?? r.menu_id ?? r.menuId ?? "");
  const name = r.name ?? r.label ?? code;
  const path = r.path ?? r.url ?? r.route ?? null; // keep '/app' prefix (your router expects it)
  const icon = r.icon ?? r.emoji ?? null;
  const sort = r.sort_order ?? r.sortOrder ?? 999;
  return { code, name, path, icon, sort, children: [] };
}

/* ── Tree builder: no parent_id required ── */
function buildTree(rawRows){
  const rows = (rawRows||[]).map(norm).filter(x=>x.code);
  const byCode = Object.fromEntries(rows.map(r=>[r.code, r]));

  // Dev-only peek to ensure data is present
  if (typeof window !== "undefined" && !window.__GG_MENU_LOGGED__) {
    window.__GG_MENU_LOGGED__ = true;
    try { console.table(rows.map(({code,name,path})=>({code,name,path}))); } catch {}
  }

  // Map: code → node
  const nodes = new Map();
  const ensure = (code, init={})=>{
    if(!nodes.has(code)) nodes.set(code, { code, name:init.name||code, path:init.path||null, icon:init.icon||null, sort:init.sort??999, children: [] });
    const n = nodes.get(code);
    // Prefer concrete row props when available
    const r = byCode[code];
    if(r){ n.name = r.name ?? n.name; n.path = r.path ?? n.path; n.icon = r.icon ?? n.icon; n.sort = r.sort ?? n.sort; }
    return n;
  };
  const addChild = (parentCode, childCode)=>{
    const p = nodes.get(parentCode), c = nodes.get(childCode);
    if(!p || !c) return;
    if(!p.children.some(x=>x.code===childCode)) p.children.push(c);
  };

  /* 1) Ensure module roots for any "module.page" codes (crm.*, sales.*, etc.) */
  const modulePrefixes = new Set();
  for(const r of rows){
    const mod = r.code.split(".")[0];
    if(mod && mod !== r.code) modulePrefixes.add(mod);
  }
  for(const mod of modulePrefixes){
    // Try to take the row with code === mod; otherwise synthesize.
    const r = byCode[mod];
    ensure(mod, { name: r?.name ?? mod.toUpperCase(), path: r?.path ?? `/app/${mod}`, icon: r?.icon ?? "Folder", sort: r?.sort ?? (mod===ADMIN?10:20) });
  }

  /* 2) Admin root (even if missing as a row) */
  if (rows.some(r=>r.code.startsWith("admin"))) ensure(ADMIN, ADMIN_FALLBACK);

  /* 3) Admin groups (always as headings) */
  for(const g of ADMIN_GROUPS){
    ensure(g.code, { name: byCode[g.code]?.name ?? g.name, path: null, icon: byCode[g.code]?.icon ?? g.icon, sort: byCode[g.code]?.sort ?? g.sort });
    addChild(ADMIN, g.code);
  }

  /* 4) Place all items deterministically */
  for(const r of rows){
    ensure(r.code); // make sure the node exists with real props

    if(r.code === ADMIN) continue;

    if(r.code.startsWith("admin.grp.")){
      // Force headings to be non-clickable
      const n = nodes.get(r.code); n.path = null;
      continue;
    }

    if(r.code.startsWith("admin.")){
      // Put admin pages under one of the 7 groups (or directly under Admin if unknown)
      const g = ADMIN_GROUPS.find(G => G.kids.has(r.code));
      addChild(g ? g.code : ADMIN, r.code);
      continue;
    }

    // Non-admin modules: "crm.leads" → parent "crm"
    if(r.code.includes(".")){
      const mod = r.code.split(".")[0];
      ensure(mod); addChild(mod, r.code);
    }
  }

  /* 5) Roots = nodes that are not children of anyone, excluding admin.grp.* */
  const childCodes = new Set(); for(const n of nodes.values()) n.children.forEach(c=>childCodes.add(c.code));
  const roots = [...nodes.values()].filter(n => !childCodes.has(n.code) && !n.code.startsWith("admin.grp."));

  /* 6) Sort (stable & readable) */
  const byName = (a,b)=> String(a.name||"").localeCompare(String(b.name||""));
  const bySort = (a,b)=> (a.sort??999)-(b.sort??999) || byName(a,b);
  const sortDeep = (arr)=>{ arr.sort(bySort); arr.forEach(n=>n.children?.length && sortDeep(n.children)); return arr; };
  return sortDeep(roots);
}

/* ── Node ── */
function NodeItem({ node, depth=0, defaultOpen=false, onNavigate }){
  const hasChildren = (node.children?.length||0)>0;
  const linkPath = node.path; // keep '/app'
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

/* ── Sidebar ── */
export default function TenantSidebar({ onNavigate }){
  const { menus } = useEnv(); // expects array with at least { code, name, path }
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
