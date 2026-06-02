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
