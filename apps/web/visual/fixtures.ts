import type { DevicesViewProps } from "@/app/(dashboard)/devices/devices-view";
import type { HubViewProps } from "@/app/(dashboard)/hub/hub-view";
import type { RecoveryCenterViewProps } from "@/app/(dashboard)/settings/recovery/recovery-center-view";
import type { SettingsViewProps } from "@/app/(dashboard)/settings/settings-view";
import type {
  VaultListRow,
  VaultListViewProps,
} from "@/app/(dashboard)/vault/vault-list-view";

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
      type: "Document",
      updatedAt: NOW - 2 * DAY,
    },
    {
      id: "2",
      title: "House account",
      type: "Account",
      updatedAt: NOW - 4 * DAY,
    },
    {
      id: "3",
      title: "Healthcare instructions",
      type: "Document",
      updatedAt: NOW - 7 * DAY,
    },
  ],
  onAdd: noop,
  onScan: noop,
};

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

// W06-1: the Figma rows, already labelled as the page would label them.
const row = (
  id: string,
  title: string,
  detail: string,
  style: VaultListRow["style"],
  category: string,
  folder: string,
  access: VaultListRow["access"],
  updated: string,
): VaultListRow => ({
  id,
  title,
  detail,
  style,
  category,
  folder,
  access,
  updated,
});
const onlyYou = { icon: "lock", label: "Only you" } as const;
const sarah = { icon: "user", label: "Sarah" } as const;
const people = (count: number) =>
  ({ icon: "people", label: `${count} people` }) as const;

export const vaultList: VaultListViewProps = {
  list: "all",
  counts: {
    all: 37,
    inbox: 0,
    documents: 12,
    accounts: 8,
    instructions: 3,
    notes: 5,
    photos: 6,
    voice: 2,
    videos: 1,
    other: 0,
  },
  rows: [
    row(
      "1",
      "Home insurance policy.pdf",
      "PDF · 3 pages · 2.4 MB",
      "documents",
      "Insurance",
      "Family",
      onlyYou,
      "Today",
    ),
    row(
      "2",
      "Will and estate plan.pdf",
      "PDF · 12 pages · 4.1 MB",
      "documents",
      "Legal",
      "Family",
      people(2),
      "2 days ago",
    ),
    row(
      "3",
      "Instructions for my family",
      "Note · 3 attachments",
      "notes",
      "Instructions",
      "Family",
      people(3),
      "4 days ago",
    ),
    row(
      "4",
      "House account",
      "Account · Maple Bank",
      "accounts",
      "Accounts",
      "Home",
      onlyYou,
      "4 days ago",
    ),
    row(
      "5",
      "Healthcare instructions",
      "Document · DOCX · 220 KB",
      "instructions",
      "Instructions",
      "Health",
      sarah,
      "1 week ago",
    ),
    row(
      "6",
      "Spare keys location.jpg",
      "Photo · 1.1 MB",
      "photos",
      "Photos",
      "Home",
      sarah,
      "2 weeks ago",
    ),
    row(
      "7",
      "Message for Sarah",
      "Voice note · 0:28",
      "voice",
      "Voice notes",
      "Family",
      onlyYou,
      "3 weeks ago",
    ),
    row(
      "8",
      "Property deed.pdf",
      "PDF · 5 pages · 1.8 MB",
      "documents",
      "Property",
      "Home",
      people(2),
      "1 month ago",
    ),
  ],
  search: "",
  sort: "updated",
  onList: noop,
  onSearch: noop,
  onSort: noop,
  onArchive: noop,
  onFiles: noop,
  onAdd: noop,
  onScan: noop,
  empty: null,
};
