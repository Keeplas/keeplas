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
  openSocialRecovery,
  recoveryCode,
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

  it("computes the same 6-digit code on both sides, and a new one if the device key changes", async () => {
    const pk = serializePublicKey(generateRecipientKeyPair().publicKey);
    const other = serializePublicKey(generateRecipientKeyPair().publicKey);
    const code = await recoveryCode(REQUEST, pk);
    expect(code).toMatch(/^\d{6}$/);
    expect(await recoveryCode(REQUEST, pk)).toBe(code);
    expect(await recoveryCode(REQUEST, other)).not.toBe(code);
  });
});
