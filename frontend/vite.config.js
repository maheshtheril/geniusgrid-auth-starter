// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";

// Run with ANALYZE=true npm run build to open a treemap
const analyze = process.env.ANALYZE === "true";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    plugins: [
      react(),
      analyze &&
        visualizer({
          filename: "bundle-report.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: true,
        }),
    ].filter(Boolean),

    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },

    server: {
      host: true,
      port: 5173,
      open: false,
    },
    preview: {
      host: true,
      port: 5173,
    },

    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },

    esbuild: {
      // Strip console/debugger in prod builds
      drop: isProd ? ["console", "debugger"] : [],
    },

    build: {
      target: "es2022", // or 'esnext' if all targets support it
      sourcemap: false, // set true for staging if needed
      cssCodeSplit: true,
      assetsInlineLimit: 1024, // keep images/fonts as separate files
      chunkSizeWarningLimit: 1200,
      minify: "esbuild",
      rollupOptions: {
        output: {
          // Split heavy libs so first load stays lean and caching works better
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
