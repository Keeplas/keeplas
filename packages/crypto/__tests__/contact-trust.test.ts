import { describe, it, expect } from "vitest";
import {
  generateRecipientKeyPair,
  parsePublicKey,
  serializePublicKey,
} from "../src/kem";
import {
  LEGACY_PIN_UPGRADE_DEADLINE,
  type ContactKeyMaterial,
  type ContactTrust,
  carryOverPin,
  contactKeyMaterial,
  deriveContactTrust,
  generateIdentityKeyPair,
  identityKeyFingerprint,
  legacyPinUpgrades,
  signBytes,
  signKemBinding,
  verifyContactKey,
} from "../src/sig";

/**
 * Verify-before-wrap with an authenticated TOFU pin. The server stores the
 * pin, so every test here plays the malicious server: it rewrites the row the
 * owner's client reads back and checks the wrap is refused.
 */
const OWNER = "owner-1";
const BEFORE_DEADLINE = LEGACY_PIN_UPGRADE_DEADLINE - 1;

async function masterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function trust(now = BEFORE_DEADLINE): Promise<ContactTrust> {
  return { ...(await deriveContactTrust(OWNER, await masterKey())), now };
}

/** A contact as published by an honest client (v1 key binding). */
async function honestContact(
  overrides: Partial<ContactKeyMaterial> = {},
): Promise<ContactKeyMaterial> {
  const kem = generateRecipientKeyPair();
  const contactPublicKey = serializePublicKey(kem.publicKey);
  const identity = generateIdentityKeyPair();
  return {
    contactId: "c1",
    contactUserId: "contact-user-1",
    name: "Ada",
    contactPublicKey,
    contactIdentityPublicKey: identity.publicKey,
    contactPublicKeySignature: await signKemBinding(
      identity.secretKey,
      "contact-user-1",
      contactPublicKey,
    ),
    hasWraps: false,
    ...overrides,
  };
}

/** What the owner's client stores after trusting `contact` once. */
async function pinned(
  contact: ContactKeyMaterial,
  owner: ContactTrust,
): Promise<ContactKeyMaterial> {
  const outcome = await verifyContactKey(contact, owner);
  if (outcome.status !== "ok" || !outcome.pin) throw new Error("not pinned");
  return {
    ...contact,
    pinnedIdentityFingerprint: outcome.pin.fingerprint,
    pinnedIdentityMac: outcome.pin.mac,
    hasWraps: true,
  };
}

/** The attacker's own, self-consistent key material for `contact`'s row. */
async function substituted(
  contact: ContactKeyMaterial,
): Promise<ContactKeyMaterial> {
  const attacker = await honestContact({
    contactUserId: contact.contactUserId,
  });
  return {
    ...contact,
    contactPublicKey: attacker.contactPublicKey,
    contactIdentityPublicKey: attacker.contactIdentityPublicKey,
    contactPublicKeySignature: attacker.contactPublicKeySignature,
  };
}

describe("verifyContactKey: first use", () => {
  it("accepts a contact never sealed to and returns the MACed pin to store", async () => {
    const owner = await trust();
    const contact = await honestContact();
    const outcome = await verifyContactKey(contact, owner);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.contactPublicKey).toBe(contact.contactPublicKey);
    expect(outcome.pin?.fingerprint).toBe(
      await identityKeyFingerprint(contact.contactIdentityPublicKey!),
    );
    expect(outcome.pin?.mac).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("refuses to re-trust silently when the pin is stripped from a contact already sealed to", async () => {
    const owner = await trust();
    const contact = await pinned(await honestContact(), owner);
    const stripped = await substituted({
      ...contact,
      pinnedIdentityFingerprint: undefined,
      pinnedIdentityMac: undefined,
    });
    const outcome = await verifyContactKey(stripped, owner);
    expect(outcome.status).toBe("pin_unverified");
    if (outcome.status !== "pin_unverified") return;
    // The re-trust offered to the owner pins the key actually presented.
    expect(outcome.repin.fingerprint).toBe(
      await identityKeyFingerprint(stripped.contactIdentityPublicKey!),
    );
  });

  it("blocks a key whose binding signature does not verify", async () => {
    const owner = await trust();
    const contact = await honestContact();
    const other = generateRecipientKeyPair();
    const outcome = await verifyContactKey(
      { ...contact, contactPublicKey: serializePublicKey(other.publicKey) },
      owner,
    );
    expect(outcome.status).toBe("signature_invalid");
  });

  it("is unverifiable without identity material", async () => {
    const owner = await trust();
    const contact = await honestContact();
    expect(
      (
        await verifyContactKey(
          { ...contact, contactIdentityPublicKey: undefined },
          owner,
        )
      ).status,
    ).toBe("unverifiable");
  });
});

describe("verifyContactKey: authenticated pin", () => {
  it("accepts the pinned identity with nothing new to store", async () => {
    const owner = await trust();
    const contact = await pinned(await honestContact(), owner);
    const outcome = await verifyContactKey(contact, owner);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") expect(outcome.pin).toBeUndefined();
  });

  it("refuses a pin the server rewrote to the attacker's fingerprint", async () => {
    const owner = await trust();
    const contact = await pinned(await honestContact(), owner);
    const forged = await substituted(contact);
    forged.pinnedIdentityFingerprint = await identityKeyFingerprint(
      forged.contactIdentityPublicKey!,
    );
    expect((await verifyContactKey(forged, owner)).status).toBe(
      "pin_unverified",
    );
  });

  it("refuses a pin MAC moved from another contact row", async () => {
    const owner = await trust();
    const contact = await pinned(await honestContact(), owner);
    expect(
      (await verifyContactKey({ ...contact, contactId: "c2" }, owner)).status,
    ).toBe("pin_unverified");
  });

  it("refuses a pin MACed by another owner", async () => {
    const owner = await trust();
    const contact = await pinned(await honestContact(), await trust());
    expect((await verifyContactKey(contact, owner)).status).toBe(
      "pin_unverified",
    );
  });

  it("reports a changed identity and offers the explicit re-pin", async () => {
    const owner = await trust();
    const contact = await pinned(await honestContact(), owner);
    const rekeyed = await substituted(contact);
    const outcome = await verifyContactKey(rekeyed, owner);
    expect(outcome.status).toBe("fingerprint_changed");
    if (outcome.status !== "fingerprint_changed") return;
    const repinned = {
      ...rekeyed,
      pinnedIdentityFingerprint: outcome.repin.fingerprint,
      pinnedIdentityMac: outcome.repin.mac,
    };
    expect((await verifyContactKey(repinned, owner)).status).toBe("ok");
  });

  it("refuses a legacy-format signature for a contact pinned with a v1 binding", async () => {
    const owner = await trust();
    const identity = generateIdentityKeyPair();
    const kem = serializePublicKey(generateRecipientKeyPair().publicKey);
    const contact = await pinned(
      await honestContact({
        contactIdentityPublicKey: identity.publicKey,
        contactPublicKey: kem,
        contactPublicKeySignature: await signKemBinding(
          identity.secretKey,
          "contact-user-1",
          kem,
        ),
      }),
      owner,
    );
    const downgraded = {
      ...contact,
      contactPublicKeySignature: signBytes(
        identity.secretKey,
        parsePublicKey(kem),
      ),
    };
    expect((await verifyContactKey(downgraded, owner)).status).toBe(
      "pin_unverified",
    );
  });
});

describe("verifyContactKey: legacy accounts", () => {
  /** A contact keyed before v1: raw-bytes signature, unMACed pin. */
  async function legacyContact(): Promise<ContactKeyMaterial> {
    const identity = generateIdentityKeyPair();
    const kem = serializePublicKey(generateRecipientKeyPair().publicKey);
    return honestContact({
      contactIdentityPublicKey: identity.publicKey,
      contactPublicKey: kem,
      contactPublicKeySignature: signBytes(
        identity.secretKey,
        parsePublicKey(kem),
      ),
      pinnedIdentityFingerprint: await identityKeyFingerprint(
        identity.publicKey,
      ),
      hasWraps: true,
    });
  }

  it("upgrades a matching legacy pin by returning the MAC to store", async () => {
    const owner = await trust();
    const contact = await legacyContact();
    const outcome = await verifyContactKey(contact, owner);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok" || !outcome.pin) throw new Error("no upgrade");
    const upgraded = { ...contact, pinnedIdentityMac: outcome.pin.mac };
    const again = await verifyContactKey(upgraded, owner);
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.pin).toBeUndefined();
  });

  it("keeps blocking a legacy pin that does not match", async () => {
    const owner = await trust();
    const contact = await substituted(await legacyContact());
    expect((await verifyContactKey(contact, owner)).status).toBe(
      "fingerprint_changed",
    );
  });

  it("needs explicit re-trust for a legacy pin after the upgrade deadline", async () => {
    const owner = await trust(LEGACY_PIN_UPGRADE_DEADLINE);
    expect((await verifyContactKey(await legacyContact(), owner)).status).toBe(
      "pin_unverified",
    );
  });

  it("lists the legacy pins to upgrade, skipping MACed and mismatched ones", async () => {
    const owner = await trust();
    const legacy = await legacyContact();
    const mismatched = {
      ...(await substituted(await legacyContact())),
      contactId: "c3",
    };
    const authenticated = {
      ...(await pinned(await honestContact(), owner)),
      contactId: "c4",
    };
    const upgrades = await legacyPinUpgrades(
      [legacy, mismatched, authenticated],
      owner,
    );
    expect(upgrades.map((u) => u.contactId)).toEqual([legacy.contactId]);
    expect(upgrades[0].pin.fingerprint).toBe(legacy.pinnedIdentityFingerprint);
  });
});

describe("carryOverPin (master-key rotation)", () => {
  it("re-MACs a pin verified under the old key for the new key", async () => {
    const before = await trust();
    const after = await trust();
    const contact = await pinned(await honestContact(), before);
    const outcome = await carryOverPin(contact, before, after);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok" || !outcome.pin) throw new Error("no pin");
    const carried = { ...contact, pinnedIdentityMac: outcome.pin.mac };
    expect((await verifyContactKey(carried, after)).status).toBe("ok");
    expect((await verifyContactKey(carried, before)).status).toBe(
      "pin_unverified",
    );
  });

  it("does not carry over a pin that fails under the old key", async () => {
    const before = await trust();
    const contact = await substituted(
      await pinned(await honestContact(), before),
    );
    expect((await carryOverPin(contact, before, await trust())).status).toBe(
      "fingerprint_changed",
    );
  });
});

describe("contactKeyMaterial", () => {
  it("forwards every field the verifier needs from a contact row", () => {
    const row = {
      _id: "c1",
      contactUserId: "u1",
      name: "Ada",
      contactPublicKey: "kem",
      contactIdentityPublicKey: "id",
      contactPublicKeySignature: "sig",
      pinnedIdentityFingerprint: "fp",
      pinnedIdentityMac: "mac",
      hasWraps: true,
      email: "ada@example.com",
    };
    expect(contactKeyMaterial(row)).toEqual({
      contactId: "c1",
      contactUserId: "u1",
      name: "Ada",
      contactPublicKey: "kem",
      contactIdentityPublicKey: "id",
      contactPublicKeySignature: "sig",
      pinnedIdentityFingerprint: "fp",
      pinnedIdentityMac: "mac",
      hasWraps: true,
    });
  });
});
