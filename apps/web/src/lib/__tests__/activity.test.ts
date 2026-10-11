import { describe, expect, it } from "vitest";
import {
  activityKey,
  activityTone,
  humanizeAction,
  isShownActivity,
} from "../activity";

describe("activity", () => {
  it.each([
    ["device.registered", "active"],
    ["life_check_user_confirmed", "active"],
    ["vault_item.updated", "pending"],
    ["recovery.request.started", "pending"],
    ["device.revoked", "danger"],
    ["device.not_me", "danger"],
  ] as const)("tones %s as %s", (action, tone) => {
    expect(activityTone(action)).toBe(tone);
  });

  it("hides background plumbing", () => {
    expect(isShownActivity("vault_item.meta_backfilled")).toBe(false);
    expect(isShownActivity("vault.upload_url.generated")).toBe(false);
    expect(isShownActivity("device.registered")).toBe(true);
  });

  it("builds keys and fallback labels", () => {
    expect(activityKey("device.not_me")).toBe("device_not_me");
    expect(humanizeAction("life_check_configured")).toBe(
      "Life check configured",
    );
  });
});
