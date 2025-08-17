import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

// ... your MENUS and helper functions stay exactly the same ...

export default function AppSidebar({ onRequestClose }) {
  const { branding } = useEnv();
  const loc = useLocation();
  const scrollerRef = useRef(null);

  const roots = useMemo(() => buildTreeDbFirst(MENUS), []);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState("");

  const parentMap = useMemo(() => buildParentMap(roots), [roots]);
  const { pruned: visibleTree, expandIds } = useMemo(() => filterTree(roots, query), [roots, query]);

  const isOpen = (id) => openIds.has(id);
  const openMany = (ids) => setOpenIds((prev) => { const next = new Set(prev); ids.forEach((i)=>next.add(i)); return next; });
  const closeAll = () => setOpenIds(new Set());
  const openAll = () => {
    const all = new Set();
    walk(roots, (n) => { if (n.children?.length) all.add(n.id); });
    setOpenIds(all);
  };
  const toggle = (id) => setOpenIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  useEffect(() => {
    const match = findNodeByPath(roots, loc.pathname);
    if (match) openMany(ancestorsOf(match.id, parentMap));
    const el = scrollerRef.current?.querySelector('a[aria-current="page"]');
    if (el && scrollerRef.current) {
      const { top: cTop } = scrollerRef.current.getBoundingClientRect();
      const { top: eTop } = el.getBoundingClientRect();
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollTop + (eTop - cTop - 120), behavior: "smooth" });
    }
  }, [loc.pathname, roots, parentMap]);

  useEffect(() => { if (query) openMany(expandIds); }, [query, expandIds]);

  function Node({ node, depth = 0 }) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const open = isOpen(node.id);
    const pad = depth > 0 ? "ml-3" : "";
    const label = node.label || node.name || node.code || "";

    if (hasChildren) {
      return (
        <div className="group" key={node.id}>
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className={[
              "no-underline flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full text-left",
              "text-gray-300 hover:bg-gray-800/50 transition",
              pad,
            ].join(" ")}
            aria-expanded={open}
            aria-controls={`children-${node.id}`}
          >
            <Chevron open={open} />
            {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
            <span className="truncate"><Highlight text={label} query={query} /></span>
          </button>

          {open && (
            <div id={`children-${node.id}`} className="mt-1 space-y-1">
              {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

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
          onClick={() => { if (typeof onRequestClose === "function") onRequestClose(); }}
        >
          <Spacer />
          {node.icon ? <span className="w-4 h-4">{node.icon}</span> : <span className="w-4 h-4" />}
          <span className="truncate"><Highlight text={label} query={query} /></span>
        </NavLink>
      </div>
    );
  }

  return (
    <aside className="h-full flex flex-col bg-gray-900 text-gray-100 border-r border-gray-800">
      {/* Header */}
      <div className="h-14 px-3 flex items-center justify-between gap-2 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding?.appName || "Logo"} className="h-8 w-8 rounded-md object-contain bg-white/5 p-1" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-gray-800 flex items-center justify-center text-lg">🧠</div>
          )}
          <div className="text-lg font-semibold truncate">{branding?.appName || "GeniusGrid"}</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={openAll} className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" title="Expand all" aria-label="Expand all">⤢</button>
          <button type="button" onClick={closeAll} className="px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" title="Collapse all" aria-label="Collapse all">⤡</button>
          {typeof onRequestClose === "function" && (
            <button type="button" onClick={onRequestClose} className="md:hidden px-2 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700" aria-label="Close menu" title="Close">✖</button>
          )}
        </div>
      </div>

      {/* Scroll area */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Sticky search */}
        <div className="p-2 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="relative">
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
        </div>

        {/* Menu list */}
        <div className="p-2">
          {visibleTree.map((root) => <Node key={root.id} node={root} />)}
        </div>
      </div>
    </aside>
  );
}
