import type { HubViewProps } from "@/app/(dashboard)/hub/hub-view";
import type { SharedFolder } from "@/app/(dashboard)/shared-with-me/shared-with-me-view";

// Fixture data mirrors the Figma frames (figma/copy.md). The test clock is
// frozen (screens.spec.ts), so relative dates are stable.
const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const noop = () => {};

export const hub: HubViewProps = {
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

export const sharedFolders: SharedFolder[] = [
  {
    id: "family",
    name: "Family documents",
    ownerName: "Alex",
    available: true,
    files: [
      {
        id: "will",
        title: "Will",
        detail: "PDF · 1.2 MB",
        updatedAt: new Date(2026, 0, 12).getTime(),
      },
      {
        id: "medical",
        title: "Medical directives",
        detail: "DOCX · 850 KB",
        updatedAt: new Date(2026, 1, 3).getTime(),
      },
      {
        id: "financial",
        title: "Financial information",
        detail: "XLSX · 520 KB",
        updatedAt: new Date(2026, 1, 18).getTime(),
      },
    ],
  },
  {
    id: "letters",
    name: "Letters",
    ownerName: "Alex",
    available: false,
    files: [],
  },
];
