import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("personal_document"),
  v.literal("financial_asset"),
  v.literal("digital_asset"),
  v.literal("health_directive"),
  v.literal("legal_document"),
  v.literal("business_continuity"),
  v.literal("conditional_message"),
  v.literal("credential"),
  v.literal("property"),
  v.literal("insurance_policy"),
  v.literal("subscription"),
  v.literal("contacts"),
  v.literal("wishes"),
  v.literal("other"),
);

// TEMPORARY: "public" and "emergency_only" are kept here only so the schema
// can accept legacy rows during the one-shot migrateAccessLevels run. Narrow
// back to ("private" | "trusted_only") once the migration has executed.
export const accessLevelValidator = v.union(
  v.literal("private"),
  v.literal("trusted_only"),
  v.literal("emergency_only"),
  v.literal("public"),
);
