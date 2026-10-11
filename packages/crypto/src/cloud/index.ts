import { decrypt, encrypt } from "../aes";
import { base64ToUint8, uint8ToBase64 } from "../encoding";

/**
 * iCloud Keychain / Google Block Store backup (v2 workflows 10–11, D7).
 * A random Cloud Backup Key (CBK) lives only in the user's synced platform
 * keychain; Keeplas stores AES-GCM(CBK, RootKey). Wrapping the RootKey (not
 * the MasterKey) keeps the backup valid across MasterKey rotations. Apple /
 * Google alone, or Keeplas alone, open nothing.
 */

const aad = (userId: string) =>
  new TextEncoder().encode(`${userId}|keeplas/cloud-backup/v1`);

async function importCbk(cbk: Uint8Array): Promise<CryptoKey> {
  const buf = new Uint8Array(cbk.byteLength);
  buf.set(cbk);
  return crypto.subtle.importKey("raw", buf, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Phone: new CBK (to store in the platform keychain) + envelope (to Keeplas). */
export async function sealCloudBackup(args: {
  rootKey: Uint8Array;
  userId: string;
}): Promise<{ cbk: string; envelope: string }> {
  const cbk = crypto.getRandomValues(new Uint8Array(32));
  try {
    const sealed = await encrypt(
      new Uint8Array(args.rootKey),
      await importCbk(cbk),
      aad(args.userId),
    );
    return {
      cbk: uint8ToBase64(cbk),
      envelope: JSON.stringify({
        v: 1,
        iv: uint8ToBase64(sealed.iv),
        ct: uint8ToBase64(new Uint8Array(sealed.ciphertext)),
      }),
    };
  } finally {
    cbk.fill(0);
  }
}

/** New phone: CBK from the restored keychain + envelope → raw RootKey. */
export async function openCloudBackup(args: {
  envelope: string;
  cbk: string;
  userId: string;
}): Promise<Uint8Array> {
  const env = JSON.parse(args.envelope) as { v: 1; iv: string; ct: string };
  const cbk = base64ToUint8(args.cbk);
  try {
    return new Uint8Array(
      await decrypt(
        base64ToUint8(env.ct),
        await importCbk(cbk),
        base64ToUint8(env.iv),
        aad(args.userId),
      ),
    );
  } finally {
    cbk.fill(0);
  }
}
