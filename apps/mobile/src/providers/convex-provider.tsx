import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

import { deviceStore } from "@/lib/device-store";
import { env } from "@/lib/env";

const convex = new ConvexReactClient(env.convexUrl, {
  unsavedChangesWarning: false,
});

/**
 * Convex Auth tokens live in the Keychain / Keystore, never in plain
 * storage, and never leave this phone: a restored backup signs in again.
 */
export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={deviceStore}>
      {children}
    </ConvexAuthProvider>
  );
}
