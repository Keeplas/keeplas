import Purchases, {
  PURCHASES_ERROR_CODE,
  type PurchasesError,
} from "react-native-purchases";
import { LIFETIME_ENTITLEMENT_ID } from "@keeplas/backend/lib/plans";

import { env } from "@/lib/env";

/** The store has no Lifetime product for this build (key, offering, product). */
export class StoreUnavailableError extends Error {}

let configuring: Promise<void> | null = null;

/**
 * Point the RevenueCat SDK at the signed-in account. The app user id IS the
 * Convex user id: the `/webhooks/revenuecat` handler reads it back to know
 * whose plan to flip, so a purchase is never made anonymously. Configured
 * once even when several screens ask at the same time (Home and Settings both
 * mount the upgrade card).
 */
async function identify(userId: string) {
  configuring ??= (async () => {
    if (await Purchases.isConfigured()) return;
    if (!env.revenueCatApiKey) {
      throw new StoreUnavailableError(
        "EXPO_PUBLIC_REVENUECAT_*_API_KEY is not set",
      );
    }
    Purchases.configure({ apiKey: env.revenueCatApiKey, appUserID: userId });
  })().catch((error: unknown) => {
    configuring = null;
    throw error;
  });
  await configuring;
  if ((await Purchases.getAppUserID()) !== userId) {
    await Purchases.logIn(userId);
  }
}

/** The Lifetime package of the current offering. */
async function lifetimePackage(userId: string) {
  await identify(userId);
  const offerings = await Purchases.getOfferings();
  const lifetime = offerings.current?.lifetime;
  if (!lifetime) {
    throw new StoreUnavailableError(
      "The current RevenueCat offering has no Lifetime package",
    );
  }
  return lifetime;
}

/** Store-localized Lifetime price (e.g. "$99.00", "99,00 €"). */
export async function getLifetimePrice(userId: string): Promise<string> {
  return (await lifetimePackage(userId)).product.priceString;
}

/**
 * Show the store sheet for the Lifetime package of the current offering.
 * Resolves `false` when the user cancels; throws on any other failure. A store
 * account that already owns Lifetime (Google reports it as an error) is
 * restored onto this account instead.
 */
export async function purchaseLifetime(userId: string): Promise<boolean> {
  const lifetime = await lifetimePackage(userId);
  try {
    await Purchases.purchasePackage(lifetime);
    return true;
  } catch (error) {
    const { userCancelled, code } = error as PurchasesError;
    if (userCancelled) return false;
    if (code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
      return restoreLifetime(userId);
    }
    throw error;
  }
}

/**
 * Re-sync the store's purchases onto this account (required by App Review for
 * a non-consumable). Resolves whether the Lifetime entitlement is now active.
 */
export async function restoreLifetime(userId: string): Promise<boolean> {
  await identify(userId);
  const info = await Purchases.restorePurchases();
  return LIFETIME_ENTITLEMENT_ID in info.entitlements.active;
}

export type PurchaseErrorKind =
  "unavailable" | "network" | "notAllowed" | "pending" | "failed";

const UNAVAILABLE = new Set<string>([
  PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
  PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR,
  PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR,
  PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR,
]);
const NETWORK = new Set<string>([
  PURCHASES_ERROR_CODE.NETWORK_ERROR,
  PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR,
]);

/**
 * Why a purchase or restore failed, for the message shown to the user, and
 * the store error code (shown with it, so a support request names the cause).
 */
export function describePurchaseError(error: unknown): {
  kind: PurchaseErrorKind;
  code?: string;
} {
  if (error instanceof StoreUnavailableError) return { kind: "unavailable" };
  const code = (error as Partial<PurchasesError> | null)?.code;
  if (code === undefined) return { kind: "failed" };
  if (UNAVAILABLE.has(code)) return { kind: "unavailable", code };
  if (NETWORK.has(code)) return { kind: "network", code };
  if (code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
    return { kind: "notAllowed", code };
  }
  if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return { kind: "pending", code };
  }
  return { kind: "failed", code };
}
