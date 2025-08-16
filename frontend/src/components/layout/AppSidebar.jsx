// src/components/layout/AppSidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ------------------ helpers ------------------ */
const normPath = (p) => {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
const byOrderThenName = (a, b) => {
  const ao = Number.isFinite(a.sort_order) ? a.sort_order : 999999;
  const bo = Number.isFinite(b.sort_order) ? b.sort_order : 999999;
  if (ao !== bo) return ao - bo;
  const an = String(a.label || a.name || a.code || "");
  const bn = String(b.label || b.name || b.code || "");
  return an.localeCompare(bn, undefined, { sensitivity: "base" });
};

/* ------------------ DB-FIRST: build tree strictly by parent_id ------------------ */
function buildTreeDbFirst(items) {
  const byId = new Map();
  const children = new Map();

  (items || []).forEach((raw) => {
    const n = {
      id: raw.id,
      code: raw.code,
      label: raw.label ?? raw.name ?? raw.code ?? "",
      name: raw.label ?? raw.name ?? raw.code ?? "",
      path: normPath(raw.path || ""),
      icon: raw.icon ?? null,
      parent_id: raw.parent_id ?? null,
      module_code: raw.module_code ?? null,
      sort_order: raw.sort_order ?? null,
    };
    byId.set(n.id, n);
    children.set(n.id, []);
  });

  // attach strictly by parent_id; missing parent => root
  const roots = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) {
      children.get(n.parent_id).push(n);
    } else {
      roots.push(n);
    }
  });

  // sort depth-first
  const sortRec = (node) => {
    const kids = children.get(node.id) || [];
    kids.sort(byOrderThenName);
    return { ...node, children: kids.map(sortRec) };
  };
  roots.sort(byOrderThenName);
  let tree = roots.map(sortRec);

  // Remove any root named "Main" (any case) and HOIST its children to roots
  const flattened = [];
  for (const r of tree) {
    const nm = String(r.label || r.code || "").trim().toLowerCase();
    if (nm === "main") {
      (r.children || []).forEach((c) => flattened.push(c));
    } else {
      flattened.push(r);
    }
  }

  return flattened;
}

/* ------------------ search utilities ------------------ */
function walk(nodes, fn, parentId = null) {
  (nodes || []).forEach((n) => {
    fn(n, parentId);
    if (n.children?.length) walk(n.children, fn, n.id);
  });
}
function buildParentMap(nodes) {
  const m = new Map();
  walk(nodes, (n, p) => m.set(n.id, p));
  return m;
}
function ancestorsOf(id, parentMap) {
  const list = [];
  let cur = parentMap.get(id);
  while (cur) {
    list.push(cur);
    cur = parentMap.get(cur);
  }
  return list; // nearest parent first
}
function findNodeByPath(nodes, path) {
  let found = null;
  walk(nodes, (n) => {
    if (!found && n.path && path && path.startsWith(n.path)) found = n;
  });
  return found;
}
function filterTree(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { pruned: nodes, expandIds: new Set() };

  const expandIds = new Set();
  const hit = (n) =>
    String(n.label || n.name || n.code || "")
      .toLowerCase()
      .includes(q);

  const recur = (arr) => {
    const out = [];
    for (const n of arr) {
      const kids = n.children ? recur(n.children) : [];
      const selfHit = hit(n);
      if (selfHit || kids.length) {
        if (kids.length) expandIds.add(n.id);
        out.push({ ...n, children: kids });
      }
    }
    return out;
  };

  return { pruned: recur(nodes), expandIds };
}
function Highlight({ text, query }) {
  if (!query) return <>{text}</>;
  const q = query.trim();
  if (!q) return <>{text}</>;
  const s = String(text ?? "");
  const idx = s.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {s.slice(0, idx)}
      <mark className="bg-yellow-600/40 rounded px-0.5">{s.slice(idx, idx + q.length)}</mark>
      {s.slice(idx + q.length)}
    </>
  );
}

/* ------------------ UI bits ------------------ */
const ARROW = 18;
const Chevron = ({ open }) => (
  <svg width={ARROW} height={ARROW} viewBox="0 0 24 24" className="opacity-80" aria-hidden>
    <path
      d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Spacer = () => <span style={{ width: ARROW, height: ARROW, display: "inline-block" }} />;

/* ------------------ COMPONENT ------------------ */
export default function AppSidebar() {
  const { menus = [], branding } = useEnv(); // DB-driven payload from your store
  const loc = useLocation();
  const scrollerRef = useRef(null);

  // Build DB tree (roots must be parent_id NULL; "Main" is removed/flattened)
  const roots = useMemo(() => buildTreeDbFirst(menus || []), [menus]);

  // Open-state + search
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState("");

  // Parents map based on current (full) tree for active-route auto-open
  const parentMap = useMemo(() => buildParentMap(roots), [roots]);

  // Filtered view for search
  const { pruned: visibleTree, expandIds } = useMemo(
    () => filterTree(roots, query),
    [roots, query]
  );

  const isOpen = (id) => openIds.has(id);
  const openMany = (ids) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => next.add(i));
      return next;
    });
  const closeAll = () => setOpenIds(new Set());
  const openAll = () => {
    const all = new Set();
    walk(roots, (n) => {
      if (n.children?.length) all.add(n.id);
    });
    setOpenIds(all);
  };
  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Auto-open ancestors of the active route
  useEffect(() => {
    const match = findNodeByPath(roots, loc.pathname);
    if (match) openMany(ancestorsOf(match.id, parentMap));
    // Scroll active link into view
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollTop + (eTop - cTop - 120),
        behavior: "smooth",
      });
    }
  }, [loc.pathname, roots, parentMap]);

  // When searching, auto-open ancestors of matches
  useEffect(() => {
    if (query) openMany(expandIds);
  }, [query, expandIds]);

  /* ---------- Node renderer ---------- */
  function Node({ node, depth = 0 }) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const open = isOpen(node.id);
    const pad = depth > 0 ? "ml-3" : "";
    const label = node.label || node.name || node.code || "";

    // Any node with children acts as a header toggle (ignore its path for navigation)
    if (hasChildren) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className={[
              "no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full text-left",
              "text-gray-300 hover:bg-gray-800/50",
              pad,
            ].join(" ")}
            aria-expanded={open}
            aria-controls={`children-${node.id}`}
          >
            <Chevron open={open} />
            {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
            <span className="truncate">
              <Highlight text={label} query={query} />
            </span>
          </button>

          {open && (
            <div id={`children-${node.id}`} className="mt-1 space-y-1">
              {node.children.map((c) => (
                <Node key={c.id} node={c} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Leaf link
    return (
      <div className="group" key={node.id}>
        <NavLink
          to={node.path || "#"}
          end
          className={({ isActive }) =>
            [
              "no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              isActive ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-800/50",
              pad,
            ].join(" ")
          }
        >
          <Spacer />
          {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
          <span className="truncate">
            <Highlight text={label} query={query} />
          </span>
        </NavLink>
      </div>
    );
  }

  return (
    <aside
      className="bg-gray-900 text-gray-100 border-r border-gray-800 flex flex-col"
      style={{ width: "16rem", minWidth: "16rem" }}
    >
      {/* Header: Logo + Brand */}
      <div className="h-14 px-3 flex items-center gap-3 border-b border-gray-800">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding?.appName || "Logo"}
            className="h-8 w-8 rounded-md object-contain bg-white/5 p-1"
          />
        ) : (
          <div className="h-8 w-8 rounded-md bg-gray-800 flex items-center justify-center text-lg">🧠</div>
        )}
        <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
      </div>

      {/* Search + Expand/Collapse */}
      <div className="p-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="w-full bg-gray-800/60 text-sm text-gray-100 rounded-lg px-8 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-gray-400"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70">🔎</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
                aria-label="Clear"
                title="Clear"
              >
                ✖
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={openAll}
            className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700"
            title="Expand all"
          >
            ⤢
          </button>
          <button
            type="button"
            onClick={closeAll}
            className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700"
            title="Collapse all"
          >
            ⤡
          </button>
        </div>
      </div>

      {/* Menu list (DB-driven, no synthetic "Main") */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        {visibleTree.length === 0 ? (
          <div className="text-xs text-gray-400 px-3 py-2">No menus.</div>
        ) : (
          visibleTree.map((root) => <Node key={root.id} node={root} />)
        )}
      </div>
    </aside>
  );
}
