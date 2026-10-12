// JS bridge to the KeeplasCloudKey native module. It stores the Cloud Backup
// Key (CBK) as a *synced* secret (iCloud Keychain on iOS, Google Block Store on
// Android) so it comes back on a new phone signed in to the same account —
// expo-secure-store is device-only and cannot do this. Removing the CBK is half
// of turning cloud backup off (the other half is deleting the backup blob).
import { requireNativeModule } from "expo";
import { Platform } from "react-native";

export type CloudKeyProvider = "icloud" | "google";

type NativeCloudKey = {
  isEndToEndEncrypted(): Promise<boolean>;
  write(key: string, value: string): Promise<void>;
  read(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
};

const native = requireNativeModule<NativeCloudKey>("KeeplasCloudKey");

export const provider: CloudKeyProvider =
  Platform.OS === "ios" ? "icloud" : "google";

/** True when the platform keystore syncs end to end (Android: Block Store E2EE available; iOS: always true). */
export function isEndToEndEncrypted(): Promise<boolean> {
  return native.isEndToEndEncrypted();
}

export function write(key: string, value: string): Promise<void> {
  return native.write(key, value);
}

export function read(key: string): Promise<string | null> {
  return native.read(key);
}

export function remove(key: string): Promise<void> {
  return native.remove(key);
}
