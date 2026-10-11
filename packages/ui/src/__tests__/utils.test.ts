import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils";

describe("cn", () => {
  it("keeps a typography utility next to a text color", () => {
    expect(cn("text-h1 text-text-primary")).toBe("text-h1 text-text-primary");
    expect(cn("text-body-md text-on-surface-variant")).toBe(
      "text-body-md text-on-surface-variant",
    );
  });

  it("lets a later typography utility override an earlier one", () => {
    expect(cn("text-body", "text-caption")).toBe("text-caption");
  });

  it("lets a later text color override an earlier one", () => {
    expect(cn("text-text-primary", "text-text-muted")).toBe("text-text-muted");
  });
});
