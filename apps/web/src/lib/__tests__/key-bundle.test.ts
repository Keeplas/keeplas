import { describe, it, expect } from "vitest";
import { classifyKeyBundle, parseKeyBundle } from "../key-bundle";

describe("classifyKeyBundle", () => {
  it("flags a legacy V1 bundle (server-stored wrappingKey) for re-key", () => {
    // V1 shape is server-decryptable and must NOT be treated as unlockable.
    const v1 = parseKeyBundle(
      JSON.stringify({
        version: 1,
        wrappingKey: "server-plaintext-key",
        iv: "iv",
        encryptedMasterKey: "ct",
      }),
    );
    expect(classifyKeyBundle(v1)).toBe("legacy-v1");
  });

  it("treats a V1 bundle as legacy even if a stale phraseSalt is present", () => {
    // Presence of wrappingKey is the hard zero-knowledge tell — it wins.
    const mixed = parseKeyBundle(
      JSON.stringify({
        phraseSalt: "salt",
        wrappingKey: "server-plaintext-key",
        iv: "iv",
        encryptedMasterKey: "ct",
      }),
    );
    expect(classifyKeyBundle(mixed)).toBe("legacy-v1");
  });

  it("classifies a V2 bundle (phrase-derived, no wrappingKey) as v2", () => {
    const v2 = parseKeyBundle(
      JSON.stringify({
        version: 2,
        phraseSalt: "salt",
        iv: "iv",
        encryptedMasterKey: "ct",
      }),
    );
    expect(classifyKeyBundle(v2)).toBe("v2");
  });

  it("classifies a V2-shaped bundle without an explicit version as v2", () => {
    const v2 = parseKeyBundle(
      JSON.stringify({ phraseSalt: "salt", iv: "iv", encryptedMasterKey: "ct" }),
    );
    expect(classifyKeyBundle(v2)).toBe("v2");
  });

  it("returns none for a missing or malformed bundle", () => {
    expect(classifyKeyBundle(parseKeyBundle(null))).toBe("none");
    expect(classifyKeyBundle(parseKeyBundle("not json"))).toBe("none");
    expect(
      classifyKeyBundle(parseKeyBundle(JSON.stringify({ phraseSalt: "salt" }))),
    ).toBe("none");
  });
});
