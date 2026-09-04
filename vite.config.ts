import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  publicDir: "public",
  clearScreen: false,
  build: {
    outDir: "site",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: "app.html",
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    open: "/app.html",
  },
});
