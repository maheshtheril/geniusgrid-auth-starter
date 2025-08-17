// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(async ({ mode }) => {
  const isProd = mode === "production";
  const analyze = process.env.ANALYZE === "true";

  const plugins = [react()];

  // Lazy-load visualizer only when ANALYZE=true
  if (analyze) {
    try {
      const { visualizer } = await import("rollup-plugin-visualizer");
      plugins.push(
        visualizer({
          filename: "bundle-report.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: true, // opens locally; on Render it won't open (no GUI)
        })
      );
    } catch (err) {
      console.warn(
        "ANALYZE=true but 'rollup-plugin-visualizer' is not installed.\n" +
          "Install it locally with: npm i -D rollup-plugin-visualizer"
      );
    }
  }

  return {
    plugins,
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { host: true, port: 5173 },
    preview: { host: true, port: 5173 },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
    esbuild: {
      drop: isProd ? ["console", "debugger"] : [],
    },
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
              if (id.includes("recharts")) return "vendor-recharts";
              if (id.includes("framer-motion")) return "vendor-motion";
              if (id.includes("lucide-react")) return "vendor-icons";
              if (id.includes("react-router")) return "vendor-router";
              if (id.includes("axios")) return "vendor-axios";
              if (id.includes("zustand")) return "vendor-state";
              return "vendor";
            }
          },
        },
      },
    },
  };
});
