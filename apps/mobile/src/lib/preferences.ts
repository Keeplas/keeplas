import * as SecureStore from "expo-secure-store";

/**
 * Small non-secret device preferences (language, appearance, setup flags).
 * Kept in SecureStore too so the app has a single storage dependency.
 */
const KEYS = {
  language: "keeplas.pref.language",
  appearance: "keeplas.pref.appearance",
  kitExported: "keeplas.pref.kitExported",
} as const;

export type PreferenceKey = keyof typeof KEYS;

export function readPreference(key: PreferenceKey): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS[key]);
}

export function writePreference(
  key: PreferenceKey,
  value: string,
): Promise<void> {
  return SecureStore.setItemAsync(KEYS[key], value);
}

export function clearPreference(key: PreferenceKey): Promise<void> {
  return SecureStore.deleteItemAsync(KEYS[key]);
}
