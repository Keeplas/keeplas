export const STORAGE_KEYS = {
  currency: "keeplas.currency",
  notifications: "keeplas.notifications",
  security: "keeplas.security",
  deviceShard: "keeplas_device_shard",
  passiveSignalLastSentAt: "keeplas.passive_signal_last_sent_at",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
