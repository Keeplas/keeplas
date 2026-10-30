import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * The two billing tiers. Lifetime is a one-time in-app purchase ($99) — there is
 * no recurring subscription. A user with no `plan` field is on `free`.
 */
export const planValidator = v.union(v.literal("free"), v.literal("lifetime"));

export type Plan = "free" | "lifetime";

/**
 * RevenueCat entitlement unlocked by the in-app Lifetime purchase. Must match
 * the entitlement identifier configured in the RevenueCat dashboard; read by
 * the mobile paywall and the `/webhooks/revenuecat` handler.
 */
export const LIFETIME_ENTITLEMENT_ID = "lifetime";

/**
 * Encrypted-storage ceiling per plan, in bytes: everything the owner stores
 * (items, history, recipient keys, files — lib/storage_usage.ts). Enforced
 * server-side on the writes that grow it (vault_items.ts) and surfaced to the
 * Usage page via `getUsageStats`.
 *   Free     = 100 MB
 *   Lifetime = 10 GB
 */
export const PLAN_QUOTA_BYTES: Record<Plan, number> = {
  free: 100 * 1024 * 1024,
  lifetime: 10 * 1024 * 1024 * 1024,
};

/** Resolve a user's plan, defaulting to `free` when the field is unset. */
export function getUserPlan(user: Pick<Doc<"users">, "plan">): Plan {
  return user.plan ?? "free";
}
