// src/components/nav/Breadcrumbs.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * items: [{ label: string, href?: string, loading?: boolean }]
 * Place directly under Topbar, above page title/actions.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full text-sm text-muted-foreground/90 mb-3"
    >
      <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          const content = (
            <span
              className={
                "truncate max-w-[22ch] inline-block align-bottom " +
                (isLast ? "font-medium text-foreground" : "text-primary hover:underline")
              }
              title={typeof it.label === "string" ? it.label : ""}
            >
              {it.loading ? "…" : it.label}
            </span>
          );

          return (
            <li key={i} className="flex items-center gap-1 min-w-0">
              {it.href && !isLast ? <Link to={it.href}>{content}</Link> : content}
              {!isLast && <span className="px-1 select-none">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
