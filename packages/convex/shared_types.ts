export type VaultCategory =
  | "personal_document"
  | "financial_asset"
  | "digital_asset"
  | "health_directive"
  | "legal_document"
  | "business_continuity"
  | "conditional_message"
  | "personal_message"
  | "credential";

export type AccessLevel =
  | "private"
  | "trusted_only"
  | "emergency_only"
  | "public";
