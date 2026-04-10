import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("personal_document"),
  v.literal("financial_asset"),
  v.literal("digital_asset"),
  v.literal("health_directive"),
  v.literal("legal_document"),
  v.literal("business_continuity"),
  v.literal("conditional_message"),
  v.literal("personal_message"),
  v.literal("credential")
);

export const accessLevelValidator = v.union(
  v.literal("private"),
  v.literal("trusted_only"),
  v.literal("emergency_only"),
  v.literal("public")
);
