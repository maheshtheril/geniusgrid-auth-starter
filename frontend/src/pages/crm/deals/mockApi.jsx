// ---------- FILE: src/pages/crm/deals/mockApi.js ----------
// Mock API for UI-first development
export const STAGES = [
  { id: 'new', name: 'New' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'proposal', name: 'Proposal' },
  { id: 'won', name: 'Won' },
  { id: 'lost', name: 'Lost' },
];

let DEALS = [
  { id: 'd1', title: 'ABC Corp Website', company: 'ABC Corp', amount: 450000, currency: 'INR', owner: 'Priya', stage: 'new', next_step: 'Intro call', probability: 0.2 },
  { id: 'd2', title: 'XYZ CRM Upgrade', company: 'XYZ Ltd', amount: 1200000, currency: 'INR', owner: 'Rahul', stage: 'qualified', next_step: 'Demo', probability: 0.4 },
  { id: 'd3', title: 'Retail Kiosk Rollout', company: 'MegaRetail', amount: 3000000, currency: 'INR', owner: 'Aisha', stage: 'proposal', next_step: 'Negotiate', probability: 0.6 },
  { id: 'd4', title: 'Support Contract', company: 'NanoSoft', amount: 200000, currency: 'INR', owner: 'Kiran', stage: 'new', next_step: 'Scope', probability: 0.1 },
  { id: 'd5', title: 'Mobile App Revamp', company: 'FastMove', amount: 1500000, currency: 'INR', owner: 'Aisha', stage: 'qualified', next_step: 'SOW draft', probability: 0.5 },
  { id: 'd6', title: 'IoT Pilot', company: 'AgroWorks', amount: 700000, currency: 'INR', owner: 'Rahul', stage: 'proposal', next_step: 'Pilot start', probability: 0.7 },
  { id: 'd7', title: 'Analytics Suite', company: 'FinSmart', amount: 2500000, currency: 'INR', owner: 'Priya', stage: 'won', next_step: '-', probability: 1.0 },
  { id: 'd8', title: 'Training Program', company: 'EduPlus', amount: 350000, currency: 'INR', owner: 'Kiran', stage: 'lost', next_step: '-', probability: 0.0 },
];

export async function listDeals(){
  return JSON.parse(JSON.stringify(DEALS));
}
export async function createDeal(payload){
  const id = 'd' + Math.random().toString(36).slice(2, 8);
  const d = { id, stage: 'new', probability: 0.1, currency: 'INR', ...payload };
  DEALS.unshift(d);
  return d;
}
export async function updateDeal(id, patch){
  const i = DEALS.findIndex(d => d.id === id);
  if (i === -1) return null;
  DEALS[i] = { ...DEALS[i], ...patch };
  return DEALS[i];
}
export async function moveDealToStage(id, stage){
  return updateDeal(id, { stage });
}


