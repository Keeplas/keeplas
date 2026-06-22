/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as access_requests from "../access_requests.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as crons from "../crons.js";
import type * as dispatch from "../dispatch.js";
import type * as email_auth from "../email_auth.js";
import type * as email_verification from "../email_verification.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as hub from "../hub.js";
import type * as lib_audit_secret from "../lib/audit_secret.js";
import type * as lib_contact_key from "../lib/contact_key.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_life_check_token from "../lib/life_check_token.js";
import type * as lib_locale from "../lib/locale.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_rate_limit from "../lib/rate_limit.js";
import type * as lib_require_env from "../lib/require_env.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_stripe_webhook from "../lib/stripe_webhook.js";
import type * as life_check from "../life_check.js";
import type * as login_otp from "../login_otp.js";
import type * as memorial from "../memorial.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as passwordReset from "../passwordReset.js";
import type * as phone_auth from "../phone_auth.js";
import type * as phone_verification from "../phone_verification.js";
import type * as push_subscriptions from "../push_subscriptions.js";
import type * as recipient_groups from "../recipient_groups.js";
import type * as release from "../release.js";
import type * as rotation from "../rotation.js";
import type * as shared_types from "../shared_types.js";
import type * as support from "../support.js";
import type * as testing from "../testing.js";
import type * as totp from "../totp.js";
import type * as trusted_contacts from "../trusted_contacts.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as vault_items from "../vault_items.js";
import type * as vaults from "../vaults.js";
import type * as webauthn from "../webauthn.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  access_requests: typeof access_requests;
  audit: typeof audit;
  auth: typeof auth;
  billing: typeof billing;
  crons: typeof crons;
  dispatch: typeof dispatch;
  email_auth: typeof email_auth;
  email_verification: typeof email_verification;
  helpers: typeof helpers;
  http: typeof http;
  hub: typeof hub;
  "lib/audit_secret": typeof lib_audit_secret;
  "lib/contact_key": typeof lib_contact_key;
  "lib/crypto": typeof lib_crypto;
  "lib/email": typeof lib_email;
  "lib/identity": typeof lib_identity;
  "lib/life_check_token": typeof lib_life_check_token;
  "lib/locale": typeof lib_locale;
  "lib/password": typeof lib_password;
  "lib/phone": typeof lib_phone;
  "lib/plans": typeof lib_plans;
  "lib/rate_limit": typeof lib_rate_limit;
  "lib/require_env": typeof lib_require_env;
  "lib/storage": typeof lib_storage;
  "lib/stripe_webhook": typeof lib_stripe_webhook;
  life_check: typeof life_check;
  login_otp: typeof login_otp;
  memorial: typeof memorial;
  migrations: typeof migrations;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  passwordReset: typeof passwordReset;
  phone_auth: typeof phone_auth;
  phone_verification: typeof phone_verification;
  push_subscriptions: typeof push_subscriptions;
  recipient_groups: typeof recipient_groups;
  release: typeof release;
  rotation: typeof rotation;
  shared_types: typeof shared_types;
  support: typeof support;
  testing: typeof testing;
  totp: typeof totp;
  trusted_contacts: typeof trusted_contacts;
  users: typeof users;
  validators: typeof validators;
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
