/* ---------------------------------- TASKS ---------------------------------- */
// src/pages/crm/tasks/TasksLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import { CheckSquare } from "lucide-react";

export default function TasksLayout(){
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><CheckSquare className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Follow-ups and to-dos across CRM.</p>
        </div>
      </div>
      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet />
      </div>
    </div>
  );
}