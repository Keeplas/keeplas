import {
  greetingKey,
  groupCategoryCounts,
  groupOf,
} from "@/features/home/vault-groups";
import { BACKGROUND_GRACE_MS, shouldLockOnResume } from "../auto-lock";
import { classifyCodeError } from "../errors";
import { formatBytes } from "../format";
import {
  examplePlaceholder,
  flagEmoji,
  formatPhone,
  isTooLong,
  toE164,
} from "../phone";
import { resolveStage, type StageInputs } from "../session-stage";

const base: StageInputs = {
  authLoading: false,
  authenticated: true,
  viewer: { hasKeyBundle: true },
  loginOtpRequired: false,
  needsMigration: false,
  migrationDeferred: false,
  hasDeviceVault: true,
  unlocked: true,
};

describe("resolveStage", () => {
  it.each<[Partial<StageInputs>, string]>([
    [{ authLoading: true }, "loading"],
    [{ authenticated: false }, "signedOut"],
    [{ viewer: null }, "signedOut"],
    [{ viewer: undefined }, "loading"],
    [{ loginOtpRequired: true }, "loginOtp"],
    [{ viewer: { hasKeyBundle: false } }, "setup"],
    [{ unlocked: false, hasDeviceVault: true }, "locked"],
    [{ unlocked: false, hasDeviceVault: false }, "needsKit"],
    [{ unlocked: false, hasDeviceVault: undefined }, "loading"],
    [{ needsMigration: true }, "migration"],
    [{ needsMigration: true, migrationDeferred: true }, "ready"],
    [{}, "ready"],
  ])("%j → %s", (overrides, stage) => {
    expect(resolveStage({ ...base, ...overrides })).toBe(stage);
  });

  it("asks for the login OTP before anything that needs full auth", () => {
    expect(
      resolveStage({ ...base, loginOtpRequired: true, unlocked: false }),
    ).toBe("loginOtp");
  });
});

describe("auto-lock", () => {
  it("locks only after the background grace period", () => {
    expect(shouldLockOnResume(null, 10)).toBe(false);
    expect(shouldLockOnResume(0, BACKGROUND_GRACE_MS)).toBe(false);
    expect(shouldLockOnResume(0, BACKGROUND_GRACE_MS + 1)).toBe(true);
  });
});

describe("code errors", () => {
  it("classifies provider messages and treats redacted ones as a wrong code", () => {
    expect(
      classifyCodeError(new Error("Too many attempts. Request a new code.")),
    ).toBe("tooMany");
    expect(classifyCodeError(new Error("Code expired or not requested"))).toBe(
      "expired",
    );
    expect(classifyCodeError(new Error("Invalid code"))).toBe("wrong");
    expect(classifyCodeError(new Error("[Request ID: x] Server Error"))).toBe(
      "wrong",
    );
  });
});

describe("formatters", () => {
  it("formats storage in decimal units", () => {
    expect(formatBytes(62_000_000)).toBe("62 MB");
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(10_000_000_000)).toBe("10 GB");
  });

  it("validates and formats phone numbers", () => {
    expect(toE164("CA", "416 555 0123")).toBe("+14165550123");
    expect(toE164("CA", "123")).toBeNull();
    expect(formatPhone("+14165550123")).toBe("+1 416 555 0123");
    expect(flagEmoji("FR")).toBe("🇫🇷");
  });

  it("drops the national trunk prefix from the placeholder", () => {
    expect(examplePlaceholder("CD")).toBe("991 234 567");
    expect(examplePlaceholder("FR")).toBe("6 12 34 56 78");
  });

  it("flags numbers longer than the country allows", () => {
    expect(isTooLong("CD", "991 234 567")).toBe(false);
    expect(isTooLong("CD", "0991 234 567")).toBe(false);
    expect(isTooLong("CD", "991 234 56789")).toBe(true);
    expect(isTooLong("CD", "")).toBe(false);
  });
});

describe("home groups", () => {
  it("sums categories into the four tiles, unknown ones into Other", () => {
    expect(
      groupCategoryCounts({
        legal_document: 2,
        credential: 3,
        wishes: 1,
        other: 1,
        mystery: 4,
      }),
    ).toEqual({ documents: 2, accounts: 3, instructions: 1, other: 5 });
  });

  it("leaves the encrypted inbox out of the tiles", () => {
    expect(groupCategoryCounts({ inbox: 3, property: 1 })).toEqual({
      documents: 1,
      accounts: 0,
      instructions: 0,
      other: 0,
    });
  });

  it("maps a category to its tile", () => {
    expect(groupOf("insurance_policy")).toBe("documents");
    expect(groupOf("subscription")).toBe("accounts");
    expect(groupOf("mystery")).toBe("other");
    expect(groupOf("inbox")).toBeNull();
  });

  it("greets by time of day", () => {
    expect(greetingKey(8)).toBe("home.greetingMorning");
    expect(greetingKey(14)).toBe("home.greetingAfternoon");
    expect(greetingKey(20)).toBe("home.greetingEvening");
  });
});
