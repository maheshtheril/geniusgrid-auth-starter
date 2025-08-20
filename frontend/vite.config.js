// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(async ({ mode }) => {
  const isProd = mode === "production";
  const analyze = process.env.ANALYZE === "true";

  const plugins = [react()];

  if (analyze) {
    try {
      const { visualizer } = await import("rollup-plugin-visualizer");
      plugins.push(
        visualizer({
          filename: "bundle-report.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: true,
        })
      );
    } catch {
      console.warn(
        "ANALYZE=true but 'rollup-plugin-visualizer' is not installed. Install with: npm i -D rollup-plugin-visualizer"
      );
    }
  }

  // Backend target for dev proxy (change if your backend port differs)
  const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || "http://localhost:3000";

  return {
    plugins,
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        // Any request to /api/* will be proxied to your backend
        "/api": {
          target: DEV_API_TARGET,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: { "*": "localhost" },
          cookiePathRewrite: { "/": "/" },
        },
      },
    },
    preview: { host: true, port: 5173 },
    optimizeDeps: { include: ["react", "react-dom", "react-router-dom"] },
    esbuild: { drop: isProd ? ["console", "debugger"] : [] },
    build: {
      target: "es2022",
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 1024,
      chunkSizeWarningLimit: 1200,
      minify: "esbuild",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("/@radix-ui/")) return "vendor-radix";
              if (id.includes("lucide-react")) return "vendor-lucide";
              if (id.includes("recharts")) return "vendor-recharts";
              if (id.includes("framer-motion")) return "vendor-motion";
              if (id.includes("react-router")) return "vendor-router";
              if (id.includes("axios")) return "vendor-axios";
              if (id.includes("zustand")) return "vendor-state";
              if (id.includes("date-fns") || id.includes("dayjs")) return "vendor-date";
              if (id.includes("lodash")) return "vendor-lodash";
              return "vendor";
            }
          },
        },
      },
    },
  };
});
