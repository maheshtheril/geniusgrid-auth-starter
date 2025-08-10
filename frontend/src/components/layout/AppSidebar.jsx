import { useState } from "react";
export default function AppSidebar(){
  const [open, setOpen] = useState({ admin:true, crm:true });
  return (
    <aside className="app-sidebar panel glass" style={{margin:12}}>
      <div className="sidebar-head text-muted small">Menu (demo)</div>

      <button className="nav-item nav-toggle" onClick={()=>setOpen(o=>({...o,admin:!o.admin}))}>
        <span style={{display:"inline-block",width:12,transform:`rotate(${open.admin?90:0}deg)`,transition:"transform .18s"}}>▸</span>
        <span className="nav-label">Admin</span>
      </button>
      <div className="nav-children" style={{
        maxHeight: open.admin ? 500 : 0,
        overflow:"hidden",
        transition:"max-height .18s",
        marginLeft:10,paddingLeft:8,borderLeft:"1px solid rgba(255,255,255,.08)"
      }}>
        <a className="nav-item" href="#"><span style={{width:12,display:"inline-block"}}/>• Users</a>
        <a className="nav-item" href="#"><span style={{width:12,display:"inline-block"}}/>• Roles</a>
        <a className="nav-item" href="#"><span style={{width:12,display:"inline-block"}}/>• Settings</a>
      </div>

      <button className="nav-item nav-toggle" onClick={()=>setOpen(o=>({...o,crm:!o.crm}))}>
        <span style={{display:"inline-block",width:12,transform:`rotate(${open.crm?90:0}deg)`,transition:"transform .18s"}}>▸</span>
        <span className="nav-label">CRM</span>
      </button>
      <div className="nav-children" style={{
        maxHeight: open.crm ? 500 : 0,
        overflow:"hidden",
        transition:"max-height .18s",
        marginLeft:10,paddingLeft:8,borderLeft:"1px solid rgba(255,255,255,.08)"
      }}>
        <a className="nav-item" href="#"><span style={{width:12,display:"inline-block"}}/>• Leads</a>
        <a className="nav-item" href="#"><span style={{width:12,display:"inline-block"}}/>• Companies</a>
        <a className="nav-item" href="#"><span style={{width:12,display:"inline-block"}}/>• Deals</a>
      </div>
    </aside>
  );
}
