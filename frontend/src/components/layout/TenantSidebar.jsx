// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* ---------------- Icons ---------------- */
function EmojiIcon({ glyph, className }) {
  return <span className={className} aria-hidden="true">{glyph}</span>;
}
function isEmoji(x){ try{ return /[\p{Extended_Pictographic}]/u.test(x||""); }catch{ return /[^\w\s]/.test(x||""); } }
function iconByName(name){
  if(!name) return IconSet.Dot;
  if(isEmoji(name)) return (p)=><EmojiIcon glyph={name} className={`w-4 h-4 ${p?.className||""}`}/>;
  if(IconSet[name]) return IconSet[name];
  const pascal=String(name).split(/[-_ ]+/).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join("");
  return IconSet[pascal]||IconSet.Dot;
}

/* ------------- Admin map (labels/icons for synthesized nodes) ------------- */
const ADMIN_CODE = "admin";
const GROUP_LABELS = {
  "admin.grp.org" : { name: "Organization & Compliance", icon:"🏢", sort_order:21 },
  "admin.grp.rbac": { name: "Access Control (RBAC)",     icon:"🛡️", sort_order:22 },
  "admin.grp.sec" : { name: "Security & Compliance",     icon:"🔐", sort_order:23 },
  "admin.grp.data": { name: "Data & Customization",      icon:"🧩", sort_order:24 },
  "admin.grp.int" : { name: "Integrations & Developer",  icon:"🔌", sort_order:25 },
  "admin.grp.ai"  : { name: "AI & Automation",           icon:"✨", sort_order:26 },
  "admin.grp.bill": { name: "Billing & Observability",   icon:"💳", sort_order:27 },
};
const GROUP_CHILDREN = {
  "admin.grp.org": new Set(["admin.org","admin.branding","admin.localization","admin.taxes","admin.units","admin.locations","admin.calendars","admin.numbering","admin.compliance"]),
  "admin.grp.rbac": new Set(["admin.users","admin.roles","admin.permissions","admin.teams"]),
  "admin.grp.sec":  new Set(["admin.security","admin.sso","admin.domains","admin.audit"]),
  "admin.grp.data": new Set(["admin.settings","admin.custom-fields","admin.pipelines","admin.templates","admin.notifications","admin.import_export","admin.backups"]),
  "admin.grp.int":  new Set(["admin.integrations","admin.marketplace","admin.api_keys","admin.webhooks","admin.features"]),
  "admin.grp.ai":   new Set(["admin.ai","admin.automation","admin.approvals"]),
  "admin.grp.bill": new Set(["admin.billing","admin.usage","admin.logs"]),
};
function inferGroupCode(itemCode){
  for(const [g, kids] of Object.entries(GROUP_CHILDREN)) if(kids.has(itemCode)) return g;
  return null;
}

/* ---------------- Data normalization + synthesis ---------------- */
function norm(raw){
  const id          = raw.id ?? raw.menu_id ?? raw.menuId;
  const code        = raw.code ?? String(id||"");
  const name        = raw.name ?? raw.label ?? code ?? "Untitled";
  const path        = raw.path ?? raw.url ?? raw.route ?? null;
  const icon        = raw.icon ?? raw.emoji ?? null;
  const sort_order  = raw.sort_order ?? raw.sortOrder ?? 999;
  const parent_id   = raw.parent_id ?? raw.parentId ?? null;
  const parent_code = raw.parent_code ?? raw.parentCode ?? null;
  const module_type = raw.module_type ?? raw.moduleType ?? raw.type ?? null;
  return { id:String(id||code), code, name, path, icon, sort_order, parent_id: parent_id ? String(parent_id) : null, parent_code, module_type, children: [] };
}

function buildTree(input){
  // 1) normalize incoming
  const src = (input||[]).map(norm).filter(n=>n.id);

  // 2) index by id/code
  const byId   = Object.fromEntries(src.map(n=>[n.id,n]));
  const byCode = Object.fromEntries(src.map(n=>[n.code,n]));

  // 3) synthesize ADMIN root if missing but any admin.* exists
  const hasAnyAdmin = src.some(n=>String(n.code||"").startsWith("admin"));
  if(hasAnyAdmin && !byCode[ADMIN_CODE]){
    const admin = { id:`synthetic:${ADMIN_CODE}`, code: ADMIN_CODE, name:"Admin", path:"/admin", icon:"⚙️", sort_order:10, parent_id:null, module_type:"app", children:[] };
    byId[admin.id]=admin; byCode[ADMIN_CODE]=admin; src.push(admin);
  }

  // 4) synthesize admin groups if referenced or needed
  for(const [gcode, meta] of Object.entries(GROUP_LABELS)){
    const exists = !!byCode[gcode];
    const needed = !exists && src.some(n => inferGroupCode(n.code)===gcode || n.parent_code===gcode);
    if(!exists && needed){
      const parentAdmin = byCode[ADMIN_CODE];
      const g = { id:`synthetic:${gcode}`, code:gcode, name:meta.name, path:null, icon:meta.icon, sort_order:meta.sort_order, parent_id: parentAdmin? parentAdmin.id : null, module_type:"group", children:[] };
      byId[g.id]=g; byCode[gcode]=g; src.push(g);
    }
  }

  // 5) attach children
  for(const n of src){
    // if no parent_id, try parent_code, then infer by code
    if(!n.parent_id){
      const gcode = n.parent_code || inferGroupCode(n.code);
      if(gcode && byCode[gcode]) n.parent_id = byCode[gcode].id;
    }
    // ensure groups behave as headings
    if(n.code in GROUP_LABELS){ n.path = null; n.module_type = "group"; }
  }

  const roots=[];
  for(const n of src){
    if(n.parent_id && byId[n.parent_id]) byId[n.parent_id].children.push(n);
    else roots.push(n);
  }

  // 6) sort
  const sortFn=(a,b)=>(a.sort_order??999)-(b.sort_order??999) || String(a.name||"").localeCompare(String(b.name||""));
  const sortDeep=(nodes)=>{ nodes.sort(sortFn); nodes.forEach(nd=>nd.children?.length && sortDeep(nd.children)); return nodes; };
  return sortDeep(roots);
}

/* ---------------- Node component ---------------- */
function NodeItem({ node, depth=0, defaultOpen=false, onNavigate }){
  const hasChildren = (node.children?.length||0)>0;
  const isLeaf = !hasChildren && !!node.path;
  const [open, setOpen] = useState(defaultOpen);
  const Icon = iconByName(node.icon);
  const pad = 16 + depth*18;
  const base = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";

  if(isLeaf){
    return (
      <NavLink
        to={node.path}
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
                  <NodeItem key={ch.id} node={ch} depth={depth+1} onNavigate={onNavigate}/>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
export default function TenantSidebar({ onNavigate }){
  const { menus } = useEnv();
  const tree = useMemo(()=>buildTree(menus||[]), [menus]);
  return (
    <aside className="w-64 shrink-0 hidden md:flex md:flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10 p-3">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Menu</div>
      <div className="mt-2 space-y-1">
        {tree.length ? tree.map(n=>(
          <NodeItem key={n.id} node={n} defaultOpen={true} onNavigate={onNavigate}/>
        )) : <div className="text-sm opacity-70">No menus</div>}
      </div>
      <div className="mt-auto pt-4 text-[10px] text-white/30">© GeniusGrid</div>
    </aside>
  );
}
