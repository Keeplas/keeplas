import { describe, expect, it } from "vitest";
import { formatCountdown } from "../format";

describe("formatCountdown", () => {
  it.each([
    [120_000, "02:00"],
    [102_000, "01:42"],
    [61_001, "01:02"],
    [999, "00:01"],
    [0, "00:00"],
    [-5_000, "00:00"],
  ])("formats %d ms as %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
