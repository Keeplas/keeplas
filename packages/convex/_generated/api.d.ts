/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as convex__generated_api from "../convex/_generated/api.js";
import type * as convex__generated_server from "../convex/_generated/server.js";
import type * as dashboard from "../dashboard.js";
import type * as emergency_cards from "../emergency_cards.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as onboarding from "../onboarding.js";
import type * as shared_types from "../shared_types.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as vault_items from "../vault_items.js";
import type * as vaults from "../vaults.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auth: typeof auth;
  "convex/_generated/api": typeof convex__generated_api;
  "convex/_generated/server": typeof convex__generated_server;
  dashboard: typeof dashboard;
  emergency_cards: typeof emergency_cards;
  helpers: typeof helpers;
  http: typeof http;
  onboarding: typeof onboarding;
  shared_types: typeof shared_types;
  users: typeof users;
  validators: typeof validators;
  vault_items: typeof vault_items;
  vaults: typeof vaults;
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
