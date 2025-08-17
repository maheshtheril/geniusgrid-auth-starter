import React from "react";
export default function MarketplaceAdmin(){
  const items = [
    { code:"maps", name:"Maps", desc:"Geo enrichment" },
    { code:"zendesk", name:"Zendesk", desc:"Support sync" },
    { code:"sendgrid", name:"SendGrid", desc:"Email delivery" },
  ];
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Marketplace</div><h1 className="text-2xl md:text-3xl font-bold">Marketplace</h1></div>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map(a=>(
          <div key={a.code} className="bg-[#111418] rounded-2xl p-5 border border-white/5">
            <div className="font-semibold">{a.name}</div>
            <div className="text-sm text-gray-400 mb-3">{a.desc}</div>
            <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">View</button>
          </div>
        ))}
      </div>
    </div>
  );
}
