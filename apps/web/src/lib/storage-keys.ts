export const STORAGE_KEYS = {
  currency: "keeplas.currency",
  notifications: "keeplas.notifications",
  security: "keeplas.security",
  deviceShard: "keeplas_device_shard",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
