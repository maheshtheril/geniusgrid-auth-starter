// ---------- FILE: src/pages/admin/pages/AuditLogsPage.jsx ----------
import React from "react";
import { FileClock } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";

const MOCK = Array.from({length:15}).map((_,i)=>({
  id:`a${i+1}`,
  time:new Date(Date.now()-i*3600_000).toISOString(),
  user:["admin","sales","ops"][i%3],
  action:["create","update","delete"][i%3],
  table:["leads","companies","users"][i%3],
  row_id:Math.ceil(Math.random()*1000),
  ip:"127.0.0.1",
}));

export default function AuditLogsPage(){
  const columns = [
    { key:"time", header:"Time" },
    { key:"user", header:"User" },
    { key:"action", header:"Action" },
    { key:"table", header:"Table" },
    { key:"row_id", header:"Row" },
    { key:"ip", header:"IP" },
  ];
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <FileClock size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
      </div>
      <DataTable columns={columns} rows={MOCK} />
    </section>
  );
}

