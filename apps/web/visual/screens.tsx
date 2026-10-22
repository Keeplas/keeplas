import type { ReactNode } from "react";
import { DevicesView } from "@/app/(dashboard)/devices/devices-view";
import { HubView, VaultEmptyMessage } from "@/app/(dashboard)/hub/hub-view";
import { RecoveryCenterView } from "@/app/(dashboard)/settings/recovery/recovery-center-view";
import { SettingsView } from "@/app/(dashboard)/settings/settings-view";
import {
  NothingSharedMessage,
  SharedWithMeView,
} from "@/app/(dashboard)/shared-with-me/shared-with-me-view";
import { TravelModeOnMessage } from "@/app/(dashboard)/life-check/sections/travel-mode-on";
import { NoContactsMessage } from "@/app/(dashboard)/trusted-contacts/no-contacts-message";
import {
  LifeCheckMissedMessage,
  LifeCheckModal,
} from "@/components/life-check-prompt";
import { OfflineMessage } from "@/components/offline-notice";
import { PermissionOffMessage } from "@/components/permission-off-message";
import {
  StorageFullMessage,
  UploadFailedMessage,
} from "@/components/upload-state-messages";
import { VaultListView } from "@/app/(dashboard)/vault/vault-list-view";
import {
  addDocument,
  documentViewer,
  newNote,
  photoPreview,
  recordVoice,
  scanWithPhone,
  securingItem,
  videoPreview,
} from "./item-screens";
import {
  devices,
  hub,
  noop,
  recovery,
  settings,
  sharedFolders,
  vaultList,
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
  "W06-1": shell("/vault", () => <VaultListView {...vaultList} />),
  "W06-2": shell("/vault", documentViewer),
  "W06-3": shell("/hub", addDocument),
  "W06-4": shell("/hub", securingItem),
  "W06-5": shell("/vault", newNote),
  "W06-6": shell("/hub", recordVoice),
  "W06-7": shell("/hub", scanWithPhone),
  "W06-8": shell("/vault", photoPreview),
  "W06-9": shell("/vault", videoPreview),
  "W05-3": shell("/life-check", lifeCheck),
  "W05-4": shell("/life-check", lifeCheck),
  "state-vault-empty": state(() => <VaultEmptyMessage onAdd={noop} />),
  "state-nothing-shared": state(() => <NothingSharedMessage />),
  "state-we-missed-you": state(() => (
    <LifeCheckMissedMessage onConfirm={noop} busy={false} />
  )),
  "state-no-contacts": state(() => <NoContactsMessage onAdd={noop} />),
  "state-travel-mode": state(() => (
    <TravelModeOnMessage
      until={new Date(2026, 10, 12).getTime()}
      onChangeDates={noop}
      onTurnOff={noop}
    />
  )),
  "state-offline": state(() => <OfflineMessage onClose={noop} />),
  "state-upload-failed": state(() => (
    <UploadFailedMessage
      name="Passport scan.pdf"
      onRetry={noop}
      onRemove={noop}
    />
  )),
  "state-storage-full": state(() => (
    <StorageFullMessage
      quota="100 MB"
      canUpgrade
      onUpgrade={noop}
      onManage={noop}
    />
  )),
  "state-camera-off": state(() => (
    <PermissionOffMessage device="camera" onRetry={noop} onDismiss={noop} />
  )),
  "state-microphone-off": state(() => (
    <PermissionOffMessage device="microphone" onRetry={noop} onDismiss={noop} />
  )),
};
