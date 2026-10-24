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
    expect(keys(fr as Dict).filter((k) => !english.has(k))).toEqual([]);
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
