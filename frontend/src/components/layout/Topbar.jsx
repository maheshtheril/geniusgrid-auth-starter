// src/components/layout/Topbar.jsx

import React from "react";
import {
  Menu as MenuIcon, ChevronDown, Plus, Bell, CircleHelp,
  Search, Sun, Moon, Star, MonitorSmartphone, CheckCircle2
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEnv } from "@/store/useEnv";
import { readMode } from "@/theme/mode";

/* ---------- tiny safe-helpers ---------- */
const lower = (v) => String(v ?? "").toLowerCase();
const safeArr = (a) => (Array.isArray(a) ? a : []);

/* ---- OPTIONAL ENDPOINT SWITCHES (no calls if false) ---- */
const HAS = {
  quick: (import.meta.env.VITE_HAS_QUICK ?? "0") === "1",
  notif: (import.meta.env.VITE_HAS_NOTIF ?? "0") === "1",
};

/* --- helper to mute repeated 404s when flags are ON but APIs are missing --- */
const __mute404Until = new Map();
async function tryGet(url, fallback) {
  const until = __mute404Until.get(url);
  if (until && Date.now() < until) return fallback;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 404) {
        __mute404Until.set(url, Date.now() + 5 * 60 * 1000);
        return fallback;
      }
      return fallback; // keep UI calm on non-404s during dev
    }
    return await res.json();
  } catch {
    return fallback;
  }
}

function api(path) {
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  const base = raw ? raw.replace(/\/+$/, "") : "";
  const withApi = base ? (base.endsWith("/api") ? base : `${base}/api`) : "/api";
  return `${withApi}${path}`;
}

/* ---- theme helpers ---- */
const THEMES = ["dark", "light", "night"];
function saveMode(mode) {
  try { localStorage.setItem("gg.theme", mode); } catch {}
  try { localStorage.setItem("theme", mode); } catch {}
}
function applyDomModeInline(mode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  document.body?.setAttribute("data-theme", mode);
  const darkLike = mode === "dark" || mode === "night";
  root.classList.toggle("dark", darkLike);
  root.style.colorScheme = darkLike ? "dark" : "light";
  try { window.applyTheme?.(window.__GG_THEME || {}, mode); } catch {}
}

/* ---- FY helpers ---- */
function computeFYLabel(date = new Date(), startMonth = 4, startDay = 1) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const startsThisYear = (m > startMonth) || (m === startMonth && d >= startDay);
  const fyStartYear = startsThisYear ? y : y - 1;
  return `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2,"0")}`;
}
function ThemeIcon({ value }) {
  if (value === "light") return <Sun className="w-4 h-4" />;
  if (value === "dark")  return <Moon className="w-4 h-4" />;
  if (value === "night") return <Star className="w-4 h-4" />;
  return <MonitorSmartphone className="w-4 h-4" />;
}

export default function Topbar({ collapsed, onToggleCollapse, onBurger }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, companies = [], activeCompanyId, setActiveCompany } = useEnv();

  const [modules, setModules] = React.useState([]);
  const [quickActions, setQuickActions] = React.useState([]);
  const [open, setOpen] = React.useState({ module:false, create:false, notif:false, help:false, user:false, company:false });
  const [theme, setTheme] = React.useState(() => readMode() || "dark");
  const [q, setQ] = React.useState("");
  const [notif, setNotif] = React.useState({ loading:true, items:[], unread:0 });

  const company = React.useMemo(
    () => safeArr(companies).find(c => c?.id === activeCompanyId) || safeArr(companies)[0] || null,
    [companies, activeCompanyId]
  );
  const fyLabel = React.useMemo(() => {
    const sm = Number(company?.fy_start_month) || 4;
    const sd = Number(company?.fy_start_day) || 1;
    return computeFYLabel(new Date(), sm, sd);
  }, [company]);

  const didBoot = React.useRef(false);

  React.useEffect(() => {
    if (didBoot.current) return;
    didBoot.current = true;

    applyDomModeInline(theme);

    // Menus (usually exists)
    (async () => {
      const data = await tryGet(api("/tenant/menus?level=top"), []);
      setModules(safeArr(data));
    })();

    // Quick actions — only if enabled
    (async () => {
      if (!HAS.quick) { setQuickActions([]); return; }
      const data = await tryGet(api("/tenant/quick-actions"), []);
      setQuickActions(safeArr(data));
    })();

    // Notifications — only if enabled
    (async () => {
      if (!HAS.notif) { setNotif({ loading:false, items:[], unread:0 }); return; }
      try {
        let unread = 0, items = [];
        const summary = await tryGet(api("/notifications/summary"), null);
        if (summary) {
          unread = Number(summary?.unread_count || 0);
          items = safeArr(summary?.items);
        } else {
          const list = await tryGet(api("/notifications?limit=10"), []);
          unread = Number(list?.unread_count || 0);
          items = safeArr(list?.items?.length ? list.items : list);
        }
        setNotif({ loading:false, items, unread });
      } catch {
        setNotif({ loading:false, items:[], unread:0 });
      }
    })();
  }, [theme]);

  React.useEffect(() => {
    // close any open dropdowns on route change
    setOpen({ module:false, create:false, notif:false, help:false, user:false, company:false });
  }, [loc.pathname]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const query = q.trim();
    if (query) nav(`/search?q=${encodeURIComponent(query)}`);
  }
  function handleThemeToggle() {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
    saveMode(next);
    applyDomModeInline(next);
  }

  async function markAllRead() {
    if (!HAS.notif) return;
    try {
      const r = await fetch(api("/notifications/mark-all-read"), {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" }, body:"{}"
      });
      if (r.ok) setNotif(n => ({ ...n, unread: 0, items: n.items.map(it => ({ ...it, read_at: it.read_at || new Date().toISOString() })) }));
    } catch {}
  }
  async function markOneRead(id) {
    if (!HAS.notif) return;
    try {
      const r = await fetch(api(`/notifications/${id}/read`), { method:"POST", credentials:"include" });
      if (!r.ok) return;
      setNotif(n => {
        const items = n.items.map(it => it.id === id ? { ...it, read_at: it.read_at || new Date().toISOString() } : it);
        return { ...n, items, unread: Math.max(0, n.unread - 1) };
      });
    } catch {}
  }

  return (
    <header className="sticky top-0 z-40 bg-base-100 border-b border-base-300">
      <div className="h-14 flex items-center gap-2 px-2 sm:px-4">
        {/* Left side */}
        <div className="flex items-center gap-1">
          {onBurger && (
            <button className="md:hidden btn btn-ghost btn-sm" onClick={onBurger} aria-label="Open sidebar">
              <MenuIcon className="w-5 h-5" />
            </button>
          )}
          <button className="hidden md:inline-flex btn btn-ghost btn-sm" onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Company */}
          <div className="relative">
            <button
              className="btn btn-ghost btn-sm gap-2"
              onClick={() => setOpen(o => ({ ...o, company: !o.company }))}
              aria-haspopup="menu"
              aria-expanded={open.company}
              title={company?.name || "Select company"}
            >
              <span className="font-medium truncate max-w-[22ch]">{company?.name || "Select Company"}</span>
              <span className="badge badge-outline text-xs">{fyLabel}</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>
            {open.company && safeArr(companies).length > 0 && (
              <div className="absolute left-0 mt-1 min-w-56 p-2 rounded-box bg-base-100 border border-base-300 shadow-lg">
                <div className="text-xs opacity-70 px-2 pb-1">Switch company</div>
                <ul className="menu">
                  {safeArr(companies).map(c => (
                    <li key={c?.id ?? `co-${Math.random().toString(36).slice(2)}`}>
                      <button
                        className="justify-between"
                        onClick={() => { c?.id && setActiveCompany?.(c.id); setOpen(o => ({ ...o, company:false })); }}
                      >
                        <span className="truncate">{c?.name ?? "Company"}</span>
                        {c?.id && c.id === company?.id && <span className="badge badge-primary badge-xs">Active</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Modules */}
          {safeArr(modules).length > 0 && (
            <div className="relative">
              <button
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => setOpen(o => ({ ...o, module: !o.module }))}
                aria-haspopup="menu"
                aria-expanded={open.module}
              >
                <span className="hidden sm:inline">Modules</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {open.module && (
                <div className="absolute mt-1 min-w-44 p-1 rounded-box bg-base-100 border border-base-300 shadow-lg">
                  {safeArr(modules).map(m => (
                    m?.path ? (
                      <Link key={m.id ?? m.path} to={m.path} className="flex items-center px-3 py-2 rounded-md hover:bg-base-200">
                        {m?.name ?? m.path}
                      </Link>
                    ) : (
                      <div key={m?.id ?? Math.random()} className="flex items-center px-3 py-2 rounded-md opacity-70 cursor-default">
                        {m?.name ?? "Module"}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-[720px] mx-2" role="search">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              type="search"
              placeholder="Search leads, companies, contacts, deals…"
              className="input input-sm w-full pl-9"
              aria-label="Global search"
            />
          </div>
        </form>

        {/* Right side */}
        <div className="flex items-center gap-1">
          {HAS.quick && safeArr(quickActions).length > 0 && (
            <div className="relative">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setOpen(o => ({ ...o, create: !o.create }))}
                aria-haspopup="menu"
                aria-expanded={open.create}
                title="Quick create"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden lg:inline">Create</span>
              </button>
              {open.create && (
                <div className="absolute right-0 mt-1 min-w-48 p-1 rounded-box bg-base-100 border border-base-300 shadow-lg">
                  {safeArr(quickActions).map(a => (
                    a?.path ? (
                      <Link key={a.path} to={a.path} className="flex px-3 py-2 rounded-md hover:bg-base-200">
                        {a?.label ?? "Action"}
                      </Link>
                    ) : (
                      <div key={a?.label ?? Math.random()} className="flex px-3 py-2 rounded-md opacity-70 cursor-default">
                        {a?.label ?? "Action"}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          {HAS.notif && (
            <div className="relative">
              <button
                className="btn btn-ghost btn-sm relative"
                title="Notifications"
                onClick={() => setOpen(o => ({ ...o, notif: !o.notif }))}
                aria-haspopup="menu"
                aria-expanded={open.notif}
              >
                <Bell className="w-5 h-5" />
                {Number(notif?.unread || 0) > 0 && (
                  <span className="indicator-item badge badge-error badge-xs absolute -top-1 -right-1">
                    {Number(notif.unread) > 99 ? "99+" : Number(notif.unread)}
                  </span>
                )}
              </button>
              {open.notif && (
                <div className="absolute right-0 mt-1 w-[22rem] max-w-[90vw] p-2 rounded-box bg-base-100 border border-base-300 shadow-lg">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <div className="text-sm opacity-70">Notifications</div>
                    <button onClick={markAllRead} className="btn btn-ghost btn-xs">Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-auto pr-1">
                    {notif.loading ? (
                      <div className="p-3 text-sm opacity-70">Loading…</div>
                    ) : safeArr(notif.items).length === 0 ? (
                      <div className="p-3 text-sm opacity-70">No notifications</div>
                    ) : (
                      <ul className="menu">
                        {safeArr(notif.items).map(it => {
                          const unread = !it?.read_at;
                          const created = it?.created_at ? new Date(it.created_at) : null;
                          return (
                            <li key={it?.id ?? Math.random()} className="!my-0">
                              <div className={`px-2 py-2 rounded-md ${unread ? "bg-base-200" : "hover:bg-base-200"}`}>
                                <div className="flex items-start gap-2">
                                  {unread ? <span className="mt-1 w-2 h-2 rounded-full bg-primary" /> : <CheckCircle2 className="w-4 h-4 mt-[2px] opacity-60" />}
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate" title={it?.title || it?.message || "Notification"}>
                                      {it?.title || it?.message || "Notification"}
                                    </div>
                                    {it?.subtitle && <div className="text-xs opacity-70 truncate">{it.subtitle}</div>}
                                    {created && <div className="text-[11px] opacity-60 mt-0.5">{created.toLocaleString()}</div>}
                                  </div>
                                  {unread && it?.id && <button className="btn btn-ghost btn-xs" onClick={() => markOneRead(it.id)}>Mark read</button>}
                                </div>
                                {it?.href && <Link to={it.href} className="link link-primary text-xs mt-1 inline-block">Open</Link>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="mt-2 text-right">
                    <Link to="/notifications" className="link link-primary text-sm">View all</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Help */}
          <div className="relative">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(o => ({ ...o, help: !o.help }))}
              aria-haspopup="menu"
              aria-expanded={open.help}
              title="Help & docs"
            >
              <CircleHelp className="w-5 h-5" />
            </button>
            {open.help && (
              <div className="absolute right-0 mt-1 min-w-60 p-2 rounded-box bg-base-100 border border-base-300 shadow-lg">
                <ul className="menu">
                  <li><Link to="/help">Help Center</Link></li>
                  <li><Link to="/docs">Documentation</Link></li>
                  <li><Link to="/support">Contact Support</Link></li>
                </ul>
              </div>
            )}
          </div>

          {/* Theme */}
          <button className="btn btn-ghost btn-sm" onClick={handleThemeToggle} title={`Theme: ${theme}`} aria-label="Switch theme">
            <ThemeIcon value={theme} />
          </button>

          {/* User */}
          <div className="relative">
            <button
              className="btn btn-ghost btn-sm gap-2"
              onClick={() => setOpen(o => ({ ...o, user: !o.user }))}
              aria-haspopup="menu"
              aria-expanded={open.user}
              title="Account"
            >
              <div className="avatar placeholder">
                <div className="w-7 rounded-full bg-base-300 text-base-content/80">
                  <span className="text-xs">{user?.name?.[0]?.toUpperCase?.() || "U"}</span>
                </div>
              </div>
              <span className="hidden xl:inline text-sm font-medium max-w-[18ch] truncate">
                {user?.name || "User"}
              </span>
              <ChevronDown className="w-4 h-4 opacity-60 hidden md:inline" />
            </button>
            {open.user && (
              <div className="absolute right-0 mt-1 min-w-64 p-2 rounded-box bg-base-100 border border-base-300 shadow-lg">
                <div className="px-3 py-2">
                  <div className="font-medium truncate">{user?.name || "User"}</div>
                  {user?.email && <div className="text-xs opacity-70 truncate">{user.email}</div>}
                </div>
                <ul className="menu">
                  <li><Link to="/account">Profile & Settings</Link></li>
                  <li><Link to="/admin">Admin</Link></li>
                  <li className="border-t border-base-300 my-1" />
                  <li><a href={api("/auth/logout")}>Sign out</a></li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
