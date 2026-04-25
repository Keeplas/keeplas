import { useSyncExternalStore } from "react";
import {
  startRegistration as browserStartRegistration,
  startAuthentication as browserStartAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

export type RegisterOptions = {
  startRegistration: (args: {
    deviceName?: string;
  }) => Promise<PublicKeyCredentialCreationOptionsJSON>;
  finishRegistration: (args: {
    response: unknown;
    deviceName?: string;
  }) => Promise<{ success: boolean }>;
};

export type AuthenticateOptions = {
  startAuthentication: (args: {
    email?: string;
  }) => Promise<PublicKeyCredentialRequestOptionsJSON>;
  signInWithPasskey: (response: unknown) => Promise<unknown>;
};

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

const noopSubscribe = () => () => {};
const getClientSnapshot = () => isPasskeySupported();
const getServerSnapshot = () => false;

/**
 * SSR-safe hook returning whether the current browser supports WebAuthn passkeys.
 * Returns false during server render and on first client paint, then updates
 * after hydration without triggering a mismatch warning.
 */
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}

function detectDeviceName(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android device";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux device";
  return "This device";
}

export async function registerPasskey(
  api: RegisterOptions,
  deviceName?: string
): Promise<void> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser.");
  }
  const name = deviceName?.trim() || detectDeviceName();
  const options = await api.startRegistration({ deviceName: name });
  const response = await browserStartRegistration({ optionsJSON: options });
  await api.finishRegistration({ response, deviceName: name });
}

export async function loginWithPasskey(
  api: AuthenticateOptions,
  email?: string
): Promise<void> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser.");
  }
  const options = await api.startAuthentication({ email });
  const response = await browserStartAuthentication({ optionsJSON: options });
  await api.signInWithPasskey(response);
}

export function getPasskeyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") {
      return "Passkey prompt was dismissed or timed out.";
    }
    if (err.name === "InvalidStateError") {
      return "A passkey is already registered for this device.";
    }
    if (err.name === "SecurityError") {
      return "Passkey blocked by browser security policy.";
    }
    if (err.message) return err.message;
  }
  return fallback;
}
