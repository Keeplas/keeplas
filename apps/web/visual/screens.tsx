import type { ReactNode } from "react";
import { HubView, type HubViewProps } from "@/app/(dashboard)/hub/hub-view";

export interface HarnessScreen {
  /** Route the shell sees (active sidebar item). */
  path: string;
  /** "shell": sidebar + main at 1440 × 900; "state": a 393 px state card. */
  frame: "shell" | "state";
  render: () => ReactNode;
}

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const noop = () => {};

const hub: HubViewProps = {
  firstName: "Alex",
  setupDone: 3,
  trustContactsReady: false,
  recoveryKitReady: false,
  counts: { inbox: 3, documents: 12, accounts: 8 },
  recentItems: [
    {
      id: "1",
      title: "Will and estate plan",
      group: "document",
      updatedAt: NOW - 2 * DAY,
    },
    {
      id: "2",
      title: "House account",
      group: "account",
      updatedAt: NOW - 4 * DAY,
    },
    {
      id: "3",
      title: "Healthcare instructions",
      group: "document",
      updatedAt: NOW - 7 * DAY,
    },
  ],
  onAdd: noop,
  onScan: noop,
};

/** Fixture data mirrors the Figma frames (`figma/copy.md`). */
export const SCREENS: Record<string, HarnessScreen> = {
  "W04-3": {
    path: "/hub",
    frame: "shell",
    render: () => <HubView {...hub} />,
  },
  "W04-3b": {
    path: "/hub",
    frame: "shell",
    render: () => <HubView {...hub} addMenuOpen />,
  },
  "W04-3-empty": {
    path: "/hub",
    frame: "shell",
    render: () => <HubView {...hub} recentItems={[]} />,
  },
};
