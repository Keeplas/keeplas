import { Platform } from "react-native";
import * as Device from "expo-device";
import * as AppIntegrity from "@expo/app-integrity";

import { env } from "./env";

export interface Attestation {
  platform: "ios" | "android" | "simulator";
  token: string;
  keyId?: string;
}

/**
 * Prove the genuine app on a real device over the server `challenge`
 * (mobile-only sign-up, F8). iOS: App Attest; Android: Play Integrity
 * standard request bound to the challenge. Simulators / emulators cannot
 * attest: they send `simulator`, accepted only by a dev deployment with
 * ATTESTATION_SIMULATOR_BYPASS=true.
 */
export async function attestDevice(challenge: string): Promise<Attestation> {
  if (!Device.isDevice) return { platform: "simulator", token: "simulator" };
  if (Platform.OS === "ios") {
    if (!AppIntegrity.isSupported)
      throw new Error("App Attest is not supported");
    const keyId = await AppIntegrity.generateKeyAsync();
    const token = await AppIntegrity.attestKeyAsync(keyId, challenge);
    return { platform: "ios", token, keyId };
  }
  await AppIntegrity.prepareIntegrityTokenProviderAsync(env.gcpProjectNumber);
  const token = await AppIntegrity.requestIntegrityCheckAsync(challenge);
  return { platform: "android", token };
}

/** Short reference shown on M09-9 so support can find the failure. */
export function attestationReference(now: number = Date.now()): string {
  return `ATT-${now.toString(36).toUpperCase().slice(-5)}`;
}

/** Human label for the devices list: "iPhone 15", "Pixel 8". */
export function deviceLabel(): string {
  return (
    Device.modelName ?? (Platform.OS === "ios" ? "iPhone" : "Android phone")
  );
}
