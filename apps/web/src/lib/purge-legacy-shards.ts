/**
 * Delete MasterKey shards that pre-v2 builds left in this browser (v2 F1/F2):
 * the owner's plaintext slot-0 share in localStorage and the raw shards a
 * trusted contact unwrapped into IndexedDB. Nothing reads them any more; this
 * only removes the leftovers. Best-effort and idempotent.
 */
export function purgeLegacyShards(): void {
  try {
    localStorage.removeItem("keeplas_device_shard");
  } catch {
    // Storage unavailable (private mode) — nothing persisted there either.
  }
  try {
    indexedDB.deleteDatabase("keeplas-recovery-shards");
  } catch {
    // IndexedDB unavailable — same as above.
  }
}
