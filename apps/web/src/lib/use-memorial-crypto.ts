import { useCallback } from "react";
import { useRecipientCrypto } from "./use-recipient-crypto";
import { useVaultCrypto } from "./use-vault-crypto";
import { parseLinks } from "./link-payload";

export interface MemorialDecryptInput {
  // The per-item DEK wrapped to THIS contact's ML-KEM key
  // (vault_item_recipient_keys.wrappedDek).
  wrappedDek: string;
  encryptedTitle?: string | null;
  encryptedContent: string;
  encryptedLinks?: string | null;
}

export interface MemorialDecryptResult {
  // Decrypted title, or "" when the item carries no encrypted title (legacy
  // rows still expose a plaintext title on the server side).
  title: string;
  content: string;
  links: string[];
  // The unwrapped per-item DEK, reused to decrypt the item's attachments.
  dek: CryptoKey;
}

/**
 * Contact-side decryption of a released ("memorial") vault item. Unwraps the
 * per-item DEK with the contact's OWN ML-KEM key (no master-key reconstruction)
 * and decrypts content + links. Composes the existing recipient/vault crypto
 * hooks so the crypto path stays identical to the owner's read path.
 */
export function useMemorialCrypto() {
  const { unwrapOwnerDek, isReady: recipientReady } = useRecipientCrypto();
  const { decryptContentWithKey, isReady: cryptoReady } = useVaultCrypto();

  const decryptItem = useCallback(
    async ({
      wrappedDek,
      encryptedTitle,
      encryptedContent,
      encryptedLinks,
    }: MemorialDecryptInput): Promise<MemorialDecryptResult> => {
      const dek = await unwrapOwnerDek({ wrappedDek });
      const [title, content, links] = await Promise.all([
        encryptedTitle
          ? decryptContentWithKey(encryptedTitle, dek).catch(() => "")
          : Promise.resolve(""),
        decryptContentWithKey(encryptedContent, dek).catch(
          () => "[Unable to decrypt]",
        ),
        encryptedLinks
          ? decryptContentWithKey(encryptedLinks, dek)
              .then(parseLinks)
              .catch(() => [] as string[])
          : Promise.resolve([] as string[]),
      ]);
      return { title, content, links, dek };
    },
    [unwrapOwnerDek, decryptContentWithKey],
  );

  return { isReady: recipientReady && cryptoReady, decryptItem };
}
