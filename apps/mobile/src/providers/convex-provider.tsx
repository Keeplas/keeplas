import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";

import { env } from "@/lib/env";

const convex = new ConvexReactClient(env.convexUrl, {
  unsavedChangesWarning: false,
});

/** Convex Auth tokens live in the Keychain / Keystore, never in plain storage. */
const secureStorage: TokenStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      {children}
    </ConvexAuthProvider>
  );
}
