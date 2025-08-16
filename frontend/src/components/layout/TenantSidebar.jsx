// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ---- icons ---- */
const Emoji = ({ g, className }) => <span className={className} aria-hidden="true">{g}</span>;
const isEmoji = (x)=>{ try{return /[\p{Extended_Pictographic}]/u.test(x||"")}catch{return /[^\w\s]/.test(x||"")} };
function iconByName(name){
  if(!name) return IconSet.Folder;
  if(isEmoji(name)) return (p)=><Emoji g={name} className={`w-4 h-4 ${p?.className||""}`} />;
  if(IconSet[name]) return IconSet[name];
  const pascal = String(name).split(/[-_ ]+/).map(s=>s[0]?.toUpperCase()+s.slice(1)).join("");
  return IconSet[pascal] || IconSet.Folder;
}

/* ---- admin group definitions (by code) ---- */
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
  { code:"admin.grp.org" , name:"Organization & Compliance", icon:"🏢", sort:21, kids:G.org  },
  { code:"admin.grp.rbac", name:"Access Control (RBAC)"    , icon:"🛡️", sort:22, kids:G.rbac },
  { code:"admin.grp.sec" , name:"Security & Compliance"    , icon:"🔐", sort:23, kids:G.sec  },
  { code:"admin.grp.data", name:"Data & Customization"     , icon:"🧩", sort:24, kids:G.data },
  { code:"admin.grp.int" , name:"Integrations & Developer" , icon:"🔌", sort:25, kids:G.int  },
  { code:"admin.grp.ai"  , name:"AI & Automation"          , icon:"✨", sort:26, kids:G.ai   },
  { code:"admin.grp.bill", name:"Billing & Observability"  , icon:"💳", sort:27, kids:G.bill},
];

/* ---- normalize just what we need ---- */
function norm(r){
  return {
    code: r.code ?? String(r.id ?? r.menu_id ?? r.menuId ?? ""),
    name: r.name ?? r.label ?? r.code ?? "Untitled",
    path: r.path ?? r.url ?? r.route ?? null,   // keep /app prefix
    icon: r.icon ?? r.emoji ?? null,
    sort: r.sort_order ?? r.sortOrder ?? 999,
  };
}

/* ---- build tree using only code patterns ---- */
function buildTree(raw){
  const rows = (raw||[]).map(norm).filter(x=>x.code);
  // one-time debug to confirm incoming rows
  if (typeof window !== "undefined" && !window.__GG_MENUS_DUMPED__) {
    window.__GG_MENUS_DUMPED__ = true;
    try { console.table(rows.map(({code,name,path})=>({code,name,path}))); } catch {}
  }

  // quick index
  const byCode = Object.fromEntries(rows.map(r=>[r.code,r]));

  // create roots if implied by children
  const needAdmin = rows.some(r => r.code === "admin" || r.code.startsWith("admin."));
  const needCrm   = rows.some(r => r.code === "crm"   || r.code.startsWith("crm."));
  const roots = [];
  const node = (r)=>({ code:r.code, name:r.name, path:r.path??null, icon:r.icon??null, sort:r.sort??999, children:[] });

  const rootAdmin = needAdmin
    ? node(byCode["admin"] ?? { code:"admin", name:"Admin", path:"/app/admin", icon:"Settings", sort:10 })
    : null;
  const rootCrm   = needCrm
    ? node(byCode["crm"]   ?? { code:"crm",   name:"CRM",   path:"/app/crm",   icon:"Handshake", sort:10 })
    : null;

  if (rootAdmin) {
    // add admin groups as headings
    ADMIN_GROUPS.forEach(g=>{
      const gr = byCode[g.code] ? node(byCode[g.code]) : { code:g.code, name:g.name, path:null, icon:g.icon, sort:g.sort, children:[] };
      // attach admin.* pages to their group
      rows.filter(r => r.code.startsWith("admin.") && !r.code.startsWith("admin.grp."))
          .forEach(r => { if (g.kids.has(r.code)) gr.children.push(node(r)); });
      // only show group if it has children
      if (gr.children.length) {
        gr.children.sort((a,b)=>(a.sort-b.sort)||a.name.localeCompare(b.name));
        rootAdmin.children.push(gr);
      }
    });
    rootAdmin.children.sort((a,b)=>(a.sort-b.sort)||a.name.localeCompare(b.name));
    roots.push(rootAdmin);
  }

  if (rootCrm) {
    // place crm.* under crm
    const crmKids = rows.filter(r => r.code.startsWith("crm.") && r.code !== "crm");
    crmKids.forEach(r => rootCrm.children.push(node(r)));
    rootCrm.children.sort((a,b)=>(a.sort-b.sort)||a.name.localeCompare(b.name));
    roots.push(rootCrm);
  }

  // any other modules like sales.*, purchase.* → show module root + children
  const modules = new Map(); // mod -> {root, kids[]}
  rows.forEach(r=>{
    if (r.code.includes(".") && !r.code.startsWith("admin.") && !r.code.startsWith("crm.")) {
      const mod = r.code.split(".")[0];
      if (!modules.has(mod)) {
        const rootRow = byCode[mod] ?? { code:mod, name:mod.toUpperCase(), path:`/app/${mod}`, icon:"Folder", sort:20 };
        modules.set(mod, { root: node(rootRow), kids: [] });
      }
      modules.get(mod).kids.push(node(r));
    }
  });
  for (const { root, kids } of modules.values()) {
    kids.sort((a,b)=>(a.sort-b.sort)||a.name.localeCompare(b.name));
    root.children = kids;
    roots.push(root);
  }

  // sort roots
  roots.sort((a,b)=>(a.sort-b.sort)||a.name.localeCompare(b.name));
  return roots;
}

/* ---- item ---- */
function Item({ n, depth=0, openDefault=false, onNavigate }){
  const [open, setOpen] = useState(openDefault);
  const hasKids = (n.children?.length||0) > 0;
  const isLeaf = !hasKids && !!n.path;
  const Icon = iconByName(n.icon);
  const pad = 16 + depth*18;
  const base = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";

  if (isLeaf) {
    return (
      <NavLink
        to={n.path}
        end
        onClick={onNavigate}
        className={({isActive}) => `${base} ${isActive ? "bg-white/10 text-white" : "text-gray-300 hover:text-white hover:bg-white/5"}`}
        style={{ paddingLeft: pad }}
      >
        <Icon className="w-4 h-4 opacity-80" />
        <span className="truncate">{n.name}</span>
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={()=>setOpen(v=>!v)}
        className={`${base} text-gray-300 hover:text-white hover:bg-white/5 w-full text-left font-medium`}
        aria-expanded={open}
        style={{ paddingLeft: pad }}
      >
        <Icon className="w-4 h-4 opacity-80" />
        <span className="flex-1 truncate">{n.name}</span>
        {open ? <IconSet.ChevronDown className="w-4 h-4" /> : <IconSet.ChevronRight className="w-4 h-4" />}
      </button>
      {hasKids && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden" style={{ marginLeft: pad }}>
              <div className="border-l border-white/10 pl-3">
                {n.children.map(ch => <Item key={ch.code} n={ch} depth={depth+1} onNavigate={onNavigate} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ---- sidebar ---- */
export default function TenantSidebar({ onNavigate }){
  const { menus } = useEnv();               // expects flat rows with at least {code, name/label, path}
  const tree = useMemo(()=>buildTree(menus||[]), [menus]);

  return (
    <aside className="w-64 shrink-0 hidden md:flex md:flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10 p-3">
      <div className="bg-pink-600 text-white text-xs px-2 py-1">
  TenantSidebar.jsx LIVE
</div>
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Menu</div>
      <div className="mt-2 space-y-1">
        {tree.length ? tree.map(n => <Item key={n.code} n={n} openDefault={true} onNavigate={onNavigate} />)
                     : <div className="text-sm opacity-70">No menus</div>}
      </div>
      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}
