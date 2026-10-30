import en from "../en.json";
import fr from "../fr.json";
import {
  accountLanguageTag,
  deviceLanguage,
  resolveLanguage,
  translate,
} from "../translate";

type Dict = { [key: string]: string | Dict };

function keys(dict: Dict, prefix = ""): string[] {
  return Object.entries(dict).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe("translate", () => {
  it("returns English by default and interpolates params", () => {
    expect(translate("en", "verify.body", { phone: "+1 416 555 0123" })).toBe(
      "We sent a code to your WhatsApp number +1 416 555 0123.",
    );
  });

  it("uses French when the key exists", () => {
    expect(translate("fr", "welcome.getStarted")).toBe("Commencer");
  });

  it("falls back to English for a key missing in French (D12)", () => {
    expect(translate("fr", "settings.lifeCheck")).toBe("Life check");
  });

  it("keeps D6 labels: Contacts in French, Life check in English", () => {
    expect(translate("fr", "nav.people")).toBe("Contacts");
    expect(
      keys(fr as Dict).some((k) => translate("fr", k).includes("Personnes")),
    ).toBe(false);
  });

  it("shows the key itself when no language has it", () => {
    expect(translate("fr", "nope.missing")).toBe("nope.missing");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(translate("en", "steps.completed", { done: 1 })).toBe(
      "1/{total} completed",
    );
  });

  it("has no French key that English lacks", () => {
    const english = new Set(keys(en as Dict));
    // French says "0 élément": it may need a `_one` form English doesn't.
    const base = (k: string) => k.replace(/_one$/, "");
    expect(
      keys(fr as Dict).filter((k) => !english.has(k) && !english.has(base(k))),
    ).toEqual([]);
  });

  it("uses one French word for passkey: clé d'accès", () => {
    expect(
      keys(fr as Dict).filter((k) =>
        /passe-cl|passkey/i.test(translate("fr", k)),
      ),
    ).toEqual([]);
    expect(translate("fr", "recoveryKit.placeholder")).toBe("mot1 mot2 mot3 …");
  });

  it("names no platform brand in strings both platforms show (2.3.10)", () => {
    // Picked by Platform.OS / CloudKey.provider, so each OS shows only its own.
    const perPlatform = new Set([
      "recoveryKit.lastTimeIcloud",
      "recoveryKit.lastTimeGoogle",
      "upgrade.store.ios",
      "upgrade.store.android",
      "upgrade.account.ios",
      "upgrade.account.android",
      "backup.notEncrypted", // Android only: iCloud Keychain is always E2EE.
      "passkey.keychainOff", // iOS only (passkey-step.tsx)
      "passkey.passwordManagerOff", // Android only (passkey-step.tsx)
    ]);
    const brand =
      /iCloud|iPhone|Apple|Face ID|Screen Time|Temps d.écran|App Store|Google|Android/;
    for (const [language, dict] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      expect(
        keys(dict as Dict).filter(
          (k) => !perPlatform.has(k) && brand.test(translate(language, k)),
        ),
      ).toEqual([]);
    }
  });
});

describe("plurals", () => {
  it("uses the _one form for 1 in English", () => {
    expect(translate("en", "item.historyCount", { count: 1 })).toBe(
      "1 earlier version",
    );
    expect(translate("en", "item.historyCount", { count: 0 })).toBe(
      "0 earlier versions",
    );
    expect(translate("en", "item.historyCount", { count: 4 })).toBe(
      "4 earlier versions",
    );
    expect(translate("en", "codeErrors.wrongBody", { count: 1 })).toBe(
      "Check the 6 digits and try again. 1 try left.",
    );
  });

  it("uses the _one form for 0 and 1 in French", () => {
    expect(translate("fr", "categories.items", { count: 0 })).toBe("0 élément");
    expect(translate("fr", "categories.items", { count: 1 })).toBe("1 élément");
    expect(translate("fr", "categories.items", { count: 2 })).toBe(
      "2 éléments",
    );
  });

  it("falls back to the plain form when a language has no _one form", () => {
    // English has no singular here ("1 of 2 approvals received").
    expect(translate("en", "socialRecovery.approvals", { count: 1 })).toBe(
      "1 of 2 approvals received",
    );
    expect(translate("fr", "socialRecovery.approvals", { count: 1 })).toBe(
      "1 validation reçue sur 2",
    );
  });

  it("gives every _one form a plain form, and French every English _one", () => {
    for (const dict of [en, fr]) {
      const all = new Set(keys(dict as Dict));
      expect(
        [...all].filter(
          (k) => k.endsWith("_one") && !all.has(k.replace(/_one$/, "")),
        ),
      ).toEqual([]);
    }
    const french = new Set(keys(fr as Dict));
    expect(
      keys(en as Dict).filter((k) => k.endsWith("_one") && !french.has(k)),
    ).toEqual([]);
  });

  it("uses no (s) shortcut for plurals", () => {
    for (const [language, dict] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      expect(
        keys(dict as Dict).filter((k) =>
          /\w\((s|e|es)\)/.test(translate(language, k)),
        ),
      ).toEqual([]);
    }
  });
});

describe("language tags", () => {
  it("maps stored account tags to UI languages and back", () => {
    expect(resolveLanguage("fr-FR")).toBe("fr");
    expect(resolveLanguage("FR")).toBe("fr");
    expect(resolveLanguage("en-US")).toBe("en");
    expect(resolveLanguage(null)).toBe("en");
    expect(accountLanguageTag("fr")).toBe("fr-FR");
    expect(accountLanguageTag("en")).toBe("en-US");
  });
});

describe("deviceLanguage", () => {
  it("follows the phone language when it is supported", () => {
    expect(deviceLanguage(["fr-CA"])).toBe("fr");
    expect(deviceLanguage(["en-GB"])).toBe("en");
  });

  it("uses the first supported language in the phone's preference order", () => {
    expect(deviceLanguage(["de-DE", "fr-FR", "en-US"])).toBe("fr");
    expect(deviceLanguage(["en-US", "fr-FR"])).toBe("en");
  });

  it("falls back to English when no phone language is supported", () => {
    expect(deviceLanguage(["de-DE", "es-ES"])).toBe("en");
    expect(deviceLanguage([])).toBe("en");
  });
});
