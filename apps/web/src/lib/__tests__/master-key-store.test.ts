import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearPersistedMasterKeys } from "../master-key-store";
import { STORAGE_KEYS } from "../storage-keys";

// Minimal in-memory localStorage stub. We only exercise the device-shard
// removal path here; the IndexedDB clear is allowed to fail (no fake-indexeddb)
// because clearPersistedMasterKeys swallows that error.
function installLocalStorageStub() {
  const map = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  vi.stubGlobal("localStorage", stub);
  return map;
}

describe("clearPersistedMasterKeys", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes the plaintext device shard from localStorage", async () => {
    const map = installLocalStorageStub();
    map.set(STORAGE_KEYS.deviceShard, "some-plaintext-shard");

    await clearPersistedMasterKeys();

    expect(localStorage.getItem(STORAGE_KEYS.deviceShard)).toBeNull();
  });
});
