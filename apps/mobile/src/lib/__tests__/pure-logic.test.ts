import type { VaultCategory } from "@/crypto/item-meta";
import {
  bucketOf,
  builtInCategory,
  shownFiling,
  contentKind,
  greetingKey,
  groupOf,
  inVaultList,
  isVaultListKey,
  listCounts,
  presetCategory,
  recentItems,
  type ContentKind,
  type VaultListKey,
} from "@/features/home/vault-groups";
import { GROUP_CATEGORIES } from "@keeplas/backend/lib/vault_groups";
import {
  BACKGROUND_GRACE_MS,
  HELD_GRACE_MS,
  holdLock,
  IDLE_LOCK_MS,
  idleExpired,
  isLockHeld,
  keepUnlockedWhile,
  shouldLockOnResume,
} from "../auto-lock";
import { ConvexError } from "convex/values";

import {
  classifyCodeError,
  isAttestationRejection,
  isPasskeyUnavailable,
  passkeyFailure,
} from "../errors";
import { formatBytes, relativeDay } from "../format";
import {
  examplePlaceholder,
  flagEmoji,
  formatPhone,
  isTooLong,
  listCountries,
  searchCountries,
  toE164,
} from "../phone";
import { resolveStage, type StageInputs } from "../session-stage";

const base: StageInputs = {
  authLoading: false,
  authenticated: true,
  viewer: { hasKeyBundle: true },
  loginOtpRequired: false,
  totpRequired: false,
  newNumberPending: false,
  needsMigration: false,
  migrationDeferred: false,
  hasDeviceVault: true,
  unlocked: true,
  signingOut: false,
};

describe("resolveStage", () => {
  it.each<[Partial<StageInputs>, string]>([
    [{ authLoading: true }, "loading"],
    [{ authenticated: false }, "signedOut"],
    [{ viewer: null }, "signedOut"],
    [{ viewer: undefined }, "loading"],
    [{ loginOtpRequired: true }, "loginOtp"],
    [{ totpRequired: true }, "totp"],
    [{ totpRequired: undefined }, "loading"],
    [{ newNumberPending: true }, "newNumber"],
    [{ newNumberPending: undefined }, "loading"],
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

  it("leaves at once on sign-out, before the server confirms it", () => {
    expect(resolveStage({ ...base, signingOut: true, unlocked: false })).toBe(
      "signedOut",
    );
    expect(resolveStage({ ...base, signingOut: true, authLoading: true })).toBe(
      "signedOut",
    );
  });

  it("asks for the login OTP before anything that needs full auth", () => {
    expect(
      resolveStage({ ...base, loginOtpRequired: true, unlocked: false }),
    ).toBe("loginOtp");
  });

  it("asks for the authenticator code after the login OTP, before anything that needs full auth", () => {
    expect(
      resolveStage({ ...base, loginOtpRequired: true, totpRequired: true }),
    ).toBe("loginOtp");
    expect(
      resolveStage({
        ...base,
        totpRequired: true,
        needsMigration: true,
        unlocked: false,
      }),
    ).toBe("totp");
  });
});

describe("resolveStage after a lost number", () => {
  it("sets the new number after the step-up codes, before the vault opens", () => {
    expect(
      resolveStage({ ...base, totpRequired: true, newNumberPending: true }),
    ).toBe("totp");
    expect(
      resolveStage({
        ...base,
        newNumberPending: true,
        unlocked: false,
        hasDeviceVault: false,
      }),
    ).toBe("newNumber");
  });

  it("goes on to the recovery kit once the new number is proven", () => {
    expect(
      resolveStage({
        ...base,
        newNumberPending: false,
        unlocked: false,
        hasDeviceVault: false,
      }),
    ).toBe("needsKit");
  });
});

describe("auto-lock", () => {
  // Both clocks advance together unless a test says otherwise.
  const at = (ms: number) => ({ wall: ms, uptime: ms });

  it("locks only after the background grace period", () => {
    expect(shouldLockOnResume(null, at(10))).toBe(false);
    expect(shouldLockOnResume(at(0), at(BACKGROUND_GRACE_MS))).toBe(false);
    expect(shouldLockOnResume(at(0), at(BACKGROUND_GRACE_MS + 1))).toBe(true);
  });

  it("waits up to ten minutes while the app has a system screen open", () => {
    expect(shouldLockOnResume(at(0), at(BACKGROUND_GRACE_MS + 1), true)).toBe(
      false,
    );
    expect(shouldLockOnResume(at(0), at(HELD_GRACE_MS), true)).toBe(false);
    expect(shouldLockOnResume(at(0), at(HELD_GRACE_MS + 1), true)).toBe(true);
  });

  it("still locks when the phone's clock is turned back in the background", () => {
    const away = { wall: 1_000_000, uptime: 0 };
    const back = { wall: 0, uptime: BACKGROUND_GRACE_MS + 1 };
    expect(shouldLockOnResume(away, back)).toBe(true);
  });

  it("counts the time the phone slept, which the uptime clock skips", () => {
    const away = { wall: 0, uptime: 0 };
    const woke = { wall: BACKGROUND_GRACE_MS + 1, uptime: 5 };
    expect(shouldLockOnResume(away, woke)).toBe(true);
  });

  it("holds the lock only while a task runs", async () => {
    let during = false;
    await keepUnlockedWhile(async () => {
      during = isLockHeld();
    });
    expect(during).toBe(true);
    expect(isLockHeld()).toBe(false);
    await expect(
      keepUnlockedWhile(async () => {
        throw new Error("cancelled");
      }),
    ).rejects.toThrow("cancelled");
    expect(isLockHeld()).toBe(false);
    const release = holdLock();
    release();
    release();
    expect(isLockHeld()).toBe(false);
  });

  it("stops honouring a hold whose system screen never came back", () => {
    const release = holdLock();
    const later = (ms: number) => ({
      wall: Date.now() + ms,
      uptime: performance.now() + ms,
    });
    expect(isLockHeld(later(HELD_GRACE_MS - 1000))).toBe(true);
    expect(isLockHeld(later(HELD_GRACE_MS + 1000))).toBe(false);
    release();
  });

  it("locks on resume after five idle minutes, even without a background event", () => {
    expect(idleExpired(at(0), at(IDLE_LOCK_MS))).toBe(false);
    expect(idleExpired(at(0), at(IDLE_LOCK_MS + 1))).toBe(true);
    expect(
      idleExpired(
        { wall: 0, uptime: 0 },
        { wall: IDLE_LOCK_MS + 1, uptime: 5 },
      ),
    ).toBe(true);
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

describe("passkey errors", () => {
  it("treats a closed prompt as a cancel, with nothing to report", () => {
    expect(
      passkeyFailure({
        error: "UserCancelled",
        message: "The user cancelled the request.",
      }),
    ).toBeNull();
  });

  it("keeps the native code and message of a real failure", () => {
    expect(
      passkeyFailure({
        error: "RequestFailed",
        message:
          "Application with identifier T.com.keeplas.app is not associated with domain app.keeplas.com",
      }),
    ).toBe(
      "RequestFailed: Application with identifier T.com.keeplas.app is not associated with domain app.keeplas.com",
    );
  });

  it("reports server errors as a failure", () => {
    expect(
      passkeyFailure(new Error("Passkey registration failed verification")),
    ).toBe("Passkey registration failed verification");
  });

  it("spots a phone with no passkey provider turned on", () => {
    // Android: no Google account / Password Manager; either OS: unsupported.
    expect(
      isPasskeyUnavailable({ error: "NoCreateOption", message: "x" }),
    ).toBe(true);
    expect(isPasskeyUnavailable({ error: "NotSupported", message: "x" })).toBe(
      true,
    );
    // iOS 26: iCloud Keychain off (ASAuthorizationError 1010), any language.
    for (const message of [
      "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1010.)",
      "L’opération n’a pas pu s’achever. (com.apple.AuthenticationServices.AuthorizationError erreur 1010.)",
    ]) {
      expect(isPasskeyUnavailable({ error: "Unknown error", message })).toBe(
        true,
      );
    }
    expect(
      isPasskeyUnavailable({
        error: "RequestFailed",
        message: "not associated",
      }),
    ).toBe(false);
    expect(isPasskeyUnavailable({ error: "UserCancelled", message: "" })).toBe(
      false,
    );
    expect(isPasskeyUnavailable(new Error("NotSupported"))).toBe(false);
  });
});

describe("attestation errors", () => {
  it("treats the server verdict and a phone that can't attest as a rejection", () => {
    expect(
      isAttestationRejection(
        new ConvexError("Attestation rejected: device integrity"),
      ),
    ).toBe(true);
    const unsupported = Object.assign(new Error("Not supported"), {
      code: "ERR_APP_INTEGRITY_FEATURE_UNSUPPORTED",
    });
    expect(isAttestationRejection(unsupported)).toBe(true);
    const noPlayStore = Object.assign(new Error("No Play Store"), {
      code: "ERR_APP_INTEGRITY_PLAY_STORE_NOT_FOUND",
    });
    expect(isAttestationRejection(noPlayStore)).toBe(true);
  });

  it("lets network and server hiccups be tried again", () => {
    const offline = Object.assign(new Error("Network error"), {
      code: "ERR_APP_INTEGRITY_NETWORK_ERROR",
    });
    expect(isAttestationRejection(offline)).toBe(false);
    const appleBusy = Object.assign(new Error("Server unavailable"), {
      code: "ERR_APP_INTEGRITY_SERVER_UNAVAILABLE",
    });
    expect(isAttestationRejection(appleBusy)).toBe(false);
    // Redacted plain Error (e.g. "Google token exchange failed") on prod.
    expect(
      isAttestationRejection(
        new Error("[CONVEX A(attestation_node:verify)] Server Error"),
      ),
    ).toBe(false);
    expect(
      isAttestationRejection(new ConvexError("Invalid or expired challenge")),
    ).toBe(false);
  });
});

describe("formatters", () => {
  it("formats storage in binary units, like the plan quotas", () => {
    const MB = 1024 * 1024;
    const GB = 1024 * MB;
    expect(formatBytes(100 * MB)).toBe("100\u00a0MB");
    expect(formatBytes(10 * GB)).toBe("10\u00a0GB");
    expect(formatBytes(62 * MB)).toBe("62\u00a0MB");
    expect(formatBytes(512)).toBe("1\u00a0KB");
    expect(formatBytes(62 * MB, "fr")).toBe("62\u00a0Mo");
    expect(formatBytes(1.5 * GB, "fr")).toBe("1,5\u00a0Go");
    expect(formatBytes(1.5 * GB, "en")).toBe("1.5\u00a0GB");
  });

  it("validates and formats phone numbers", () => {
    expect(toE164("CA", "416 555 0123")).toBe("+14165550123");
    expect(toE164("CA", "123")).toBeNull();
    // Ofcom drama range: never assigned, used for the UK review accounts.
    expect(toE164("GB", "07700 900842")).toBe("+447700900842");
    expect(toE164("GB", "7700 9001")).toBeNull();
    expect(formatPhone("+14165550123")).toBe("+1 416 555 0123");
    expect(flagEmoji("FR")).toBe("🇫🇷");
  });

  it("finds a country by name, dial code, ISO code or common alias", () => {
    const countries = listCountries("en");
    const search = (query: string) =>
      searchCountries(countries, query).map((country) => country.code);
    // "uk" also matches Ukraine by name: the United Kingdom comes first.
    expect(search("uk")[0]).toBe("GB");
    expect(search("UK ")).toContain("UA");
    expect(search("gb")).toEqual(["GB"]);
    expect(search("united king")).toEqual(["GB"]);
    expect(search("+44")).toContain("GB");
    expect(search("44")).toContain("GB");
    expect(search("us")[0]).toBe("US");
    expect(search("")).toHaveLength(countries.length);
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

  it("puts each item in one list: inbox, its category group or its type", () => {
    expect(bucketOf(item("inbox", "photos"))).toBe("inbox");
    expect(bucketOf(item("credential", "documents"))).toBe("accounts");
    expect(bucketOf(item("wishes", "voice"))).toBe("instructions");
    expect(bucketOf(item("legal_document", "documents"))).toBe("documents");
    expect(bucketOf(item("property", "photos"))).toBe("documents");
    expect(bucketOf(item("mystery", "notes"))).toBe("notes");
  });

  it("lists every built-in category under its own tile, whatever it holds", () => {
    const kinds: ContentKind[] = [
      "documents",
      "notes",
      "photos",
      "voice",
      "videos",
    ];
    for (const [group, categories] of Object.entries(GROUP_CATEGORIES)) {
      for (const category of categories) {
        for (const kind of kinds) {
          const filed = item(category, kind);
          expect(groupOf(category)).toBe(group);
          expect(inVaultList(filed, group as VaultListKey)).toBe(true);
          expect(listCounts([filed])[group as VaultListKey]).toBe(1);
        }
      }
    }
  });

  it("keeps the inbox, user-made and hidden categories in their own place", () => {
    expect(inVaultList(item("inbox", "photos"), "inbox")).toBe(true);
    const custom = { ...item("other", "notes"), categoryId: "c1" };
    expect(inVaultList(custom, "other")).toBe(false);
    expect(inVaultList(custom, "documents")).toBe(false);
    const hidden = shownFiling(item("credential", "notes"), ["accounts"], []);
    expect(inVaultList(hidden, "inbox")).toBe(true);
    expect(inVaultList(hidden, "accounts")).toBe(false);
  });

  it("shows a note or photo filed in Documents on the Documents tile", () => {
    const note = item("personal_document", "notes");
    expect(inVaultList(note, "documents")).toBe(true);
    expect(inVaultList(note, "notes")).toBe(false);
    expect(
      listCounts([note, item("insurance_policy", "photos")]).documents,
    ).toBe(2);
  });

  it("names a web-only category after the built-in one of its group", () => {
    expect(builtInCategory("legal_document")).toBe("personal_document");
    expect(builtInCategory("insurance_policy")).toBe("personal_document");
    expect(builtInCategory("subscription")).toBe("credential");
    expect(builtInCategory("health_directive")).toBe("wishes");
    expect(builtInCategory("contacts")).toBe("other");
    expect(builtInCategory("mystery")).toBe("other");
    expect(builtInCategory("inbox")).toBe("inbox");
    expect(builtInCategory("credential")).toBe("credential");
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

  it("lists an item of a custom category by its type only", () => {
    const custom = { ...item("inbox", "voice"), categoryId: "c1" };
    expect(bucketOf(custom)).toBe("voice");
    expect(inVaultList({ ...item("other"), categoryId: "c1" }, "other")).toBe(
      false,
    );
    expect(listCounts([custom])).toMatchObject({ all: 1, voice: 1, inbox: 0 });
  });

  it("shows items of a deleted category in the inbox", () => {
    const filed = (category: string, categoryId?: string) => ({
      category,
      categoryId,
    });
    expect(shownFiling(filed("credential"), ["accounts"], [])).toEqual(
      filed("inbox"),
    );
    expect(shownFiling(filed("wishes"), ["accounts"], [])).toEqual(
      filed("wishes"),
    );
    expect(shownFiling(filed("other", "gone"), [], ["c1"])).toEqual(
      filed("inbox"),
    );
    expect(shownFiling(filed("other", "c1"), ["other"], ["c1"])).toEqual(
      filed("other", "c1"),
    );
    // Categories not loaded yet: keep the item where it is.
    expect(shownFiling(filed("other", "c1"), [], undefined)).toEqual(
      filed("other", "c1"),
    );
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
