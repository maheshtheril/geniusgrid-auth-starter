// src/breadcrumbs/useBreadcrumbs.js
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { isIdLike, lookupStatic, resolverFor } from "./registry";

/**
 * Builds breadcrumbs from the URL:
 * /crm/leads/123/edit -> [Dashboard, CRM, Leads, (LeadName), Edit]
 * - Static labels come from registry
 * - ID-like segments use async resolvers (per parent segment)
 */
export default function useBreadcrumbs() {
  const { pathname } = useLocation();
  const [dynamicLabels, setDynamicLabels] = useState({}); // key: idx -> label

  const segments = useMemo(() => {
    const clean = pathname.replace(/\/+$/, "");
    return clean.split("/").filter(Boolean);
  }, [pathname]);

  const items = useMemo(() => {
    // Build progressive hrefs: ['/crm', '/crm/leads', '/crm/leads/123', ...]
    const acc = [];
    let href = "";
    for (let i = 0; i < segments.length; i++) {
      href += `/${segments[i]}`;
      acc.push(href);
    }
    return acc;
  }, [segments]);

  // Prepare base (static) crumbs with placeholders
  const baseCrumbs = useMemo(() => {
    const crumbs = [];

    // Always start with Dashboard
    crumbs.push({ label: "Dashboard", href: "/dashboard" });

    segments.forEach((seg, i) => {
      const href = items[i];
      const prevSeg = segments[i - 1]; // parent segment for resolver
      const staticHit = lookupStatic(seg);

      if (staticHit) {
        crumbs.push({ label: staticHit.label, href: href });
      } else if (isIdLike(seg) && prevSeg) {
        // dynamic entity under parent (e.g., /crm/leads/:id)
        const key = String(i);
        const dynLabel = dynamicLabels[key];
        crumbs.push({
          label: dynLabel || "Loading…",
          href, // keep href for intermediate steps
          loading: !dynLabel,
        });
      } else {
        // generic segment (e.g., edit, new, settings subpage)
        const titleCased = seg.replace(/[-_]/g, " ").replace(/\b\w/g, m => m.toUpperCase());
        crumbs.push({ label: titleCased, href });
      }
    });

    // Ensure last item is not a link
    if (crumbs.length) crumbs[crumbs.length - 1].href = undefined;
    return crumbs;
  }, [segments, items, dynamicLabels]);

  // Resolve dynamic names asynchronously
  useEffect(() => {
    let alive = true;

    async function run() {
      const updates = {};
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const prev = segments[i - 1];

        if (isIdLike(seg) && prev) {
          const resolver = resolverFor(prev);
          if (typeof resolver === "function") {
            try {
              const name = await resolver(seg);
              if (!alive) return;
              updates[String(i)] = name || `${prev.slice(0, -1)} ${seg}`;
            } catch {
              if (!alive) return;
              updates[String(i)] = `${prev.slice(0, -1)} ${seg}`;
            }
          }
        }
      }
      if (alive && Object.keys(updates).length) {
        setDynamicLabels((old) => ({ ...old, ...updates }));
      }
    }
    run();

    return () => { alive = false; };
  }, [segments]);

  return baseCrumbs;
}
