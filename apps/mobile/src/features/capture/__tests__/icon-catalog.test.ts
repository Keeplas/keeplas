import { ITEM_ICONS, searchIcons } from "../icon-catalog";

describe("icon catalog", () => {
  it("returns every icon for an empty search", () => {
    expect(searchIcons("  ")).toHaveLength(ITEM_ICONS.length);
  });

  it("finds icons by English or French words, ignoring accents and case", () => {
    expect(searchIcons("House").map((icon) => icon.name)).toContain("home");
    expect(searchIcons("propriete").map((icon) => icon.name)).toContain("home");
    expect(searchIcons("santé").map((icon) => icon.name)).toContain("activity");
  });

  it("returns nothing for an unknown word", () => {
    expect(searchIcons("zzz")).toEqual([]);
  });

  it("has no duplicate icons", () => {
    const names = ITEM_ICONS.map((icon) => icon.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
