// src/pages/crm/calls/mockApi.js
export let CALLS = [
  { id:"k1", when:"2025-08-16 10:00", contact:"Priya Sharma", company:"ABC Corp", owner:"Aisha", duration:15, outcome:"scheduled", sentiment:"neutral" },
  { id:"k2", when:"2025-08-16 15:30", contact:"Rahul Verma", company:"XYZ Ltd", owner:"Rahul", duration:20, outcome:"completed", sentiment:"positive" },
];
export async function listCalls(){ return JSON.parse(JSON.stringify(CALLS)); }
export async function createCall(payload){ const id="k"+Math.random().toString(36).slice(2,8); const row={ id, outcome:"scheduled", sentiment:"neutral", ...payload }; CALLS.unshift(row); return row; }
export async function updateCall(id, patch){ const i=CALLS.findIndex(x=>x.id===id); if(i===-1) return null; CALLS[i]={...CALLS[i],...patch}; return CALLS[i]; }

