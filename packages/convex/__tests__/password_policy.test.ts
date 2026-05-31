import { describe, expect, it } from "vitest";
import { assertStrongPassword, isStrongPassword } from "../lib/password";

describe("password policy", () => {
  const strong = "Sup3r$ecret";

  it("accepts a password meeting all five rules", () => {
    expect(isStrongPassword(strong)).toBe(true);
    expect(() => assertStrongPassword(strong)).not.toThrow();
  });

  it.each([
    ["too short", "Aa1$bcd"],
    ["no uppercase", "sup3r$ecret"],
    ["no lowercase", "SUP3R$ECRET"],
    ["no number", "Super$ecret"],
    ["no special char", "Sup3rSecret"],
  ])("rejects a weak password (%s)", (_label, password) => {
    expect(isStrongPassword(password)).toBe(false);
    expect(() => assertStrongPassword(password)).toThrow(/too weak/);
  });
});
