// ---------- FILE: src/pages/crm/companies/CompanyDeals.jsx ----------
import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listCompanyDeals } from "./mockApi";

export default function CompanyDeals(){
  const { company } = useOutletContext();
  const [rows, setRows] = useState([]);
  useEffect(()=> { (async()=> setRows(await listCompanyDeals(company.id)))(); }, [company.id]);

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40"><tr>
          {["Title","Owner","Stage","Amount"].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.length===0 && <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>No deals</td></tr>}
          {rows.map(r=> (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 whitespace-nowrap">{r.title}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.owner}</td>
              <td className="px-3 py-2 whitespace-nowrap capitalize">{r.stage}</td>
              <td className="px-3 py-2 whitespace-nowrap">₹{r.amount.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}