import { describe, it, expect } from "vitest";
import { formatSenderIdentity } from "../lib/identity";

describe("formatSenderIdentity", () => {
  it("appends both email and phone when present", () => {
    expect(
      formatSenderIdentity({
        name: "Prince Nzanzu",
        email: "prince@mail.com",
        phoneNumber: "+243970000000",
      }),
    ).toBe("Prince Nzanzu (prince@mail.com · +243970000000)");
  });

  it("appends only the email when no phone", () => {
    expect(
      formatSenderIdentity({ name: "Prince", email: "prince@mail.com" }),
    ).toBe("Prince (prince@mail.com)");
  });

  it("appends only the phone when no email", () => {
    expect(
      formatSenderIdentity({ name: "Prince", phoneNumber: "+243970000000" }),
    ).toBe("Prince (+243970000000)");
  });

  it("returns the bare name when no identifier is on file", () => {
    expect(formatSenderIdentity({ name: "Prince" })).toBe("Prince");
  });

  it("falls back to the identifier(s) when the name is missing", () => {
    expect(formatSenderIdentity({ email: "prince@mail.com" })).toBe(
      "prince@mail.com",
    );
    expect(
      formatSenderIdentity({
        email: "prince@mail.com",
        phoneNumber: "+243970000000",
      }),
    ).toBe("prince@mail.com · +243970000000");
  });

  it("trims whitespace and ignores empty fields", () => {
    expect(
      formatSenderIdentity({
        name: "  Prince  ",
        email: "  prince@mail.com  ",
        phoneNumber: "   ",
      }),
    ).toBe("Prince (prince@mail.com)");
  });

  it("uses the default fallback when everything is empty", () => {
    expect(formatSenderIdentity(null)).toBe("A Keeplas user");
    expect(formatSenderIdentity({})).toBe("A Keeplas user");
    expect(formatSenderIdentity({ name: "  " })).toBe("A Keeplas user");
  });

  it("honours a custom (localized) fallback", () => {
    expect(formatSenderIdentity({}, "Un utilisateur Keeplas")).toBe(
      "Un utilisateur Keeplas",
    );
  });
});
