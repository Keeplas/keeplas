import { describe, expect, it } from "vitest";
import { formatPhone } from "../phone-input";

describe("formatPhone", () => {
  it("formats an E.164 number for display", () => {
    expect(formatPhone("+254708684899")).toBe("+254 708 684899");
  });

  it("returns a name or an unparsable value as is", () => {
    expect(formatPhone("Alex Martin")).toBe("Alex Martin");
    expect(formatPhone("")).toBe("");
  });
});
