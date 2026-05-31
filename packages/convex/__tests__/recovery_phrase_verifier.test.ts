import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import { makeT, signedAudit, type TestConvex } from "./test.helpers";
import type { Id } from "../_generated/dataModel";

// Recovery-phrase verifier flow (findings H3/#8 + M1):
// - the server stores ONLY the client-computed salted verifier hex,
// - it compares with a constant-time check (no early-exit `!==`),
// - the per-user salt is served back so the client can recompute the verifier.
// The raw phrase never reaches the server in any of these paths.

const VERIFIER = "a".repeat(64); // stand-in for a 64-char Argon2id hex digest
const SALT_B64 = "c2FsdHNhbHRzYWx0c2FsdA=="; // any base64 string
const BUNDLE = JSON.stringify({ version: 2, phraseSalt: SALT_B64 });

async function seedEmailUser(
  t: TestConvex,
  opts: {
    email: string;
    recoveryPhraseHash?: string;
    phraseSalt?: string;
    encryptedKeyBundle?: string;
  },
): Promise<Id<"users">> {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      email: opts.email,
      recoveryPhraseHash: opts.recoveryPhraseHash,
      phraseSalt: opts.phraseSalt,
      encryptedKeyBundle: opts.encryptedKeyBundle,
    }),
  );
}

describe("verifyRecoveryPhraseInternal (passwordReset)", () => {
  it("returns the userId when the verifier matches", async () => {
    const t = makeT();
    const userId = await seedEmailUser(t, {
      email: "match@example.com",
      recoveryPhraseHash: VERIFIER,
    });
    const result = await t.query(
      internal.passwordReset.verifyRecoveryPhraseInternal,
      { email: "match@example.com", phraseHash: VERIFIER },
    );
    expect(result).toBe(userId);
  });

  it("returns null when the verifier is wrong", async () => {
    const t = makeT();
    await seedEmailUser(t, {
      email: "wrong@example.com",
      recoveryPhraseHash: VERIFIER,
    });
    const result = await t.query(
      internal.passwordReset.verifyRecoveryPhraseInternal,
      { email: "wrong@example.com", phraseHash: "b".repeat(64) },
    );
    expect(result).toBeNull();
  });

  it("returns null for a wrong verifier of a DIFFERENT length (constant-time path)", async () => {
    // The constant-time compare must reject mismatched lengths without throwing.
    const t = makeT();
    await seedEmailUser(t, {
      email: "len@example.com",
      recoveryPhraseHash: VERIFIER,
    });
    const result = await t.query(
      internal.passwordReset.verifyRecoveryPhraseInternal,
      { email: "len@example.com", phraseHash: "short" },
    );
    expect(result).toBeNull();
  });

  it("returns null when the user has no recovery verifier configured", async () => {
    const t = makeT();
    await seedEmailUser(t, { email: "none@example.com" });
    const result = await t.query(
      internal.passwordReset.verifyRecoveryPhraseInternal,
      { email: "none@example.com", phraseHash: VERIFIER },
    );
    expect(result).toBeNull();
  });

  it("normalizes the email before lookup", async () => {
    const t = makeT();
    const userId = await seedEmailUser(t, {
      email: "case@example.com",
      recoveryPhraseHash: VERIFIER,
    });
    const result = await t.query(
      internal.passwordReset.verifyRecoveryPhraseInternal,
      { email: "  CASE@Example.com  ", phraseHash: VERIFIER },
    );
    expect(result).toBe(userId);
  });
});

describe("getPhraseSaltByEmail (passwordReset)", () => {
  it("returns the salt + bundle once both are set", async () => {
    const t = makeT();
    await seedEmailUser(t, {
      email: "salt@example.com",
      phraseSalt: SALT_B64,
      encryptedKeyBundle: BUNDLE,
    });
    const result = await t.mutation(api.passwordReset.getPhraseSaltByEmail, {
      email: "salt@example.com",
      _audit: await signedAudit(),
    });
    expect(result).toEqual({
      phraseSalt: SALT_B64,
      encryptedKeyBundle: BUNDLE,
    });
  });

  it("returns null until the key bundle exists (enumeration guard)", async () => {
    const t = makeT();
    await seedEmailUser(t, {
      email: "nobundle@example.com",
      phraseSalt: SALT_B64,
    });
    const result = await t.mutation(api.passwordReset.getPhraseSaltByEmail, {
      email: "nobundle@example.com",
      _audit: await signedAudit(),
    });
    expect(result).toBeNull();
  });

  it("rate-limits repeated lookups from the same IP", async () => {
    const t = makeT();
    await seedEmailUser(t, {
      email: "rl@example.com",
      phraseSalt: SALT_B64,
      encryptedKeyBundle: BUNDLE,
    });
    // signedAudit() pins ip=127.0.0.1, so every call lands in the same bucket.
    const audit = await signedAudit();
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.passwordReset.getPhraseSaltByEmail, {
        email: "rl@example.com",
        _audit: audit,
      });
    }
    await expect(
      t.mutation(api.passwordReset.getPhraseSaltByEmail, {
        email: "rl@example.com",
        _audit: audit,
      }),
    ).rejects.toThrow(/too many/i);
  });
});

describe("getPhraseSaltByPhone (phone_auth)", () => {
  async function seedPhoneUser(
    t: TestConvex,
    opts: {
      phoneNumber: string;
      phraseSalt?: string;
      recoveryPhraseHash?: string;
    },
  ): Promise<Id<"users">> {
    return await t.run((ctx) =>
      ctx.db.insert("users", {
        phoneNumber: opts.phoneNumber,
        phraseSalt: opts.phraseSalt,
        recoveryPhraseHash: opts.recoveryPhraseHash,
      }),
    );
  }

  it("returns the salt once a verifier is configured", async () => {
    const t = makeT();
    await seedPhoneUser(t, {
      phoneNumber: "+33612345678",
      phraseSalt: SALT_B64,
      recoveryPhraseHash: VERIFIER,
    });
    const result = await t.mutation(api.phone_auth.getPhraseSaltByPhone, {
      phoneNumber: "+33612345678",
      _audit: await signedAudit(),
    });
    expect(result).toEqual({ phraseSalt: SALT_B64 });
  });

  it("returns null until a verifier exists (enumeration guard)", async () => {
    const t = makeT();
    await seedPhoneUser(t, {
      phoneNumber: "+33698765432",
      phraseSalt: SALT_B64,
    });
    const result = await t.mutation(api.phone_auth.getPhraseSaltByPhone, {
      phoneNumber: "+33698765432",
      _audit: await signedAudit(),
    });
    expect(result).toBeNull();
  });
});
