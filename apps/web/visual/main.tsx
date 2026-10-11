/**
 * Visual regression harness (dev/test only, never part of `vite build`):
 * renders one screen's presentational view with fixture data, no Convex
 * backend. `?screen=<id>&theme=light|dark&lang=en|fr`, ids in ./screens.tsx.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./harness.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConfirmDialogProvider, Toaster } from "@keeplas/ui";
import { AppShell } from "@/components/shell/app-shell";
import { ShellAccountProvider } from "@/components/shell/shell-account";
import { I18nProvider } from "@/lib/i18n";
import { LANGUAGE_STORAGE_KEY } from "@/lib/locale";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { SCREENS } from "./screens";

const params = new URLSearchParams(window.location.search);
const screen = SCREENS[params.get("screen") ?? ""];
const theme = params.get("theme") === "dark" ? "dark" : "light";
window.localStorage.setItem(LANGUAGE_STORAGE_KEY, params.get("lang") ?? "en");
window.localStorage.setItem(STORAGE_KEYS.theme, theme);
document.documentElement.classList.toggle("dark", theme === "dark");

// Components that still call Convex hooks (language switcher) get a client
// that never connects: queries stay loading, nothing reaches a backend.
const convex = new ConvexReactClient("https://visual-harness.convex.cloud", {
  unsavedChangesWarning: false,
});

function Screen() {
  if (!screen) {
    return (
      <ul className="p-8 text-body">
        {Object.keys(SCREENS).map((id) => (
          <li key={id}>
            <a href={`?screen=${id}`}>{id}</a>
          </li>
        ))}
      </ul>
    );
  }
  if (screen.frame === "state") {
    return (
      <div className="w-[393px] rounded-[20px] bg-bg-app">
        {screen.render()}
      </div>
    );
  }
  return (
    <ShellAccountProvider account={{ initials: "A", signOut: () => {} }}>
      <AppShell>{screen.render()}</AppShell>
    </ShellAccountProvider>
  );
}

const router = createRouter({
  routeTree: createRootRoute({ component: Screen }),
  history: createMemoryHistory({ initialEntries: [screen?.path ?? "/"] }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <I18nProvider>
        <ConfirmDialogProvider>
          {/* The harness router is not the app's registered router. */}
          <RouterProvider router={router as never} />
          <Toaster />
        </ConfirmDialogProvider>
      </I18nProvider>
    </ConvexProvider>
  </StrictMode>,
);
