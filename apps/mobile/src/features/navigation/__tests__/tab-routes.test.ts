import { categoryOfPath, showsTabBar } from "../tab-routes";

describe("category of a path", () => {
  it("reads the category a category page shows", () => {
    expect(categoryOfPath("/category/documents")).toBe("documents");
    expect(categoryOfPath("/category/k57abc")).toBe("k57abc");
  });

  it("ignores every other screen", () => {
    for (const path of ["/home", "/vault", "/categories", "/item/abc"])
      expect(categoryOfPath(path)).toBeUndefined();
  });
});

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
