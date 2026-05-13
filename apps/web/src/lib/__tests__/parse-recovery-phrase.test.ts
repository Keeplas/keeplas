import { describe, it, expect } from "vitest";
import { parseRecoveryPhrase } from "../parse-recovery-phrase";

describe("parseRecoveryPhrase", () => {
  it("splits a clean space-separated phrase into lowercase tokens", () => {
    const out = parseRecoveryPhrase("abandon ability able about");
    expect(out).toEqual(["abandon", "ability", "able", "about"]);
  });

  it("lowercases mixed-case input", () => {
    expect(parseRecoveryPhrase("Abandon ABILITY Able")).toEqual([
      "abandon",
      "ability",
      "able",
    ]);
  });

  it("strips digits and punctuation from the PDF copy format", () => {
    const pdfPaste = "01. abandon  02. ability  03. able";
    expect(parseRecoveryPhrase(pdfPaste)).toEqual([
      "abandon",
      "ability",
      "able",
    ]);
  });

  it("collapses runs of whitespace", () => {
    expect(parseRecoveryPhrase("abandon   \t\n ability")).toEqual([
      "abandon",
      "ability",
    ]);
  });

  it("returns an empty array for input with no alpha tokens", () => {
    expect(parseRecoveryPhrase("   ")).toEqual([]);
    expect(parseRecoveryPhrase("01 02 03")).toEqual([]);
    expect(parseRecoveryPhrase("")).toEqual([]);
  });
});
