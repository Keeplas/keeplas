import { describe, expect, it } from "vitest";
import {
  fileMetaJson,
  itemMetaJson,
  legacyFileMeta,
  parseFileMeta,
  parseItemMeta,
} from "../item-meta";

describe("item metadata (F4)", () => {
  it("round-trips item and file metadata", () => {
    expect(parseItemMeta(itemMetaJson("credential"))).toEqual({
      v: 1,
      category: "credential",
    });
    // Same JSON as the phone app (apps/mobile payload-compat test).
    expect(itemMetaJson("other", "pin", "k1")).toBe(
      '{"v":1,"category":"other","icon":"pin","categoryId":"k1"}',
    );
    const file = {
      name: "scan.pdf",
      mimeType: "application/pdf",
      size: 1234,
      kind: "document" as const,
    };
    expect(parseFileMeta(fileMetaJson(file))).toEqual({ v: 1, ...file });
  });

  it("gives legacy rows neutral defaults for missing columns", () => {
    expect(legacyFileMeta({})).toEqual({
      v: 1,
      name: "",
      mimeType: "application/octet-stream",
      size: 0,
      kind: "document",
      durationSec: undefined,
    });
  });
});
