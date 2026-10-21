import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCountdown,
  formatDate,
  formatRelative,
} from "../format";

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

describe("formatRelative", () => {
  const now = Date.UTC(2026, 9, 11, 9);
  const ago = (ms: number) => now - ms;
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  it.each([
    [ago(10_000), "en", "now"],
    [ago(2 * HOUR), "en", "2 hours ago"],
    [ago(2 * DAY), "en", "2 days ago"],
    [ago(7 * DAY), "en", "1 week ago"],
    [ago(3 * DAY), "fr", "il y a 3 jours"],
  ])("formats %d in %s as %s", (timestamp, locale, text) => {
    expect(formatRelative(timestamp, locale, now)).toBe(text);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [870_400, "850 KB"],
    [1_258_291, "1.2 MB"],
    [4 * 1024 * 1024, "4 MB"],
    [62 * 1024 * 1024, "62 MB"],
  ])("formats %d as %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });

  it("uses French units and a decimal comma in French", () => {
    expect(formatBytes(1_258_291, "fr")).toBe("1,2 Mo");
    expect(formatBytes(0, "fr")).toBe("0 o");
  });
});

describe("formatDate", () => {
  it("uses the short month", () => {
    expect(formatDate(Date.UTC(2026, 0, 12, 12), "en")).toBe("Jan 12, 2026");
  });
});
