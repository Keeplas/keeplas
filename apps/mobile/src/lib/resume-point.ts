import * as SecureStore from "expo-secure-store";
import type { Href } from "expo-router";

export interface ResumePoint {
  pathname: string;
  params: Record<string, string>;
  at: number;
}

export const RESUME_MAX_AGE_MS = 60 * 60 * 1000;

const SETUP_ROUTES = [
  "/pin",
  "/contacts",
  "/add-contact",
  "/kit",
  "/done",
  "/warning",
];
// Screens that only pass through, or that must not restart on their own after
// an unlock (the recorder would record, the scanner would open the camera).
const SKIPPED = [
  "/",
  "/home",
  "/unlock",
  "/capture/securing",
  "/capture/voice",
  "/capture/scan",
  "/new-device",
  "/passkey",
  "/vault",
];

export function isResumable(pathname: string): boolean {
  // A recovery approval may have closed while the vault was locked.
  if (pathname.startsWith("/recovery-approval/")) return false;
  return !SKIPPED.includes(pathname);
}

export function resumeTarget(
  point: ResumePoint | null,
  settingUp: boolean,
  now: number,
): Href | null {
  if (!point) return null;
  if (SETUP_ROUTES.includes(point.pathname) !== settingUp) return null;
  if (!settingUp && now - point.at > RESUME_MAX_AGE_MS) return null;
  if (point.pathname === "/contacts" || point.pathname === "/add-contact") {
    return null;
  }
  return { pathname: point.pathname, params: point.params } as Href;
}

const resumeKey = (userId: string) => `keeplas.resume.${userId}`;
const setupKey = (userId: string) => `keeplas.setup.${userId}`;

export async function readResumePoint(
  userId: string,
): Promise<ResumePoint | null> {
  const raw = await SecureStore.getItemAsync(resumeKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ResumePoint;
  } catch {
    return null;
  }
}

export function writeResumePoint(
  userId: string,
  point: ResumePoint,
): Promise<void> {
  return SecureStore.setItemAsync(resumeKey(userId), JSON.stringify(point));
}

export async function readSetupPending(userId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(setupKey(userId))) === "pending";
}

export function writeSetupPending(
  userId: string,
  pending: boolean,
): Promise<void> {
  return pending
    ? SecureStore.setItemAsync(setupKey(userId), "pending")
    : SecureStore.deleteItemAsync(setupKey(userId));
}
