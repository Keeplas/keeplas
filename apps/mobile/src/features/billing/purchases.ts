import Purchases, {
  PURCHASES_ERROR_CODE,
  type PurchasesError,
} from "react-native-purchases";
import { LIFETIME_ENTITLEMENT_ID } from "@keeplas/backend/lib/plans";

import { env } from "@/lib/env";

/**
 * Point the RevenueCat SDK at the signed-in account. The app user id IS the
 * Convex user id: the `/webhooks/revenuecat` handler reads it back to know
 * whose plan to flip, so a purchase is never made anonymously.
 */
async function identify(userId: string) {
  if (!(await Purchases.isConfigured())) {
    if (!env.revenueCatApiKey) {
      throw new Error("EXPO_PUBLIC_REVENUECAT_*_API_KEY is not set");
    }
    Purchases.configure({ apiKey: env.revenueCatApiKey, appUserID: userId });
  } else if ((await Purchases.getAppUserID()) !== userId) {
    await Purchases.logIn(userId);
  }
}

/** The Lifetime package of the current offering, or null if none is set up. */
async function lifetimePackage(userId: string) {
  await identify(userId);
  const offerings = await Purchases.getOfferings();
  return offerings.current?.lifetime ?? null;
}

/**
 * Store-localized Lifetime price (e.g. "$99.00", "99,00 €"), shown on the
 * upgrade card. Null when the store has no Lifetime product for this device.
 */
export async function getLifetimePrice(userId: string): Promise<string | null> {
  return (await lifetimePackage(userId))?.product.priceString ?? null;
}

/**
 * Show the store sheet for the Lifetime package of the current offering.
 * Resolves `false` when the user cancels; throws on any other failure. A store
 * account that already owns Lifetime (Google reports it as an error) is
 * restored onto this account instead.
 */
export async function purchaseLifetime(userId: string): Promise<boolean> {
  const lifetime = await lifetimePackage(userId);
  if (!lifetime) {
    throw new Error("The current RevenueCat offering has no Lifetime package");
  }
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
