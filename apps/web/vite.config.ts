import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Inline the `NEXT_PUBLIC_*` vars as `process.env.NEXT_PUBLIC_*` member
  // expressions so the existing client code keeps working unchanged (this
  // mirrors Next.js' build-time inlining of public env vars). Server-only
  // secrets (KEEPLAS_CTX_SECRET, STRIPE_*, ...) are read from process.env at
  // runtime inside server middleware/functions and are intentionally NOT
  // inlined into the client bundle.
  // Vite's `loadEnv` only reads `.env` FILES. On Vercel/CI the `NEXT_PUBLIC_*`
  // vars are injected via the dashboard as `process.env` (no `.env` file is
  // written), so loadEnv alone returns nothing there and the values never get
  // inlined — leaving `process.env.NEXT_PUBLIC_CONVEX_URL` undefined in the
  // client AND the SSR bundle (which makes the Convex client null, so
  // `ConvexAuthProvider` never mounts and `useConvexAuth` throws). Merge both
  // sources, with `process.env` winning so the deployment env overrides files.
  const filePublicEnv = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  const processPublicEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      key.startsWith("NEXT_PUBLIC_"),
    ),
  );
  const env = { ...filePublicEnv, ...processPublicEnv };
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
    resolve: {
      alias: {
        // vite 8's rolldown bundler picks tslib's CommonJS build and its
        // `__toESM(...).default` interop comes back undefined, so destructuring
        // the helpers (`__extends`, …) throws when the prerender loads the SSR
        // bundle. Pin tslib to its ESM entry so it is bundled as ESM directly.
        tslib: "tslib/tslib.es6.mjs",
      },
    },
    plugins: [
      // Resolve the `@/*` path alias from tsconfig.json.
      tsconfigPaths(),
      // Tailwind v4 via its first-class Vite plugin (not the PostCSS plugin).
      // Tailwind's own engine resolves the `@import "tailwindcss"` /
      // `tw-animate-css` / `shadcn/tailwind.css` directives in globals.css, so
      // vite 8's rolldown CSS pipeline never tries to resolve the bare
      // `tailwindcss` specifier as a file (which broke the SSR build).
      tailwindcss(),
      // SPA mode: the server renders only the shell + runs request middleware
      // and server routes; the app renders client-side. This matches the old
      // Next.js `force-dynamic` + client-guard model and avoids SSR/hydration
      // issues with Convex auth state and localStorage-based i18n.
      tanstackStart({ spa: { enabled: true } }),
      // Compile the server (request middleware + server routes) into a Vercel
      // Function via Nitro. Required for Vercel to build/deploy TanStack Start
      // (replaces the old Next.js framework preset).
      nitro({
        // The Vercel build externalizes React (the SSR function does a runtime
        // `require('react')`), but on Vercel's pnpm install the tracer failed to
        // copy it into the function — so production crashed with `Cannot find
        // module 'react'` at /var/task, surfaced as h3's `{status:500,unhandled:
        // true,message:"HTTPError"}`. Force-trace the React family into the
        // function output. (Inlining via `noExternals` is not an option: it
        // breaks React's JSX dev-runtime CJS interop during prerender.)
        traceDeps: ["react", "react-dom"],
      }),
      viteReact(),
    ],
  };
});
