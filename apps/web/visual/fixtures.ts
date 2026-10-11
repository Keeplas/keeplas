import type { DevicesViewProps } from "@/app/(dashboard)/devices/devices-view";
import type { HubViewProps } from "@/app/(dashboard)/hub/hub-view";
import type { RecoveryCenterViewProps } from "@/app/(dashboard)/settings/recovery/recovery-center-view";
import type { SettingsViewProps } from "@/app/(dashboard)/settings/settings-view";
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

export const recovery: RecoveryCenterViewProps = {
  identifier: "+1 415 555 0123",
  ready: { anotherDevice: false, trustContacts: false, recoveryKit: false },
  // D3 / D4: 72 h window and a 6-digit code (Figma shows 36 h and 4729).
  request: { approved: 1, code: "472915", windowEndsAt: NOW + 36 * HOUR },
  onCancel: noop,
  cancelling: false,
};

export const devices: DevicesViewProps = {
  devices: [
    {
      id: "iphone",
      kind: "ios",
      label: "iPhone",
      lastSeenAt: NOW,
      current: true,
    },
    {
      id: "mac",
      kind: "web",
      label: "Chrome on Mac",
      lastSeenAt: NOW - 2 * HOUR,
      current: false,
    },
    {
      id: "ipad",
      kind: "ios",
      label: "iPad",
      lastSeenAt: NOW - 3 * DAY,
      current: false,
    },
  ],
  alert: { id: "mac", label: "Chrome on Mac", createdAt: NOW - 2 * HOUR },
  pinEnabled: true,
  activity: [
    {
      id: "1",
      title: "Successful sign-in",
      detail: "Chrome on Mac",
      tone: "active",
      at: NOW - 2 * HOUR,
    },
    {
      id: "2",
      title: "Item viewed",
      detail: "Will",
      tone: "pending",
      at: NOW - 3 * DAY,
    },
    {
      id: "3",
      title: "Device revoked",
      detail: "Old phone",
      tone: "danger",
      at: NOW - 7 * DAY,
    },
  ],
  onRevoke: noop,
  onNotMe: noop,
  onItWasMe: noop,
  onPinChange: noop,
  onSeeAll: noop,
};

const MB = 1024 * 1024;

export const settings: SettingsViewProps = {
  usedBytes: 62 * MB,
  quotaBytes: 100 * MB,
  breakdown: [
    {
      label: "Documents",
      bytes: 38 * MB,
      colorClassName: "bg-category-document",
    },
    {
      label: "Photos & scans",
      bytes: 14 * MB,
      colorClassName: "bg-category-account",
    },
    {
      label: "Voice notes",
      bytes: 6 * MB,
      colorClassName: "bg-category-instruction",
    },
    { label: "Notes", bytes: 4 * MB, colorClassName: "bg-category-note" },
  ],
  plan: "free",
  language: "English",
  lifeCheck: "Monthly",
  notifications: "On",
  onSignOut: noop,
};
