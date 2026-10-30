/**
 * The vault export runs here, outside any screen and outside the unlocked
 * app tree: leaving the export screen, putting Keeplas in the background or
 * the vault locking does not stop it. Native background work keeps the app
 * running meanwhile, and a local notification (generic text, no vault data)
 * says when it ends unless the export screen is in view; tapping it opens
 * that screen. The plaintext archive is deleted once seen and left, on the
 * next export, on sign-out and on the next launch.
 */
import { AppState } from "react-native";
import { Directory, Paths, type File } from "expo-file-system";
import * as Notifications from "expo-notifications";

import {
  beginBackgroundWork,
  endBackgroundWork,
  onBackgroundWorkExpired,
  reportBackgroundProgress,
} from "../../../modules/background-work";

export interface ExportProgress {
  stage: "opening" | "files";
  done: number;
  total: number;
}

export class ExportCancelled extends Error {}

export type ExportRun = (
  onProgress: (progress: ExportProgress) => void,
  cancelled: () => boolean,
) => Promise<{ archive: File; skipped: number }>;

export type ExportPhase =
  | { kind: "idle" }
  | { kind: "running"; progress: ExportProgress | null }
  | { kind: "ready"; archive: File; skipped: number }
  | { kind: "failed" };

/** Localized texts for the system progress UI and the final notification. */
export interface ExportTexts {
  title: string;
  running: string;
  ready: string;
  failed: string;
}

/** Holds the archive and the decrypted files it is built from. */
export const exportFolder = () => new Directory(Paths.cache, "export");

let phase: ExportPhase = { kind: "idle" };
let stop = false;
let watched = false;
let seen = false;
const listeners = new Set<() => void>();

// Left by a run the OS killed: nothing in memory points to it any more.
clearFolder();

function clearFolder() {
  const folder = exportFolder();
  if (folder.exists) folder.delete();
}

function set(next: ExportPhase) {
  phase = next;
  for (const listener of listeners) listener();
}

const errorReason = (error: unknown) =>
  (error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error)
  ).replace(/https?:\/\/\S+/g, "<url>");

const inView = () => watched && AppState.currentState === "active";

function notify(title: string, body: string) {
  if (inView()) return;
  void Notifications.scheduleNotificationAsync({
    content: { title, body, data: { url: "/export" } },
    // Android: the app's "Keeplas" channel (allowPushNotifications creates it
    // at every unlocked launch); without one, Expo posts to "Miscellaneous".
    trigger: { channelId: "default" },
  });
}

export const getExportPhase = () => phase;

export function subscribeExport(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function startExport(
  run: ExportRun,
  texts: ExportTexts,
): Promise<void> {
  if (phase.kind === "running") return;
  clearFolder();
  stop = false;
  seen = false;
  set({ kind: "running", progress: null });
  beginBackgroundWork(texts.title, texts.running);
  const expiry = onBackgroundWorkExpired(cancelExport);
  try {
    const { archive, skipped } = await run(
      (progress) => {
        reportBackgroundProgress(progress.done, progress.total);
        set({ kind: "running", progress });
      },
      () => stop,
    );
    // Cancelled while the archive was being closed.
    if (stop) throw new ExportCancelled();
    endBackgroundWork(true);
    seen = inView();
    set({ kind: "ready", archive, skipped });
    notify(texts.title, texts.ready);
  } catch (error) {
    endBackgroundWork(false);
    if (error instanceof ExportCancelled) {
      clearFolder();
      set({ kind: "idle" });
    } else {
      console.warn("Export failed", errorReason(error));
      set({ kind: "failed" });
      notify(texts.title, texts.failed);
    }
  } finally {
    expiry.remove();
  }
}

export function cancelExport(): void {
  stop = true;
}

/** Stops a running export and deletes the archive (sign-out). */
export function discardExport(): void {
  stop = true;
  if (phase.kind === "running") return; // Cleared once the run stops.
  clearFolder();
  set({ kind: "idle" });
}

/**
 * Called while the export screen is focused. A ready archive the user has
 * seen there is deleted when they leave; one finished out of view is kept
 * for when the notification brings them back.
 */
export function watchExport(): () => void {
  watched = true;
  if (phase.kind === "ready" && inView()) seen = true;
  return () => {
    watched = false;
    if (phase.kind === "ready" && seen) discardExport();
  };
}
