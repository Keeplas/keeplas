import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import { derivePhraseVerifier } from "@keeplas/crypto/recovery";
import { verifierDigest } from "@keeplas/backend/lib/crypto";

import { kitOpens } from "../review-demo";

const KIT = [...Array(23).fill("abandon"), "art"];
const OTHER = [...Array(23).fill("zoo"), "vote"];
const SALT = new Uint8Array(16).fill(7);

async function storedFor(words: string[], digest: boolean) {
  const verifier = await derivePhraseVerifier(words, SALT);
  return {
    phraseSalt: uint8ToBase64(SALT),
    recoveryPhraseHash: digest ? await verifierDigest(verifier) : verifier,
  };
}

describe("kitOpens", () => {
  it("opens an account whose verifier the server stores as a digest", async () => {
    expect(await kitOpens(KIT, await storedFor(KIT, true))).toBe(true);
  });

  it("opens an account still holding a legacy raw verifier", async () => {
    expect(await kitOpens(KIT, await storedFor(KIT, false))).toBe(true);
  });

  it("refuses other words", async () => {
    expect(await kitOpens(KIT, await storedFor(OTHER, true))).toBe(false);
  });
});
