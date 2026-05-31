export const STORAGE_KEYS = {
  currency: "keeplas.currency",
  notifications: "keeplas.notifications",
  security: "keeplas.security",
  // Slot-0 Shamir share of the master key (base64). KNOWN TRADEOFF: this is a
  // real share sitting in plaintext, readable by any XSS on the origin. We
  // accept it for now because:
  //   1. It is currently WRITE-ONLY — no code path reads it back, so it is not
  //      load-bearing for unlock or recovery (the per-device unlock wraps +
  //      persisted master key govern the "don't re-ask 24 words" UX, NOT this
  //      share; recovery reaches its threshold from the contacts' shares).
  //   2. Wrapping it would not help: the master key is itself persisted
  //      (extractable) in IndexedDB, so any at-rest wrap key is co-resident
  //      and an XSS attacker reaching one reaches both.
  //   3. The strict CSP (see lib/security-headers.ts) is the real mitigation.
  // Safe future hardening: stop persisting it entirely (no read path depends
  // on it). Left in place to avoid a behavior change in this pass.
  deviceShard: "keeplas_device_shard",
  passiveSignalLastSentAt: "keeplas.passive_signal_last_sent_at",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
