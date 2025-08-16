// -----------------------------------------------
// src/components/Sidebar.jsx  — premium sidebar
// -----------------------------------------------
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";
import Icon from "@/components/ui/Icon";

/* ---------------- tiny helpers ---------------- */
function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
}
const cmp = (a, b) =>
  (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0) ||
  String(a.name || "").localeCompare(String(b.name || ""));

function isEmoji(x) {
  try { return /[\p{Extended_Pictographic}]/u.test(x || ""); }
  catch { return /[^\w\s]/.test(x || ""); }
}
function lucideName(s = "") {
  return s
    .split(/[-_ ]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("") || "Dot";
}

/* --------------- normalize menu row --------------- */
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
    children: [],
  };
}

/* --------------- build tree (id, code & path aware) --------------- */
function buildTree(items = []) {
  const src = items.map(norm);
  const byId = Object.fromEntries(src.map((r) => [r.id, { ...r, children: [] }]));
  const byCode = Object.fromEntries(src.map((r) => [r.code, byId[r.id]]));

  // 1) attach using parent_id
  const roots = [];
  for (const r of src) {
    const node = byId[r.id];
    if (r.parent_id && byId[r.parent_id]) byId[r.parent_id].children.push(node);
    else roots.push(node);
  }

  // 2) attach using parent_code
  for (const r of src) {
    const node = byId[r.id];
    if (!r.parent_id && r.parent_code && byCode[r.parent_code]) {
      const p = byCode[r.parent_code];
      if (!p.children.some((c) => c.id === node.id)) {
        p.children.push(node);
        const idx = roots.indexOf(node);
        if (idx >= 0) roots.splice(idx, 1);
      }
    }
  }

  // 3) ensure Admin/CRM roots if any children exist
  const needAdmin = src.some((r) => r.code === "admin" || r.code.startsWith("admin."));
  const needCrm = src.some((r) => r.code === "crm" || r.code.startsWith("crm."));
  function ensureRoot(code, name, path, icon, order = 10) {
    let node = Object.values(byId).find((n) => n.code === code);
    if (!node) {
      node = { id: `root:${code}`, code, name, path: normPath(path), icon, sort_order: order, order, children: [] };
      byId[node.id] = node;
      roots.push(node);
    }
    return node;
  }
  const adminRoot = needAdmin ? ensureRoot("admin", "Admin", "/app/admin", "Settings", 10) : null;
  const crmRoot   = needCrm   ? ensureRoot("crm",   "CRM",   "/app/crm",   "Handshake", 10) : null;

  // 4) move stray admin.* under Admin root; crm.* under CRM root
  function absorb(prefix, root) {
    if (!root) return;
    [...roots].forEach((n) => {
      if (n.code?.startsWith(prefix + ".") && n !== root) {
        root.children.push(n);
        roots.splice(roots.indexOf(n), 1);
      }
    });
  }
  absorb("admin", adminRoot);
  absorb("crm", crmRoot);

  // 5) sort deep
  const sortDeep = (arr) => { arr.sort(cmp); arr.forEach((n) => n.children?.length && sortDeep(n.children)); return arr; };
  return sortDeep(roots);
}

/* --------------- filtering --------------- */
function filterTree(nodes, q) {
  if (!q) return nodes;
  const qq = q.toLowerCase();
  const walk = (arr) => {
    const out = [];
    for (const n of arr) {
      const match = n.name.toLowerCase().includes(qq) || n.code?.toLowerCase().includes(qq);
      const kids = n.children?.length ? walk(n.children) : [];
      if (match || kids.length) out.push({ ...n, children: kids });
    }
    return out;
  };
  return walk(nodes);
}

/* --------------- simple collapse animation --------------- */
function Collapse({ open, children }) {
  const ref = useRef(null);
  const [h, setH] = useState(open ? "auto" : 0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (open) {
      setH(el.scrollHeight);
      const t = setTimeout(() => setH("auto"), 200);
      return () => clearTimeout(t);
    } else {
      if (h === "auto") { setH(el.scrollHeight); requestAnimationFrame(() => setH(0)); }
      else setH(0);
    }
  }, [open]); // eslint-disable-line
  return (
    <div ref={ref} style={{ maxHeight: typeof h === "number" ? h + "px" : h }} className="overflow-hidden">
      {children}
    </div>
  );
}

/* --------------- leaf / group items --------------- */
function Leaf({ node, depth }) {
  const iconIsEmoji = isEmoji(node.icon);
  const icnName = iconIsEmoji ? null : lucideName(node.icon || "");
  return (
    <NavLink
      to={node.path || "#"}
      end
      title={node.name}
      className={({ isActive }) =>
        [
          "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
          isActive
            ? "bg-white/10 text-white border-l-2 border-l-[var(--primary)]"
            : "text-gray-300 hover:text-white hover:bg-white/5 border-l-2 border-l-transparent",
        ].join(" ")
      }
      style={{ paddingLeft: 10 + depth * 16 }}
    >
      <span className="w-4 h-4 shrink-0 grid place-items-center opacity-80">
        {iconIsEmoji ? <span className="text-sm">{node.icon}</span> : <Icon name={icnName || "Dot"} className="w-4 h-4" />}
      </span>
      <span className="truncate">{node.name}</span>
    </NavLink>
  );
}

function Group({ node, depth, openSet, setOpen, parentsSet }) {
  const key = node.path || `__group__${node.code || node.id}`;
  const open = openSet.has(key);
  const iconIsEmoji = isEmoji(node.icon);
  const icnName = iconIsEmoji ? null : lucideName(node.icon || "Folder");

  const toggle = () => setOpen((prev) => {
    const n = new Set(prev);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5 hover:text-white"
        style={{ paddingLeft: 10 + depth * 16 }}
        aria-expanded={open}
      >
        <span className="w-4 h-4 shrink-0 grid place-items-center opacity-80">
          {iconIsEmoji ? <span className="text-sm">{node.icon}</span> : <Icon name={icnName || "Folder"} className="w-4 h-4" />}
        </span>
        <span className="flex-1 truncate font-medium">{node.name}</span>
        <Icon name={open ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 opacity-80" />
      </button>

      <Collapse open={open}>
        <div className="ml-3 pl-3 border-l border-white/10">
          {node.children.map((ch) =>
            parentsSet.has(ch)
              ? <Group key={ch.id} node={ch} depth={depth + 1} openSet={openSet} setOpen={setOpen} parentsSet={parentsSet} />
              : <Leaf  key={ch.id} node={ch} depth={depth + 1} />
          )}
        </div>
      </Collapse>
    </div>
  );
}

/* --------------- main sidebar --------------- */
export default function Sidebar() {
  const { menus, branding, tenant } = useEnv() || {};
  const treeRaw = useMemo(() => buildTree(menus || []), [menus]);

  // who is a parent?
  const parentsSet = useMemo(() => {
    const set = new Set();
    const walk = (arr) => arr.forEach((n) => { if (n.children?.length) { set.add(n); walk(n.children); } });
    walk(treeRaw);
    return set;
  }, [treeRaw]);

  // filter
  const [q, setQ] = useState("");
  const tree = useMemo(() => (q ? filterTree(treeRaw, q) : treeRaw), [treeRaw, q]);

  // open state (persist)
  const [open, setOpen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("__gg_menu_open_keys") || "[]")); }
    catch { return new Set(); }
  });
  useEffect(() => localStorage.setItem("__gg_menu_open_keys", JSON.stringify([...open])), [open]);

  // keyboard: '/' to focus search
  const searchRef = useRef(null);
  useEffect(() => {
    const onK = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = searchRef.current;
        if (el) { e.preventDefault(); el.focus(); el.select(); }
      }
    };
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, []);

  // brand
  const appName    = branding?.app_name || branding?.appName || "GeniusGrid";
  const tenantName = tenant?.name || branding?.tenant_name || branding?.tenantName || "";
  const logoUrl    = branding?.logo_url || branding?.logoUrl || branding?.logo || null;

  // expand/collapse all helpers
  const allKeys = useMemo(() => {
    const keys = [];
    const walk = (arr) => arr.forEach((n) => {
      if (n.children?.length) {
        keys.push(n.path || `__group__${n.code || n.id}`);
        walk(n.children);
      }
    });
    walk(treeRaw);
    return keys;
  }, [treeRaw]);

  const expandAll = () => setOpen(new Set(allKeys));
  const collapseAll = () => setOpen(new Set());

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 border-r border-white/10">
      {/* brand header */}
      <div className="sticky top-0 z-10 backdrop-blur bg-slate-900/60 border-b border-white/10">
        <NavLink to="/app" className="flex items-center gap-3 px-3 py-3 hover:bg-white/5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-8 h-8 rounded-md object-contain bg-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-md grid place-items-center bg-white/10 text-white/80 text-sm font-semibold">
              {String(appName).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">{appName}</div>
            {tenantName ? <div className="text-[11px] text-white/60 leading-tight truncate">{tenantName}</div> : null}
          </div>
        </NavLink>

        <div className="px-3 pb-3 pt-2 space-y-2">
          {/* search */}
          <div className="relative">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…  ( / )"
              className="w-full h-9 rounded-lg bg-white/5 text-sm px-3 pr-7 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <Icon name="Search" className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
          </div>

          {/* tools */}
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <button onClick={expandAll} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Expand all</button>
            <button onClick={collapseAll} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Collapse all</button>
            {q && <span className="ml-auto italic">Filtering…</span>}
          </div>
        </div>
      </div>

      {/* nav */}
      <div className="flex-1 overflow-auto px-2 pb-3 pt-2">
        {tree.length ? (
          tree.map((n) =>
            n.children?.length
              ? <Group key={n.id} node={n} depth={0} openSet={open} setOpen={setOpen} parentsSet={parentsSet} />
              : <Leaf  key={n.id} node={n} depth={0} />
          )
        ) : (
          <div className="gg-muted px-3 py-2 text-sm">No menus</div>
        )}
      </div>

      <div className="px-3 py-3 text-[11px] text-white/40 border-t border-white/10">© {appName}</div>
    </aside>
  );
}
