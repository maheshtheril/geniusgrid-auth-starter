// src/components/layout/TenantSidebar.jsx
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as IconSet from "lucide-react";
import { useEnv } from "@/store/useEnv";

/* Icons */
function EmojiIcon({ glyph, className }) { return <span className={className}>{glyph}</span>; }
function isEmoji(x){ try{ return /[\p{Extended_Pictographic}]/u.test(x||""); }catch{ return /[^\w\s]/.test(x||""); } }
function iconByName(name){
  if(!name) return IconSet.Dot;
  if(isEmoji(name)) return (p)=><EmojiIcon glyph={name} className={`w-4 h-4 ${p?.className||""}`}/>;
  if(IconSet[name]) return IconSet[name];
  const pascal = String(name).split(/[-_ ]+/).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join("");
  return IconSet[pascal] || IconSet.Dot;
}

/* Normalize a row coming from v_menu_tree_for_tenant OR your existing payload */
function norm(r){
  const code        = r.code ?? String(r.id ?? r.menu_id ?? r.menuId ?? "");
  const name        = r.name ?? r.label ?? code;
  const path        = r.path ?? r.url ?? r.route ?? null;      // keep /app
  const icon        = r.icon ?? r.emoji ?? null;
  const sort_order  = r.sort_order ?? r.sortOrder ?? 999;
  const parent_code = r.parent_code ?? r.parentCode ?? null;
  return { code, name, path, icon, sort_order, parent_code, children: [] };
}
// const stripApp = (p)=> p ? p.replace(/^\/app(?=\/|$)/,"") : p;

function buildTree(rows){
  const src = (rows||[]).map(norm).filter(x=>x.code);
  const byCode = Object.fromEntries(src.map(x=>[x.code, x]));

  // Attach by parent_code
  const roots = [];
  for(const n of src){
    // Make admin groups non-clickable even if path present accidentally
    if(n.code.startsWith("admin.grp.")) n.path = null;

    const p = n.parent_code ? byCode[n.parent_code] : null;
    if(p) p.children.push(n);
    else roots.push(n);
  }

  const sortFn = (a,b)=>(a.sort_order??999)-(b.sort_order??999) || String(a.name).localeCompare(b.name);
  const sortDeep = (arr)=>{ arr.sort(sortFn); arr.forEach(x=>x.children?.length && sortDeep(x.children)); return arr; };
  return sortDeep(roots);
}

function NodeItem({ node, depth=0, defaultOpen=false, onNavigate }){
  const hasChildren = (node.children?.length||0)>0;
  const linkPath = node.path; // or stripApp(node.path)
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

export default function TenantSidebar({ onNavigate }){
  const { menus } = useEnv();           // Make this call v_menu_tree_for_tenant
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
