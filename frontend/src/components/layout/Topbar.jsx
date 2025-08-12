// src/components/layout/Topbar.jsx
import { useState } from "react";
import { Sun, Menu as MenuIcon } from "lucide-react";
import { useEnv } from "@/store/useEnv";

export default function Topbar({ onBurger }) {
  const { user } = useEnv();
  const [dark, setDark] = useState(true);

  return (
    <header className="h-14 border-b border-white/10 bg-slate-900/60 backdrop-blur sticky top-0 z-10 flex items-center px-3 gap-3">
      <button className="md:hidden p-2 rounded-lg hover:bg-white/10" onClick={onBurger}>
        <MenuIcon className="w-5 h-5 text-white/80" />
      </button>

      <div className="font-semibold tracking-tight text-slate-100">GeniusGrid</div>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="px-2 py-1 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => {
            setDark(v => !v);
            document.documentElement.classList.toggle("dark");
          }}
          title="Toggle theme"
        >
          <Sun className="w-4 h-4" />
        </button>
        <div className="text-xs text-white/70">{user?.email}</div>
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-fuchsia-500 to-sky-400" />
      </div>
    </header>
  );
}
