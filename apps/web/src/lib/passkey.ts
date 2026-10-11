import { useSyncExternalStore } from "react";
import {
  startRegistration as browserStartRegistration,
  startAuthentication as browserStartAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { fromBase64Url } from "./device-unlock";
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
    keeplasDeviceId?: Id<"devices">;
  }) => Promise<{ success: boolean }>;
};

export type AuthenticateOptions = {
  startAuthentication: (
    args: Record<string, never>,
  ) => Promise<PublicKeyCredentialRequestOptionsJSON>;
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
    getServerSnapshot,
  );
}

/**
 * Registers a server passkey (sign-in) with the PRF extension enabled, so the
 * same credential can also wrap the MasterKey on this device (device-unlock
 * "biometric" entry). Returns the raw credential id. `prf: {}` only asks the
 * authenticator to enable PRF: no PRF output is produced here, so nothing
 * secret reaches the server with the registration response.
 */
export async function registerPasskey(
  api: RegisterOptions,
  deviceName: string,
  keeplasDeviceId?: Id<"devices">,
): Promise<Uint8Array> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser.");
  }
  const options = await api.startRegistration({ deviceName });
  const response = await browserStartRegistration({
    optionsJSON: {
      ...options,
      extensions: {
        ...options.extensions,
        prf: {},
      } as AuthenticationExtensionsClientInputs,
    },
  });
  await api.finishRegistration({ response, deviceName, keeplasDeviceId });
  return fromBase64Url(response.rawId);
}

/** Discoverable-credential sign-in: the passkey identifies the account. */
export async function loginWithPasskey(
  api: AuthenticateOptions,
): Promise<void> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser.");
  }
  const options = await api.startAuthentication({});
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
