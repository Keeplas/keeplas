import type { VaultCategory } from "@/crypto/item-meta";
import type { ContentKind } from "@/features/home/vault-groups";
import { categoryCounts, filterPreset, inFilter } from "../vault-filter";

const item = (
  category: string,
  kind: ContentKind = "notes",
  categoryId?: string,
) => ({ category: category as VaultCategory, kind, categoryId });

describe("vault filters", () => {
  it("filters a built-in list like the Vault chips", () => {
    expect(inFilter(item("legal_document", "documents"), "documents")).toBe(
      true,
    );
    expect(inFilter(item("credential"), "documents")).toBe(false);
    expect(inFilter(item("inbox", "voice"), "all")).toBe(true);
  });

  it("filters a user-made category by its id", () => {
    const filed = item("other", "photos", "c1");
    expect(inFilter(filed, "c1")).toBe(true);
    expect(inFilter(filed, "c2")).toBe(false);
    expect(inFilter(item("other"), "c1")).toBe(false);
    // Still listed by its type, never under Other.
    expect(inFilter(filed, "photos")).toBe(true);
    expect(inFilter(filed, "other")).toBe(false);
  });

  it("files an added item in the filter it was added from", () => {
    expect(filterPreset("documents")).toEqual({
      category: "personal_document",
    });
    expect(filterPreset("all")).toEqual({ category: undefined });
    expect(filterPreset("c1")).toEqual({ category: "other", categoryId: "c1" });
  });

  it("counts the items of each user-made category", () => {
    const counts = categoryCounts([
      item("other", "notes", "c1"),
      item("other", "photos", "c1"),
      item("other", "voice", "c2"),
      item("credential"),
    ]);
    expect(counts.get("c1")).toBe(2);
    expect(counts.get("c2")).toBe(1);
    expect(counts.get("c3")).toBeUndefined();
  });
});
