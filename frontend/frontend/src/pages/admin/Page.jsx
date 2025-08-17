import React from "react";
export default function Page({ title, actions, children }) {
  return (
    <div className="w-full max-w-none min-w-0 p-4 md:p-6">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <h1 className="text-2xl font-semibold capitalize">{title}</h1>
        <div className="flex-1" />
        {actions}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
