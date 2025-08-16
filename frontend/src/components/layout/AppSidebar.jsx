// -----------------------------------------------
// src/components/Sidebar.jsx  (structure-first + brand header)
// -----------------------------------------------
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/* ------------- tiny helpers ------------- */
function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
}
function pathParts(p) {
  return (normPath(p) || "").split("/").filter(Boolean);
}
function isParentPath(p, items) {
  const parts = pathParts(p);
  return items.some(
    (r) =>
      r.path &&
      r.path.startsWith(p + "/") &&
      pathParts(r.path).length > parts.length
  );
}
const cmp = (a, b) =>
  (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0) ||
  String(a.name || "").localeCompare(String(b.name || ""));

/* ------------- normalize menu row ------------- */
function norm(row) {
  return {
    id: String(row.id ?? row.menu_id ?? row.menuId ?? row.code ?? Math.random().toString(36).slice(2)),
    code: String(row.code ?? row.name ?? ""),
    name: String(row.name ?? row.label ?? row.code ?? "Untitled"),
    path: normPath(row.path ?? row.url ?? row.route),
    icon: row.icon ?? null,
    sort_order: row.sort_order ?? row.order ?? 0,
    order: row.order ?? row.sort_order ?? 0,
    parent_id: row.parent_id ? String(row.parent_id) : null,
    parent_code: row.parent_code ?? null,
  };
}

/* ------------- build tree (parent_id → parent_code → path) ------------- */
function buildTree(items = []) {
  const src = items.map(norm);
  const byId = Object.fromEntries(src.map((r) => [r.id, { ...r, children: [] }]));
  const byCode = Object.fromEntries(src.map((r) => [r.code, byId[r.id]]));

  // 1) attach using parent_id
  const roots = [];
  for (const r of src) {
    const node = byId[r.id];
    if (r.parent_id && byId[r.parent_id]) {
      byId[r.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 2) attach using parent_code
  for (const r of src) {
    const node = byId[r.id];
    if (!node.parent_id && r.parent_code && byCode[r.parent_code]) {
      const p = byCode[r.parent_code];
      if (!p.children.some((c) => c.id === node.id)) {
        p.children.push(node);
        const idx = roots.indexOf(node);
        if (idx >= 0) roots.splice(idx, 1);
      }
    }
  }

  // 3) path-based fallback
  const rowsWithPath = Object.values(byId).filter((n) => n.path);
  function findClosestParentByPath(child) {
    if (!child.path) return null;
    const parts = pathParts(child.path);
    for (let i = parts.length - 1; i >= 1; i--) {
      const prefix = "/" + parts.slice(0, i).join("/");
      const candidate = rowsWithPath.find((r) => r.path === prefix);
      if (candidate && candidate.id !== child.id) return candidate;
    }
    return null;
  }
  for (const node of Object.values(byId)) {
    if (roots.includes(node)) {
      const p = findClosestParentByPath(node);
      if (p) {
        p.children.push(node);
        const idx = roots.indexOf(node);
        if (idx >= 0) roots.splice(idx, 1);
      }
    }
  }

  // 4) ensure Admin/CRM roots exist if children exist
  const needAdmin = src.some((r) => r.code === "admin" || r.code.startsWith("admin."));
  const needCrm = src.some((r) => r.code === "crm" || r.code.startsWith("crm."));
  function ensureRoot(code, name, path, icon, order = 10) {
    let node = Object.values(byId).find((n) => n.code === code);
    if (!node) {
      node = {
        id: `root:${code}`,
        code,
        name,
        path: normPath(path),
        icon,
        sort_order: order,
        order,
        children: [],
      };
      byId[node.id] = node;
      roots.push(node);
    }
    return node;
  }
  const adminRoot = needAdmin ? ensureRoot("admin", "Admin", "/app/admin", "⚙️", 10) : null;
  const crmRoot   = needCrm   ? ensureRoot("crm",   "CRM",   "/app/crm",   "🤝", 10) : null;

  // 5) move stray admin.* under Admin root
  if (adminRoot) {
    Object.values(byId)
      .filter((n) => n.code?.startsWith("admin.") && n !== adminRoot)
      .forEach((n) => {
        const isRoot = roots.includes(n);
        if (isRoot) {
          adminRoot.children.push(n);
          const idx = roots.indexOf(n);
          if (idx >= 0) roots.splice(idx, 1);
        }
      });
  }
  // 6) move stray crm.* under CRM root
  if (crmRoot) {
    Object.values(byId)
      .filter((n) => n.code?.startsWith("crm.") && n !== crmRoot)
      .forEach((n) => {
        const isRoot = roots.includes(n);
        if (isRoot) {
          crmRoot.children.push(n);
          const idx = roots.indexOf(n);
          if (idx >= 0) roots.splice(idx, 1);
        }
      });
  }

  // 7) sort
  const sortDeep = (arr) => {
    arr.sort(cmp);
    arr.forEach((n) => n.children?.length && sortDeep(n.children));
    return arr;
  };
  return sortDeep(roots);
}

/* ------------- UI widgets ------------- */
function Caret({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden
      style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .18s ease" }}
    >
      <path
        d="M8 5l8 7-8 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Collapse({ open, children, id }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(open ? "auto" : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      setHeight(el.scrollHeight);
      const t = setTimeout(() => setHeight("auto"), 200);
      return () => clearTimeout(t);
    } else {
      if (height === "auto") {
        setHeight(el.scrollHeight);
        requestAnimationFrame(() => setHeight(0));
      } else setHeight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      id={id}
      ref={ref}
      style={{
        maxHeight: typeof height === "number" ? height + "px" : height,
        overflow: "hidden",
        transition: "max-height .2s ease",
        marginLeft: 10,
        paddingLeft: 8,
        borderLeft: "1px solid var(--border)",
        willChange: "max-height",
      }}
    >
      {children}
    </div>
  );
}

/* ------------- Leaf/Group items ------------- */
function Leaf({ node, depth }) {
  return (
    <div className="nav-node">
      <NavLink
        to={node.path || "#"}
        end
        className={({ isActive }) => "app-link" + (isActive ? " active" : "")}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <span className="nav-dot" />
        <span>{node.name}</span>
      </NavLink>
    </div>
  );
}

function Group({ node, depth, parents, openSet, setOpen }) {
  const parentKey = node.path || `__group__${node.code || node.id}`;
  const idSlug = `group_${parentKey.replaceAll("/", "_")}`;
  const isOpen = openSet.has(parentKey);

  const toggle = () =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(parentKey) ? n.delete(parentKey) : n.add(parentKey);
      return n;
    });

  return (
    <div className="nav-node">
      <button
        type="button"
        className="app-link nav-toggle"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={isOpen}
        aria-controls={idSlug}
        title={node.name}
      >
        <Caret open={isOpen} />
        <span className="nav-label">{node.name}</span>
      </button>

      <Collapse open={isOpen} id={idSlug}>
        {node.children.map((ch) =>
          parents.has(ch) ? (
            <Group
              key={ch.id || ch.path}
              node={ch}
              depth={depth + 1}
              parents={parents}
              openSet={openSet}
              setOpen={setOpen}
            />
          ) : (
            <Leaf key={ch.id || ch.path} node={ch} depth={depth + 1} />
          )
        )}
      </Collapse>
    </div>
  );
}

/* ------------- Sidebar ------------- */
export default function AppSidebar() {
  const { menus, branding, tenant } = useEnv() || {};

  // Brand header (falls back gracefully)
  const appName =
    branding?.app_name ||
    branding?.appName ||
    "GeniusGrid";
  const tenantName =
    tenant?.name ||
    branding?.tenant_name ||
    branding?.tenantName ||
    "";
  const logoUrl =
    branding?.logo_url ||
    branding?.logoUrl ||
    branding?.logo ||
    null;

  const tree = useMemo(() => buildTree(menus || []), [menus]);

  // determine which nodes are parents
  const allParents = useMemo(() => {
    const set = new Set();
    const scan = (nodes) => {
      nodes.forEach((n) => {
        if (n.children?.length) set.add(n);
        n.children?.length && scan(n.children);
      });
    };
    scan(tree);
    return set;
  }, [tree]);

  useLocation(); // keep NavLink active state in sync

  // Persisted open groups
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem("__gg_menu_open_keys");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    localStorage.setItem("__gg_menu_open_keys", JSON.stringify([...open]));
  }, [open]);

  return (
    <aside className="app-sidebar">
      {/* ---- Brand header (App + Tenant) ---- */}
      <NavLink to="/app" className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl hover:bg-white/5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${appName} logo`}
            className="w-8 h-8 rounded-md object-contain bg-white/10"
          />
        ) : (
          <div className="w-8 h-8 rounded-md grid place-items-center bg-white/10 text-white/80 text-sm font-semibold">
            {String(appName).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">{appName}</div>
          {tenantName ? (
            <div className="text-[11px] text-white/60 leading-tight truncate">{tenantName}</div>
          ) : null}
        </div>
      </NavLink>

      <div className="sidebar-head">Menu</div>

      <nav className="app-nav">
        {tree.length ? (
          tree.map((n) =>
            allParents.has(n) ? (
              <Group
                key={n.id || n.path}
                node={n}
                depth={0}
                parents={allParents}
                openSet={open}
                setOpen={setOpen}
              />
            ) : (
              <Leaf key={n.id || n.path} node={n} depth={0} />
            )
          )
        ) : (
          <div className="gg-muted px-3 py-2 text-sm">No menus</div>
        )}
      </nav>

      <div className="sidebar-foot">© {appName}</div>
    </aside>
  );
}
