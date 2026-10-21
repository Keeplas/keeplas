import type { VaultCategory } from "@/crypto/item-meta";
import {
  bucketOf,
  contentKind,
  greetingKey,
  groupOf,
  inVaultList,
  isVaultListKey,
  listCounts,
  presetCategory,
  recentItems,
  type ContentKind,
} from "@/features/home/vault-groups";
import { BACKGROUND_GRACE_MS, shouldLockOnResume } from "../auto-lock";
import { classifyCodeError } from "../errors";
import { formatBytes, relativeDay } from "../format";
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
    expect(formatBytes(62_000_000)).toBe("62\u00a0MB");
    expect(formatBytes(500)).toBe("1\u00a0KB");
    expect(formatBytes(10_000_000_000)).toBe("10\u00a0GB");
    expect(formatBytes(62_000_000, "fr")).toBe("62\u00a0Mo");
    expect(formatBytes(1_500_000_000, "fr")).toBe("1,5\u00a0Go");
    expect(formatBytes(1_500_000_000, "en")).toBe("1.5\u00a0GB");
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

describe("relative day", () => {
  const now = new Date(2026, 9, 20, 18, 0).getTime();
  const at = (days: number) => now - days * 86_400_000;

  it("names recent days, then weeks, months and years", () => {
    expect(relativeDay(now - 3_600_000, now)).toEqual({ key: "today", n: 0 });
    expect(relativeDay(at(1), now)).toEqual({ key: "yesterday", n: 1 });
    expect(relativeDay(at(2), now)).toEqual({ key: "daysAgo", n: 2 });
    expect(relativeDay(at(7), now)).toEqual({ key: "weekAgo", n: 1 });
    expect(relativeDay(at(15), now)).toEqual({ key: "weeksAgo", n: 2 });
    expect(relativeDay(at(31), now)).toEqual({ key: "monthAgo", n: 1 });
    expect(relativeDay(at(200), now)).toEqual({ key: "monthsAgo", n: 6 });
    expect(relativeDay(at(400), now)).toEqual({ key: "yearAgo", n: 1 });
    expect(relativeDay(at(800), now)).toEqual({ key: "yearsAgo", n: 2 });
  });
});

describe("home groups", () => {
  const item = (category: string, kind: ContentKind = "notes") => ({
    category: category as VaultCategory,
    kind,
  });

  it("puts each item in one list: inbox, accounts, instructions or its type", () => {
    expect(bucketOf(item("inbox", "photos"))).toBe("inbox");
    expect(bucketOf(item("credential", "documents"))).toBe("accounts");
    expect(bucketOf(item("wishes", "voice"))).toBe("instructions");
    expect(bucketOf(item("legal_document", "documents"))).toBe("documents");
    expect(bucketOf(item("property", "photos"))).toBe("photos");
    expect(bucketOf(item("mystery", "notes"))).toBe("notes");
  });

  it("maps a category to its tile", () => {
    expect(groupOf("insurance_policy")).toBe("documents");
    expect(groupOf("subscription")).toBe("accounts");
    expect(groupOf("mystery")).toBe("other");
    expect(groupOf("inbox")).toBeNull();
  });

  it("filters a vault list, with Other as a category filter", () => {
    expect(inVaultList(item("legal_document", "documents"), "documents")).toBe(
      true,
    );
    expect(inVaultList(item("credential", "documents"), "documents")).toBe(
      false,
    );
    expect(inVaultList(item("contacts", "photos"), "other")).toBe(true);
    expect(inVaultList(item("contacts", "photos"), "photos")).toBe(true);
    expect(inVaultList(item("inbox", "voice"), "voice")).toBe(false);
    expect(inVaultList(item("inbox", "voice"), "all")).toBe(true);
  });

  it("counts every list for the chips and the Home tiles", () => {
    const counts = listCounts([
      item("legal_document", "documents"),
      item("credential"),
      item("contacts", "photos"),
      item("inbox", "voice"),
    ]);
    expect(counts).toMatchObject({
      all: 4,
      documents: 1,
      accounts: 1,
      photos: 1,
      other: 1,
      inbox: 1,
      voice: 0,
      notes: 0,
    });
  });

  it("accepts only known vault list keys from a route", () => {
    for (const key of ["documents", "notes", "voice", "other", "inbox", "all"])
      expect(isVaultListKey(key)).toBe(true);
    expect(isVaultListKey("passwords")).toBe(false);
  });

  it("types an item by its attachments", () => {
    expect(contentKind([])).toBe("notes");
    expect(contentKind([{ kind: "document" }])).toBe("documents");
    expect(contentKind([{ kind: "image" }])).toBe("photos");
    expect(contentKind([{ kind: "audio" }])).toBe("voice");
    expect(contentKind([{ kind: "video" }])).toBe("videos");
    expect(contentKind([{ kind: "image" }, { kind: "document" }])).toBe(
      "notes",
    );
  });

  it("presets the capture category from the list it was opened in", () => {
    expect(presetCategory("documents")).toBe("personal_document");
    expect(presetCategory("accounts")).toBe("credential");
    expect(presetCategory("instructions")).toBe("wishes");
    expect(presetCategory("other")).toBe("other");
    expect(presetCategory("inbox")).toBe("inbox");
    expect(presetCategory("all")).toBeUndefined();
    expect(presetCategory("photos")).toBeUndefined();
  });

  it("keeps only items updated in the last 30 days, newest first, at most 3", () => {
    const now = Date.UTC(2026, 9, 20);
    const day = 86_400_000;
    const at = (id: string, daysAgo: number) => ({
      id,
      updatedAt: now - daysAgo * day,
    });
    expect(
      recentItems(
        [at("old", 31), at("b", 2), at("a", 0), at("c", 5), at("d", 9)],
        now,
      ).map((item) => item.id),
    ).toEqual(["a", "b", "c"]);
    expect(recentItems([at("old", 40)], now)).toEqual([]);
  });

  it("greets by time of day", () => {
    expect(greetingKey(8)).toBe("home.greetingMorning");
    expect(greetingKey(14)).toBe("home.greetingAfternoon");
    expect(greetingKey(20)).toBe("home.greetingEvening");
  });
});
