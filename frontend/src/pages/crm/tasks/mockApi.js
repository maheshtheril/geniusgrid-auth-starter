// src/pages/crm/tasks/mockApi.js
export let TASKS = [
  { id:"t1", title:"Call ABC about pricing", owner:"Priya", due:"2025-08-17", status:"todo", related:"Deal: ABC Corp Website" },
  { id:"t2", title:"Send proposal to XYZ", owner:"Rahul", due:"2025-08-18", status:"in-progress", related:"Deal: XYZ CRM Upgrade" },
];
export async function listTasks(){ return JSON.parse(JSON.stringify(TASKS)); }
export async function createTask(payload){ const id="t"+Math.random().toString(36).slice(2,8); const row={ id, status:"todo", ...payload }; TASKS.unshift(row); return row; }
export async function updateTask(id, patch){ const i=TASKS.findIndex(x=>x.id===id); if(i===-1) return null; TASKS[i]={...TASKS[i],...patch}; return TASKS[i]; }


