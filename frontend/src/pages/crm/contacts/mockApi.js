// src/pages/crm/contacts/mockApi.js
export let CONTACTS = [
  { id:"c1", name:"Priya Sharma", company:"ABC Corp", email:"priya@abc.com", phone:"+91 98765 43210", title:"Procurement", status:"active", tags:["key","north"] },
  { id:"c2", name:"Rahul Verma", company:"XYZ Ltd", email:"rahul@xyz.com", phone:"+91 90000 11111", title:"CTO", status:"prospect", tags:["tech"] },
];
export async function listContacts(){ return JSON.parse(JSON.stringify(CONTACTS)); }
export async function createContact(payload){
  const id = "c" + Math.random().toString(36).slice(2,8);
  const row = { id, status:"active", tags:[], ...payload };
  CONTACTS.unshift(row); return row;
}
export async function updateContact(id, patch){
  const i = CONTACTS.findIndex(x=>x.id===id); if(i===-1) return null;
  CONTACTS[i] = { ...CONTACTS[i], ...patch }; return CONTACTS[i];
}
