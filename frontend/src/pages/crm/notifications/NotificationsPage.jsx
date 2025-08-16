/* ------------------------------ NOTIFICATIONS ------------------------------ */
// src/pages/crm/notifications/NotificationsPage.jsx
import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const MOCK = [
  { id:"n1", ts:"2025-08-16 11:00", text:"Deal 'ABC Corp Website' moved to Proposal", kind:"deal" },
  { id:"n2", ts:"2025-08-16 11:30", text:"New task assigned: Send proposal to XYZ", kind:"task" },
];

export default function NotificationsPage(){
  const [rows, setRows] = useState([]);
  useEffect(()=>{ setRows(MOCK); },[]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Bell className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Recent events across CRM.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-3 md:p-4 space-y-2">
        {rows.length===0 && <div className="text-sm text-muted-foreground">No notifications</div>}
        {rows.map(n => (
          <div key={n.id} className="p-3 rounded-xl border bg-background">
            <div className="text-xs text-muted-foreground">{n.ts}</div>
            <div className="text-sm">{n.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
