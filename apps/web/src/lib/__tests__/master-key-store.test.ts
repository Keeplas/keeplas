import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearPersistedMasterKeys,
  isPersistedKeyExpired,
} from "../master-key-store";
import { AUTO_LOCK_TIMEOUT_MS } from "../use-idle-timer";

// Pre-v2 builds left a plaintext Shamir share under this key (v2 F2).
const LEGACY_DEVICE_SHARD_KEY = "keeplas_device_shard";

// Minimal in-memory localStorage stub. We only exercise the legacy-shard
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

  it("removes a legacy plaintext device shard from localStorage", async () => {
    const map = installLocalStorageStub();
    map.set(LEGACY_DEVICE_SHARD_KEY, "some-plaintext-shard");

    await clearPersistedMasterKeys();

    expect(localStorage.getItem(LEGACY_DEVICE_SHARD_KEY)).toBeNull();
  });
});

describe("isPersistedKeyExpired", () => {
  const NOW = 10 * AUTO_LOCK_TIMEOUT_MS;

  it("drops a copy left idle for the auto-lock window (browser closed)", () => {
    expect(
      isPersistedKeyExpired({ lastActiveAt: NOW - AUTO_LOCK_TIMEOUT_MS }, NOW),
    ).toBe(true);
  });

  it("keeps a copy used within the auto-lock window", () => {
    expect(
      isPersistedKeyExpired(
        { lastActiveAt: NOW - AUTO_LOCK_TIMEOUT_MS + 1 },
        NOW,
      ),
    ).toBe(false);
  });

  it("drops a copy past the link's lifetime, even if active", () => {
    expect(
      isPersistedKeyExpired({ expiresAt: NOW, lastActiveAt: NOW }, NOW),
    ).toBe(true);
  });

  it("keeps a copy saved before activity tracking", () => {
    expect(isPersistedKeyExpired({}, NOW)).toBe(false);
  });
});
