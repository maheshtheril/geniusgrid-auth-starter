// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* Icons */
function EmojiIcon({ glyph, className }) { return <span className={className} aria-hidden="true">{glyph}</span>; }
function isEmoji(x){ try{ return /[\p{Extended_Pictographic}]/u.test(x||""); }catch{ return /[^\w\s]/.test(x||""); } }
function iconByName(name){
  if(!name) return IconSet.Folder;
  if(isEmoji(name)) return (p)=><EmojiIcon glyph={name} className={`w-4 h-4 ${p?.className||""}`} />;
  if(IconSet[name]) return IconSet[name];
  const pascal = String(name).split(/[-_ ]+/).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join("");
  return IconSet[pascal] || IconSet.Folder;
}

/* Normalize a row (works with v_menu_tree_for_tenant or your old payload) */
function norm(r){
  const code        = r.code ?? String(r.id ?? r.menu_id ?? r.menuId ?? "");
  const name        = r.name ?? r.label ?? code;
  const path        = r.path ?? r.url ?? r.route ?? null;     // keep '/app'
  const icon        = r.icon ?? r.emoji ?? null;
  const sort_order  = r.sort_order ?? r.sortOrder ?? 999;
  const parent_code = r.parent_code ?? r.parentCode ?? null;
  return { code, name, path, icon, sort_order, parent_code, children: [] };
}

/* Build tree purely from code↔parent_code (no UUIDs) */
function buildTree(raw){
  const rows = (raw||[]).map(norm).filter(x=>x.code);
  if (typeof window !== "undefined" && !window.__GG_MENU_LOGGED__) {
    window.__GG_MENU_LOGGED__ = true;
    try { console.table(rows.map(({code,name,path,parent_code})=>({code,name,path,parent_code}))); } catch {}
  }
  const byCode = Object.fromEntries(rows.map(r=>[r.code, r]));

  // Always synthesize admin/crm roots if any child implies them
  const needAdmin = rows.some(r => r.code === "admin" || r.code.startsWith("admin."));
  const needCrm   = rows.some(r => r.code === "crm"   || r.code.startsWith("crm."));
  if (needAdmin && !byCode["admin"]) byCode["admin"] = { code:"admin", name:"Admin", path:"/app/admin", icon:"Settings", sort_order:10 };
  if (needCrm   && !byCode["crm"])   byCode["crm"]   = { code:"crm",   name:"CRM",   path:"/app/crm",   icon:"Handshake", sort_order:10 };

  // Index of built nodes
  const nodes = new Map();
  const ensure = (code) => {
    if (!nodes.has(code)) {
      const r = byCode[code] || { code, name: code.toUpperCase(), path: code==='admin'?'/app/admin':`/app/${code}`, icon: "Folder", sort_order: 50 };
      nodes.set(code, { code, name: r.name, path: r.path ?? null, icon: r.icon ?? null, sort_order: r.sort_order ?? 999, children: [] });
    }
    return nodes.get(code);
  };
  const link = (parent, child) => {
    const p = ensure(parent), c = ensure(child);
    if (!p.children.some(x => x.code === child)) p.children.push(c);
  };

  // Ensure all codes exist as nodes
  rows.forEach(r => ensure(r.code));

  // Attach by parent_code
  rows.forEach(r => {
    if (r.parent_code) link(r.parent_code, r.code);
  });

  // Ensure Admin groups under Admin (if groups present but not linked)
  rows.filter(r => r.code.startsWith("admin.grp.")).forEach(g => link("admin", g.code));

  // Module pages like "crm.leads" should be under "crm" even if parent_code was null
  rows.filter(r => r.code.includes(".") && !r.code.startsWith("admin.")).forEach(r => {
    const mod = r.code.split(".")[0];
    link(mod, r.code);
  });

  // Roots = nodes not referenced as a child
  const childCodes = new Set();
  for (const n of nodes.values()) n.children.forEach(c => childCodes.add(c.code));
  const roots = [...nodes.values()].filter(n => !childCodes.has(n.code) && !n.code.startsWith("admin.grp."));

  // Sort
  const byName = (a,b)=> String(a.name||"").localeCompare(String(b.name||""));
  const bySort = (a,b)=> (a.sort_order??999)-(b.sort_order??999) || byName(a,b);
  const sortDeep = (arr)=>{ arr.sort(bySort); arr.forEach(n=>n.children?.length && sortDeep(n.children)); return arr; };
  return sortDeep(roots);
}

function NodeItem({ node, depth=0, defaultOpen=false, onNavigate }){
  const hasChildren = (node.children?.length||0)>0;
  const isLeaf = !!node.path && !hasChildren;
  const [open, setOpen] = useState(defaultOpen);
  const Icon = iconByName(node.icon);
  const pad = 16 + depth*18;
  const base = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";

  if (isLeaf){
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

export default function TenantSidebar({ onNavigate }){
  const { menus } = useEnv();           // expect array of rows from v_menu_tree_for_tenant
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
