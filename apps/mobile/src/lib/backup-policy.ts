import type { FunctionReturnType } from "convex/server";
import type { api } from "@keeplas/backend/_generated/api";

type BackupStatus = FunctionReturnType<typeof api.cloud_backup.status>;

/**
 * D7 (on by default): seal the RootKey to iCloud / Google when the account
 * has no backup yet or the stored one opens older 24 words — never after
 * the owner turned it off, and not before the status loaded.
 */
export function needsCloudBackup(status: BackupStatus | undefined): boolean {
  if (!status) return false;
  return status.enabled ? !status.current : !status.turnedOff;
}
