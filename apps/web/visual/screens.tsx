import type { ReactNode } from "react";
import { HubView } from "@/app/(dashboard)/hub/hub-view";
import { SharedWithMeView } from "@/app/(dashboard)/shared-with-me/shared-with-me-view";
import { hub, noop, sharedFolders } from "./fixtures";

export interface HarnessScreen {
  /** Route the shell sees (active sidebar item). */
  path: string;
  /** "shell": sidebar + main at 1440 × 900; "state": a 393 px state card. */
  frame: "shell" | "state";
  render: () => ReactNode;
}

const shell = (path: string, render: () => ReactNode): HarnessScreen => ({
  path,
  frame: "shell",
  render,
});

/** Screen ids match the Figma frames (and screens.spec.ts). */
export const SCREENS: Record<string, HarnessScreen> = {
  "W04-3": shell("/hub", () => <HubView {...hub} />),
  "W04-3b": shell("/hub", () => <HubView {...hub} addMenuOpen />),
  "W04-3-empty": shell("/hub", () => <HubView {...hub} recentItems={[]} />),
  "W04-4": shell("/shared-with-me", () => (
    <SharedWithMeView folders={sharedFolders} onDownload={noop} />
  )),
  "W04-4-empty": shell("/shared-with-me", () => (
    <SharedWithMeView folders={[]} onDownload={noop} />
  )),
};
