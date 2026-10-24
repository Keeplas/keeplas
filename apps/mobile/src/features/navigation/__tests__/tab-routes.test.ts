import { showsTabBar } from "../tab-routes";

describe("tab bar visibility", () => {
  it("stays on tabs and on screens opened from them", () => {
    for (const path of [
      "/home",
      "/vault",
      "/search",
      "/people",
      "/settings",
      "/vault/documents",
      "/item/abc",
      "/folder/abc",
      "/devices",
      "/privacy",
      "/life-check",
    ])
      expect(showsTabBar(path)).toBe(true);
  });

  it("hides on full-screen flows", () => {
    for (const path of [
      "/capture/voice",
      "/capture/compose",
      "/scan",
      "/new-device",
      "/not-me",
      "/secured",
      "/link-blocked",
      "/recovery-approval/abc",
      "/rotate-keys",
    ])
      expect(showsTabBar(path)).toBe(false);
  });

  it("does not hide a screen that only shares a prefix", () => {
    expect(showsTabBar("/scanner-help")).toBe(true);
  });
});
