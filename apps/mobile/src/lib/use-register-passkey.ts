import { useCallback } from "react";
import { Platform } from "react-native";
import { useMutation } from "convex/react";
import { Passkey, type PasskeyCreateRequest } from "react-native-passkey";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import {
  readDeviceId,
  readReattachToken,
  writeDeviceId,
  writeReattachToken,
} from "@/crypto/device-vault";
import { deviceLabel } from "./attestation";
import { useAuditedMutation } from "./use-audited-mutation";

/**
 * This phone's `devices` row, registered once per account (trusted). It
 * links the passkey to the device so revoking the device drops its passkey.
 * After a sign-out, the next sign-in takes the same row back with the token
 * devices.signOut left (a new row would alert the other devices about this
 * very phone).
 */
export function useEnsureDevice() {
  const register = useAuditedMutation(api.devices.register);
  return useCallback(
    async (userId: string): Promise<Id<"devices">> => {
      const known = await readDeviceId(userId);
      const token = await readReattachToken(userId);
      if (known && !token) return known as Id<"devices">;
      // `auditedMutation` widens the return type to unknown; it is the row id.
      const deviceId = (await register({
        kind: Platform.OS === "ios" ? "ios" : "android",
        label: deviceLabel(),
        trusted: true,
        ...(known && token
          ? { reattach: { deviceId: known as Id<"devices">, token } }
          : {}),
      })) as Id<"devices">;
      await writeDeviceId(userId, deviceId);
      await writeReattachToken(userId, null);
      return deviceId;
    },
    [register],
  );
}

/**
 * M01-3: register this device, then a platform passkey (Face ID /
 * fingerprint) through `webauthn.startRegistration` / `finishRegistration`.
 * Needs the Associated Domains / asset links of the WebAuthn RP ID.
 */
export function useRegisterPasskey() {
  const ensureDevice = useEnsureDevice();
  const startRegistration = useMutation(api.webauthn.startRegistration);
  const finishRegistration = useMutation(api.webauthn.finishRegistration);

  return useCallback(
    async (userId: string) => {
      const keeplasDeviceId = await ensureDevice(userId);
      const deviceName = deviceLabel();
      const options = await startRegistration({ deviceName });
      const credential = await Passkey.create(options as PasskeyCreateRequest);
      await finishRegistration({
        response: {
          type: "public-key",
          clientExtensionResults: {},
          ...credential,
        },
        deviceName,
        keeplasDeviceId,
      });
    },
    [ensureDevice, startRegistration, finishRegistration],
  );
}
