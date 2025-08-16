/* -------------------------------- CONTACTS -------------------------------- */
// src/pages/crm/contacts/ContactsLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import { Users } from "lucide-react";

export default function ContactsLayout(){
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Users className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage people tied to companies and deals.</p>
        </div>
      </div>
      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet />
      </div>
    </div>
  );
}