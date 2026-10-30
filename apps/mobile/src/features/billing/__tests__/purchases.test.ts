import Purchases, { PURCHASES_ERROR_CODE } from "react-native-purchases";

import { isLockHeld } from "@/lib/auto-lock";
import {
  StoreUnavailableError,
  describePurchaseError,
  getLifetimePrice,
  purchaseLifetime,
  restoreLifetime,
} from "../purchases";

jest.mock("@/lib/env", () => ({ env: { revenueCatApiKey: "appl_test" } }));

let mockConfigured = false;
// The real module pulls in the web SDK, which jest can't transform. Codes are
// the store's ("@revenuecat/purchases-typescript-internal" error-codes).
jest.mock("react-native-purchases", () => {
  return {
    __esModule: true,
    PURCHASES_ERROR_CODE: {
      STORE_PROBLEM_ERROR: "2",
      PURCHASE_NOT_ALLOWED_ERROR: "3",
      PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: "5",
      PRODUCT_ALREADY_PURCHASED_ERROR: "6",
      NETWORK_ERROR: "10",
      INVALID_CREDENTIALS_ERROR: "11",
      PAYMENT_PENDING_ERROR: "20",
      CONFIGURATION_ERROR: "23",
      PRODUCT_REQUEST_TIMED_OUT_ERROR: "32",
      OFFLINE_CONNECTION_ERROR: "35",
    },
    default: {
      isConfigured: jest.fn(async () => mockConfigured),
      configure: jest.fn(() => {
        mockConfigured = true;
      }),
      getAppUserID: jest.fn(async () => "user-1"),
      logIn: jest.fn(),
      getOfferings: jest.fn(),
      purchasePackage: jest.fn(),
      restorePurchases: jest.fn(),
    },
  };
});

const mocked = jest.mocked(Purchases);
const lifetime = { product: { priceString: "$99.00" } };

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getOfferings.mockResolvedValue({
    current: { lifetime },
  } as never);
});

describe("purchases", () => {
  it("configures the SDK once when several screens ask at the same time", async () => {
    await Promise.all([getLifetimePrice("user-1"), getLifetimePrice("user-1")]);
    expect(mocked.configure).toHaveBeenCalledTimes(1);
  });

  it("reports a missing Lifetime package as unavailable, not a crash", async () => {
    mocked.getOfferings.mockResolvedValue({ current: null } as never);
    const error = await purchaseLifetime("user-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StoreUnavailableError);
    expect(describePurchaseError(error)).toEqual({ kind: "unavailable" });
    expect(mocked.purchasePackage).not.toHaveBeenCalled();
  });

  it("keeps the vault unlocked while the store sheet is open", async () => {
    // Paying can take minutes (sandbox sign-in, Face ID); an auto-lock on
    // return would drop the purchase confirmation.
    let heldWhilePaying = false;
    mocked.purchasePackage.mockImplementation(async () => {
      heldWhilePaying = isLockHeld();
      return {} as never;
    });
    let heldWhileRestoring = false;
    mocked.restorePurchases.mockImplementation(async () => {
      heldWhileRestoring = isLockHeld();
      return { entitlements: { active: {} } } as never;
    });

    await purchaseLifetime("user-1");
    await restoreLifetime("user-1");

    expect(heldWhilePaying).toBe(true);
    expect(heldWhileRestoring).toBe(true);
    expect(isLockHeld()).toBe(false);
  });

  it("resolves false when the user cancels the store sheet", async () => {
    mocked.purchasePackage.mockRejectedValue({ userCancelled: true });
    await expect(purchaseLifetime("user-1")).resolves.toBe(false);
  });

  it("names the store failure and keeps its code", () => {
    const err = (code: PURCHASES_ERROR_CODE) => ({ code });
    expect(
      describePurchaseError(err(PURCHASES_ERROR_CODE.CONFIGURATION_ERROR)),
    ).toEqual({ kind: "unavailable", code: "23" });
    expect(
      describePurchaseError(err(PURCHASES_ERROR_CODE.NETWORK_ERROR)),
    ).toEqual({ kind: "network", code: "10" });
    expect(
      describePurchaseError(
        err(PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR),
      ),
    ).toEqual({ kind: "notAllowed", code: "3" });
    expect(
      describePurchaseError(err(PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR)),
    ).toEqual({ kind: "pending", code: "20" });
    expect(
      describePurchaseError(err(PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR)),
    ).toEqual({ kind: "failed", code: "2" });
    expect(describePurchaseError(new Error("boom"))).toEqual({
      kind: "failed",
    });
  });
});
