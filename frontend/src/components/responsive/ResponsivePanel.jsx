import React from "react";

/** Simple wrapper to make any panel full-screen on small screens */
export default function ResponsivePanel({ children, className = "" }) {
  return (
    <div className={`bg-gray-900 border border-white/10 rounded-xl p-4 sm:p-6
      fixed inset-0 sm:static sm:inset-auto sm:rounded-xl
      sm:max-w-lg sm:w-full sm:mx-auto overflow-auto ${className}`}>
      {children}
    </div>
  );
}
