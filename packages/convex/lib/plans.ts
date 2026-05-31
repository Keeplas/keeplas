import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * The two billing tiers. Lifetime is a one-time purchase ($199) — there is no
 * recurring subscription. A user with no `plan` field is on `free`.
 */
export const planValidator = v.union(v.literal("free"), v.literal("lifetime"));

export type Plan = "free" | "lifetime";

/**
 * Encrypted-storage ceiling per plan, in bytes. Enforced server-side before
 * persisting `vault_item_files` rows (see vault_items.ts) and surfaced to the
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
