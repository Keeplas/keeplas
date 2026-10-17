// JS bridge to the KeeplasDeviceLock native module. It keeps small device-only
// secrets behind the phone's screen lock: the Keychain / Keystore releases
// them after Face ID / fingerprint OR the phone's PIN / passcode / pattern.
// expo-secure-store's requireAuthentication accepts strong biometrics only,
// which shuts out phones that have just a PIN.
import { requireNativeModule } from "expo";

type NativeDeviceLock = {
  isDeviceSecure(): boolean;
  setItem(key: string, value: string, prompt: string): Promise<void>;
  getItem(key: string, prompt: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
};

const native = requireNativeModule<NativeDeviceLock>("KeeplasDeviceLock");

/** True when the phone has a screen lock: PIN, passcode, pattern, password, face or fingerprint. */
export function isDeviceSecure(): boolean {
  return native.isDeviceSecure();
}

/** Stores `value` behind the screen lock. Android prompts (`prompt` is its title); iOS does not. */
export function setItem(
  key: string,
  value: string,
  prompt: string,
): Promise<void> {
  return native.setItem(key, value, prompt);
}

/** Prompts for the screen lock, then returns the value (null when absent). Throws when cancelled. */
export function getItem(key: string, prompt: string): Promise<string | null> {
  return native.getItem(key, prompt);
}

export function deleteItem(key: string): Promise<void> {
  return native.deleteItem(key);
}
