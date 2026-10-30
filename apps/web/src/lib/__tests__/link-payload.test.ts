import { describe, expect, it } from "vitest";
import { safeLinkHref } from "../link-payload";

describe("safeLinkHref", () => {
  it.each([
    "https://bank.example/login",
    "http://intranet.example/",
    "mailto:notary@example.com",
    "tel:+33123456789",
  ])("opens %s", (url) => {
    expect(safeLinkHref(url)).toBe(url);
  });

  it("trims surrounding whitespace", () => {
    expect(safeLinkHref("  https://example.com/a ")).toBe(
      "https://example.com/a",
    );
  });

  it.each([
    "javascript:fetch('https://evil.example')",
    " JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "blob:https://app.keeplas.com/uuid",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "example.com/no-scheme",
    "",
  ])("keeps %j inert", (url) => {
    expect(safeLinkHref(url)).toBeNull();
  });
});
