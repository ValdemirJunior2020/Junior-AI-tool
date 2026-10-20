import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Preserve hashed assets during local rebuilds: browsers with older open tabs
    // must not receive index.html instead of the CSS/JS file they already loaded.
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;
          if (/react-markdown|remark-|rehype-|unified|micromark|mdast|hast|vfile|parse-entities|property-information/.test(id)) return "markdown-vendor";
          if (/react-dom|\/react\/|scheduler/.test(id)) return "react-vendor";
          if (id.includes("lucide-react")) return "icon-vendor";
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3001" }
  }
});
