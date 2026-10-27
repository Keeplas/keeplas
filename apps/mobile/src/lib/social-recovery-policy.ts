import type { FunctionReturnType } from "convex/server";
import type { api } from "@keeplas/backend/_generated/api";

type Health = FunctionReturnType<typeof api.recovery.getHealth>;
type Targets = FunctionReturnType<typeof api.recovery.getSetupTargets>;

export function contactsCanRecover(health: Health | undefined): boolean {
  return (
    !!health?.trustContacts.configured && !health.trustContacts.renewalRequired
  );
}

export function needsSocialRecoverySetup(
  health: Health | undefined,
  targets: Targets | undefined,
): boolean {
  if (!health || !targets || targets.contacts.length < 2) return false;
  return !contactsCanRecover(health);
}
