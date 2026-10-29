import { describe, expect, it } from "vitest";
import {
  generateRecipientKeyPair,
  serializePublicKey,
  wrapBytes,
} from "../src/kem";
import { generateIdentityKeyPair } from "../src/sig";
import { base64ToUint8 } from "../src/encoding";
import {
  approveRecovery,
  createSocialRecovery,
  gateKeyAad,
  newRecoveryNonce,
  openSocialRecovery,
  recoveryCode,
  recoveryCommitment,
} from "../src/social";

// Phase 5 (F3): RS split 2-of-n between contacts, G held by Keeplas, social
// envelope under HKDF(RS ‖ G). Neither side opens the MasterKey alone.

const OWNER = "owner1";
const REQUEST = "request1";

function contact(id: string) {
  const kem = generateRecipientKeyPair();
  return {
    contactId: id,
    publicKey: serializePublicKey(kem.publicKey),
    secretKey: kem.secretKey,
    identity: generateIdentityKeyPair(),
  };
}

async function scenario(contactCount = 3) {
  const masterKey = crypto.getRandomValues(new Uint8Array(32));
  const contacts = Array.from({ length: contactCount }, (_, i) =>
    contact(`c${i}`),
  );
  const setup = await createSocialRecovery({
    masterKey,
    userId: OWNER,
    generation: 1,
    contacts,
  });
  const device = generateRecipientKeyPair();
  const devicePublicKey = serializePublicKey(device.publicKey);
  const approve = async (c: (typeof contacts)[number]) => ({
    contactId: c.contactId,
    contactIdentityPublicKey: c.identity.publicKey,
    ...(await approveRecovery({
      wrappedShare: setup.shares.find((s) => s.contactId === c.contactId)!
        .wrappedShare,
      contactSecretKey: c.secretKey,
      contactIdentitySecretKey: c.identity.secretKey,
      ownerUserId: OWNER,
      contactId: c.contactId,
      generation: 1,
      requestId: REQUEST,
      devicePublicKey,
    })),
  });
  // What Keeplas does at release: seal G to the device key.
  const wrappedGateKey = await wrapBytes(
    base64ToUint8(setup.gateKey),
    devicePublicKey,
    gateKeyAad(REQUEST),
  );
  const open = (approvals: Awaited<ReturnType<typeof approve>>[]) =>
    openSocialRecovery({
      ownerUserId: OWNER,
      generation: 1,
      requestId: REQUEST,
      devicePublicKey,
      deviceSecretKey: device.secretKey,
      wrappedGateKey,
      socialEnvelope: setup.socialEnvelope,
      approvals,
    });
  return { masterKey, contacts, setup, approve, open };
}

describe("social recovery", () => {
  it("restores the MasterKey with any 2 of 3 contacts plus G", async () => {
    const { masterKey, contacts, approve, open } = await scenario();
    expect(
      await open([await approve(contacts[0]), await approve(contacts[2])]),
    ).toEqual(masterKey);
    expect(
      await open([await approve(contacts[1]), await approve(contacts[0])]),
    ).toEqual(masterKey);
  });

  it("works with exactly 2 contacts", async () => {
    const { masterKey, contacts, approve, open } = await scenario(2);
    expect(
      await open([await approve(contacts[0]), await approve(contacts[1])]),
    ).toEqual(masterKey);
  });

  it("refuses one approval, or the same contact twice", async () => {
    const { contacts, approve, open } = await scenario();
    const a = await approve(contacts[0]);
    await expect(open([a])).rejects.toThrow("Not enough valid");
    await expect(open([a, a])).rejects.toThrow("Not enough valid");
  });

  it("ignores an approval with a forged signature", async () => {
    const { contacts, approve, open } = await scenario();
    const forged = {
      ...(await approve(contacts[1])),
      contactIdentityPublicKey: generateIdentityKeyPair().publicKey,
    };
    await expect(open([await approve(contacts[0]), forged])).rejects.toThrow(
      "Not enough valid",
    );
  });

  it("works with any number of contacts, any 2 of them", async () => {
    const { masterKey, contacts, approve, open } = await scenario(5);
    expect(
      await open([await approve(contacts[4]), await approve(contacts[1])]),
    ).toEqual(masterKey);
  });

  it("refuses fewer than 2 contacts", async () => {
    await expect(
      createSocialRecovery({
        masterKey: new Uint8Array(32),
        userId: OWNER,
        generation: 1,
        contacts: [contact("a")],
      }),
    ).rejects.toThrow("at least 2");
  });

  it("never puts RS, G or the MasterKey in a contact share", async () => {
    const { masterKey, setup } = await scenario();
    const mk = Buffer.from(masterKey).toString("base64");
    for (const s of setup.shares) expect(s.wrappedShare).not.toContain(mk);
    expect(setup.socialEnvelope).not.toContain(mk);
  });
});

// D4 code compared by call, as a commit-then-reveal SAS: the device commits
// to a secret nonce per contact, the contact answers with its own nonce, then
// the device reveals. A server that swaps the device key must fix its fake
// commitment before it sees the contact nonce, and the device nonce stays
// hidden until the device pinned the contact nonce it got: one 1-in-10^6
// guess, and a miss is a visible mismatch on the call.
describe("recovery code (commit-then-reveal)", () => {
  const CONTACT = "contact1";
  const devicePublicKey = serializePublicKey(
    generateRecipientKeyPair().publicKey,
  );

  async function exchange(pk = devicePublicKey) {
    const deviceNonce = newRecoveryNonce();
    const commitment = await recoveryCommitment(pk, deviceNonce);
    const contactNonce = newRecoveryNonce();
    const args = {
      requestId: REQUEST,
      contactId: CONTACT,
      devicePublicKey: pk,
      commitment,
      deviceNonce,
      contactNonce,
    };
    return { args, code: await recoveryCode(args) };
  }

  it("gives both sides the same 6-digit code", async () => {
    const { args, code } = await exchange();
    expect(code).toMatch(/^\d{6}$/);
    expect(await recoveryCode({ ...args })).toBe(code);
  });

  it("gives a new code when either nonce changes", async () => {
    const { args, code } = await exchange();
    const codes = new Set([code]);
    for (let i = 0; i < 4; i++) {
      codes.add(
        await recoveryCode({ ...args, contactNonce: newRecoveryNonce() }),
      );
    }
    expect(codes.size).toBeGreaterThan(1);
  });

  it("refuses a swapped device key or nonce: the commitment does not open", async () => {
    const { args } = await exchange();
    const swapped = serializePublicKey(generateRecipientKeyPair().publicKey);
    await expect(
      recoveryCode({ ...args, devicePublicKey: swapped }),
    ).rejects.toThrow("commitment");
    await expect(
      recoveryCode({ ...args, deviceNonce: newRecoveryNonce() }),
    ).rejects.toThrow("commitment");
  });

  it("hashes canonical key bytes: a re-encoded key string is refused", async () => {
    const { args } = await exchange();
    const spaced = `${devicePublicKey.slice(0, 8)} ${devicePublicKey.slice(8)}`;
    await expect(
      recoveryCommitment(spaced, args.deviceNonce),
    ).rejects.toThrow();
    await expect(
      recoveryCode({ ...args, devicePublicKey: spaced }),
    ).rejects.toThrow();
  });

  it("refuses malformed nonces", async () => {
    const { args } = await exchange();
    await expect(
      recoveryCode({ ...args, contactNonce: "AAAA" }),
    ).rejects.toThrow("nonce");
  });
});
