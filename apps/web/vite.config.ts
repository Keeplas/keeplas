import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Inline the `NEXT_PUBLIC_*` vars as `process.env.NEXT_PUBLIC_*` member
  // expressions so the existing client code keeps working unchanged (this
  // mirrors Next.js' build-time inlining of public env vars). Server-only
  // secrets (KEEPLAS_CTX_SECRET, STRIPE_*, ...) are read from process.env at
  // runtime inside server middleware/functions and are intentionally NOT
  // inlined into the client bundle.
  const env = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  const define = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      `process.env.${key}`,
      JSON.stringify(value),
    ]),
  );

  // Make server-side env vars (e.g. KEEPLAS_CTX_SECRET, read at runtime in
  // src/start.ts) available on process.env for the dev server. `vite dev` only
  // exposes prefixed vars via import.meta.env — unlike `next dev`, it does not
  // populate process.env from .env files. Shell/platform values keep precedence
  // (so prod, which injects its own env, is unaffected — this config does not
  // run inside the built server bundle).
  const fileEnv = loadEnv(mode, process.cwd(), "");
  process.env = { ...fileEnv, ...process.env };

  return {
    server: { port: 3000 },
    define,
    plugins: [
      // Resolve the `@/*` path alias from tsconfig.json.
      tsconfigPaths(),
      // SPA mode: the server renders only the shell + runs request middleware
      // and server routes; the app renders client-side. This matches the old
      // Next.js `force-dynamic` + client-guard model and avoids SSR/hydration
      // issues with Convex auth state and localStorage-based i18n.
      tanstackStart({ spa: { enabled: true } }),
      // Compile the server (request middleware + server routes) into a Vercel
      // Function via Nitro. Required for Vercel to build/deploy TanStack Start
      // (replaces the old Next.js framework preset).
      nitro(),
      viteReact(),
    ],
  };
});
