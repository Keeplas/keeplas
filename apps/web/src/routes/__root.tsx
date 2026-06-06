import type { ReactNode } from "react";
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { Toaster } from "@keeplas/ui";
import AppProviders from "@/providers";
import { NotFoundContent } from "@/app/not-found-content";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/geist";
import "@/app/globals.css";

// Production origin the app is served from. Social crawlers require an absolute
// URL for og:image / twitter:image, so the share card is resolved against this.
const OG_ORIGIN = "https://app.keeplas.com";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Keeplas — Life Continuity Platform" },
      {
        name: "description",
        content:
          "Securely store, organize, and transmit vital information to trusted contacts. Zero-knowledge encryption, open-source.",
      },
      // Open Graph / Twitter share card. Mirrors the landing page's social
      // card (same branded 1200×630 image with the hero message). Social
      // crawlers do not render SVG, so a flattened PNG is served from public/.
      // The image URL is absolute against the production app origin so
      // crawlers can resolve it regardless of the shared path.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Keeplas" },
      { property: "og:title", content: "Keeplas — Life Continuity Platform" },
      {
        property: "og:description",
        content:
          "If something happens to you, your loved ones know exactly what to do.",
      },
      { property: "og:image", content: `${OG_ORIGIN}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "Keeplas — If something happens to you, your loved ones know exactly what to do",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Keeplas — Life Continuity Platform" },
      {
        name: "twitter:description",
        content:
          "If something happens to you, your loved ones know exactly what to do.",
      },
      { name: "twitter:image", content: `${OG_ORIGIN}/og-image.png` },
    ],
    links: [{ rel: "icon", href: "/assets/logo/favicon.svg" }],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundContent,
});

function RootComponent() {
  return (
    <RootDocument>
      <AppProviders>
        <Outlet />
      </AppProviders>
      <Toaster />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
