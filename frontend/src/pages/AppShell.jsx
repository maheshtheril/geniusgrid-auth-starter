// pages/AppShell.jsx
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import { buildMenuTree } from "../utils/menuTree.js";

export default function AppShell({ children }) {
  const [state, setState] = useState({ loading: true, tree: [], user: null, modules: [] });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) { window.location.href = "/login"; return; }
      const data = await res.json();
      setState({
        loading: false,
        tree: buildMenuTree(data.menus || []),
        user: data.user,
        modules: data.modules || []
      });
    })();
  }, []);

  if (state.loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="flex">
      <Sidebar tree={state.tree}/>
      <main className="flex-1 min-h-screen">{children}</main>
    </div>
  );
}
