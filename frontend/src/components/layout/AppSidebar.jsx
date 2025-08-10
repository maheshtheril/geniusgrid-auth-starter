import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useEnv } from "@/store/useEnv";

function groupByPrefix(items) {
  const roots = [];
  const groups = new Map(); // 'admin' -> { label:'Admin', items:[...] }
  for (const it of items) {
    const code = String(it.code || "").toLowerCase();
    const prefix = code.includes(".") ? code.split(".")[0] : code;
    if (!code.includes(".")) {
      // parent candidate
      groups.set(prefix, { parent: it, items: [] });
    }
  }
  // second pass for children
  for (const it of items) {
    const code = String(it.code || "").toLowerCase();
    const prefix = code.includes(".") ? code.split(".")[0] : null;
    if (prefix && groups.has(prefix)) {
      groups.get(prefix).items.push(it);
    } else if (!prefix) {
      roots.push(it); // true top-level leaf
    }
  }
  return { roots, groups };
}

export default function AppSidebar() {
  const { menus } = useEnv();
  const { roots, groups } = useMemo(() => groupByPrefix(menus || []), [menus]);

  console.log("★ AppSidebar mounted. menus:", menus?.length, { roots, groups: [...groups.keys()] });

  return (
    <aside className="app-sidebar panel glass" style={{ border: "2px solid #7c3aed" }}>
      <div className="sidebar-head text-muted small">★ Menu (test)</div>

      {/* Grouped parents */}
      {[...groups.values()]
        .sort((a,b)=> (a.parent?.sort_order ?? 0) - (b.parent?.sort_order ?? 0))
        .map(({ parent, items }) => (
        <details key={parent.id} open>
          <summary className="nav-item nav-toggle" style={{ cursor: "pointer", fontWeight: 700 }}>
            {parent.name} <span style={{ marginLeft: "auto", fontSize: 11, opacity: .8 }}>Open</span>
          </summary>
          <div className="nav-children open">
            {items
              .sort((a,b)=> (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map(ch => (
                <NavLink
                  key={ch.id}
                  to={ch.path || "#"}
                  end
                  className={({isActive}) => "nav-item" + (isActive ? " active" : "")}
                  style={{ paddingLeft: 26 }}
                >
                  <span className="nav-dot" /> {ch.name}
                </NavLink>
              ))}
          </div>
        </details>
      ))}

      {/* Ungrouped roots (if any) */}
      {roots.length > 0 && (
        <>
          <div className="sidebar-head text-muted small" style={{ marginTop: 8 }}>Other</div>
          {roots.map(n => (
            <NavLink key={n.id} to={n.path || "#"} end className="nav-item">
              <span className="nav-dot" /> {n.name}
            </NavLink>
          ))}
        </>
      )}

      <div className="sidebar-foot text-muted small">© GeniusGrid</div>
    </aside>
  );
}
