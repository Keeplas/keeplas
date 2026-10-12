import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Dev server for the visual regression harness only (Playwright starts it).
// The app build (`vite build` with ../vite.config.ts) never includes it.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  server: { port: 3100, strictPort: true },
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  plugins: [
    tsconfigPaths({ root: fileURLToPath(new URL("..", import.meta.url)) }),
    tailwindcss(),
    viteReact(),
  ],
});
