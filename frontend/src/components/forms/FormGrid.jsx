import React from "react";

export function FormGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">{children}</div>;
}

export function FormRow({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-gray-300">{label}</div>
      {children}
    </label>
  );
}
