 // src/components/ThemeToggle.jsx
 import { useEffect, useState } from "react";
 import { applyTheme, nextMode as libNextMode } from "@/theme/applyTheme";
 import { uiApi } from "@/api/ui";
 
@@
 export default function ThemeToggle() {
-  const initial =
-    localStorage.getItem("theme") ||
-    document.documentElement.getAttribute("data-theme") ||
-    "dark";
+  // Lazy, SSR-safe initializer
+  const initial = (() => {
+    try {
+      if (typeof window !== "undefined") {
+        return (
+          localStorage.getItem("theme") ||
+          document.documentElement.getAttribute("data-theme") ||
+          "dark"
+        );
+      }
+    } catch {}
+    return "dark";
+  })();
 
   const [mode, setMode] = useState(initial);
   const [theme, setTheme] = useState(null);
 
   useEffect(() => {
     let alive = true;
     (async () => {
       try {
         const cfg = window.__GG_THEME || (await uiApi.getTheme()) || FALLBACK_THEME;
         if (!alive) return;
         setTheme(cfg);
         applyTheme(cfg, mode);
+        // Ensure THEME_CSS applies even if applyTheme doesn't set it
+        document.documentElement.setAttribute("data-theme", mode);
       } catch {
         if (!alive) return;
         setTheme(FALLBACK_THEME);
         applyTheme(FALLBACK_THEME, mode);
+        document.documentElement.setAttribute("data-theme", mode);
       }
       localStorage.setItem("theme", mode);
     })();
     return () => { alive = false; };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // mount once
 
   const cycle = () => {
     const cfg = theme || FALLBACK_THEME;
     const next = safeNextMode(cfg, mode);
     setMode(next);
     applyTheme(cfg, next);
+    document.documentElement.setAttribute("data-theme", next);
     localStorage.setItem("theme", next);
     uiApi?.setTheme?.({ theme: next }); // fire-and-forget
   };
 
   const label = mode === "light" ? "☀️ Light" : mode === "dark" ? "🌙 Dark" : "🌌 Night";
   return (
-    <button className="gg-btn gg-btn-ghost h-9 px-3" onClick={cycle} title="Switch theme">
+    <button
+      className="gg-btn gg-btn-ghost h-9 px-3"
+      onClick={cycle}
+      title={`Switch theme (current: ${label.replace(/^[^ ]+ /,'')})`}
+      aria-pressed="true"
+    >
       {label}
     </button>
   );
 }
