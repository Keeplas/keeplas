/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access_requests from "../access_requests.js";
import type * as account_deletion from "../account_deletion.js";
import type * as account_migration from "../account_migration.js";
import type * as admin_access from "../admin/access.js";
import type * as admin_activity from "../admin/activity.js";
import type * as admin_analytics from "../admin/analytics.js";
import type * as admin_lib from "../admin/lib.js";
import type * as admin_recovery_requests from "../admin/recovery_requests.js";
import type * as admin_revenue from "../admin/revenue.js";
import type * as admin_security from "../admin/security.js";
import type * as admin_users from "../admin/users.js";
import type * as admin_vault from "../admin/vault.js";
import type * as analytics from "../analytics.js";
import type * as attestation from "../attestation.js";
import type * as attestation_node from "../attestation_node.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as capture_handoffs from "../capture_handoffs.js";
import type * as cloud_backup from "../cloud_backup.js";
import type * as crons from "../crons.js";
import type * as device_pins from "../device_pins.js";
import type * as devices from "../devices.js";
import type * as dispatch from "../dispatch.js";
import type * as email_auth from "../email_auth.js";
import type * as email_verification from "../email_verification.js";
import type * as folders from "../folders.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as hub from "../hub.js";
import type * as lib_audit_secret from "../lib/audit_secret.js";
import type * as lib_batch from "../lib/batch.js";
import type * as lib_capture_qr from "../lib/capture_qr.js";
import type * as lib_contact_key from "../lib/contact_key.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_life_check_token from "../lib/life_check_token.js";
import type * as lib_locale from "../lib/locale.js";
import type * as lib_otp from "../lib/otp.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_pause from "../lib/pause.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_rate_limit from "../lib/rate_limit.js";
import type * as lib_require_env from "../lib/require_env.js";
import type * as lib_sessions from "../lib/sessions.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_storage_usage from "../lib/storage_usage.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_vault_groups from "../lib/vault_groups.js";
import type * as lib_vault_proof from "../lib/vault_proof.js";
import type * as life_check from "../life_check.js";
import type * as login_otp from "../login_otp.js";
import type * as memorial from "../memorial.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as number_change from "../number_change.js";
import type * as onboarding from "../onboarding.js";
import type * as pairing from "../pairing.js";
import type * as passwordReset from "../passwordReset.js";
import type * as phone_auth from "../phone_auth.js";
import type * as phone_verification from "../phone_verification.js";
import type * as recipient_groups from "../recipient_groups.js";
import type * as recovery from "../recovery.js";
import type * as recovery_node from "../recovery_node.js";
import type * as release from "../release.js";
import type * as rotation from "../rotation.js";
import type * as session_proofs from "../session_proofs.js";
import type * as session_proofs_node from "../session_proofs_node.js";
import type * as shared_types from "../shared_types.js";
import type * as store_review from "../store_review.js";
import type * as support from "../support.js";
import type * as testing from "../testing.js";
import type * as totp from "../totp.js";
import type * as trusted_contacts from "../trusted_contacts.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as vault_categories from "../vault_categories.js";
import type * as vault_items from "../vault_items.js";
import type * as vaults from "../vaults.js";
import type * as webauthn from "../webauthn.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access_requests: typeof access_requests;
  account_deletion: typeof account_deletion;
  account_migration: typeof account_migration;
  "admin/access": typeof admin_access;
  "admin/activity": typeof admin_activity;
  "admin/analytics": typeof admin_analytics;
  "admin/lib": typeof admin_lib;
  "admin/recovery_requests": typeof admin_recovery_requests;
  "admin/revenue": typeof admin_revenue;
  "admin/security": typeof admin_security;
  "admin/users": typeof admin_users;
  "admin/vault": typeof admin_vault;
  analytics: typeof analytics;
  attestation: typeof attestation;
  attestation_node: typeof attestation_node;
  audit: typeof audit;
  auth: typeof auth;
  billing: typeof billing;
  capture_handoffs: typeof capture_handoffs;
  cloud_backup: typeof cloud_backup;
  crons: typeof crons;
  device_pins: typeof device_pins;
  devices: typeof devices;
  dispatch: typeof dispatch;
  email_auth: typeof email_auth;
  email_verification: typeof email_verification;
  folders: typeof folders;
  helpers: typeof helpers;
  http: typeof http;
  hub: typeof hub;
  "lib/audit_secret": typeof lib_audit_secret;
  "lib/batch": typeof lib_batch;
  "lib/capture_qr": typeof lib_capture_qr;
  "lib/contact_key": typeof lib_contact_key;
  "lib/crypto": typeof lib_crypto;
  "lib/email": typeof lib_email;
  "lib/identity": typeof lib_identity;
  "lib/life_check_token": typeof lib_life_check_token;
  "lib/locale": typeof lib_locale;
  "lib/otp": typeof lib_otp;
  "lib/password": typeof lib_password;
  "lib/pause": typeof lib_pause;
  "lib/phone": typeof lib_phone;
  "lib/plans": typeof lib_plans;
  "lib/rate_limit": typeof lib_rate_limit;
  "lib/require_env": typeof lib_require_env;
  "lib/sessions": typeof lib_sessions;
  "lib/storage": typeof lib_storage;
  "lib/storage_usage": typeof lib_storage_usage;
  "lib/text": typeof lib_text;
  "lib/vault_groups": typeof lib_vault_groups;
  "lib/vault_proof": typeof lib_vault_proof;
  life_check: typeof life_check;
  login_otp: typeof login_otp;
  memorial: typeof memorial;
  migrations: typeof migrations;
  notifications: typeof notifications;
  number_change: typeof number_change;
  onboarding: typeof onboarding;
  pairing: typeof pairing;
  passwordReset: typeof passwordReset;
  phone_auth: typeof phone_auth;
  phone_verification: typeof phone_verification;
  recipient_groups: typeof recipient_groups;
  recovery: typeof recovery;
  recovery_node: typeof recovery_node;
  release: typeof release;
  rotation: typeof rotation;
  session_proofs: typeof session_proofs;
  session_proofs_node: typeof session_proofs_node;
  shared_types: typeof shared_types;
  store_review: typeof store_review;
  support: typeof support;
  testing: typeof testing;
  totp: typeof totp;
  trusted_contacts: typeof trusted_contacts;
  users: typeof users;
  validators: typeof validators;
  vault_categories: typeof vault_categories;
  vault_items: typeof vault_items;
  vaults: typeof vaults;
  webauthn: typeof webauthn;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
