import type { ReactNode } from "react";
import { DevicesView } from "@/app/(dashboard)/devices/devices-view";
import { HubView, VaultEmptyMessage } from "@/app/(dashboard)/hub/hub-view";
import { RecoveryCenterView } from "@/app/(dashboard)/settings/recovery/recovery-center-view";
import { SettingsView } from "@/app/(dashboard)/settings/settings-view";
import {
  NothingSharedMessage,
  SharedWithMeView,
} from "@/app/(dashboard)/shared-with-me/shared-with-me-view";
import {
  LifeCheckMissedMessage,
  LifeCheckModal,
} from "@/components/life-check-prompt";
import {
  devices,
  hub,
  noop,
  recovery,
  settings,
  sharedFolders,
} from "./fixtures";

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

const state = (render: () => ReactNode): HarnessScreen => ({
  path: "/",
  frame: "state",
  render,
});

const lifeCheck = () => (
  <>
    <HubView {...hub} />
    <LifeCheckModal missed={false} onConfirm={noop} busy={false} />
  </>
);

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
  "W04-5": shell("/settings/recovery", () => (
    <RecoveryCenterView {...recovery} />
  )),
  "W04-6": shell("/devices", () => <DevicesView {...devices} />),
  "W04-7": shell("/settings", () => <SettingsView {...settings} />),
  "W05-3": shell("/life-check", lifeCheck),
  "W05-4": shell("/life-check", lifeCheck),
  "state-vault-empty": state(() => <VaultEmptyMessage onAdd={noop} />),
  "state-nothing-shared": state(() => <NothingSharedMessage />),
  "state-we-missed-you": state(() => (
    <LifeCheckMissedMessage onConfirm={noop} busy={false} />
  )),
};
