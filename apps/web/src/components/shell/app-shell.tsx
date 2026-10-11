import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";

/** Signed-in web frame (1440 × 900 in Figma): sidebar + 48 px gutters. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-app md:flex-row">
      <AppSidebar />
      <main className="min-w-0 flex-1 px-[20px] py-[24px] md:px-[48px] md:pt-[40px] md:pb-[48px]">
        {children}
      </main>
    </div>
  );
}
