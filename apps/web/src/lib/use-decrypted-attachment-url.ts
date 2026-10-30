import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils";

/** Types a browser only ever renders as media, never as a document. */
const INERT_TYPE =
  /^(application\/pdf|image\/(png|jpeg|gif|webp|avif|heic)|audio\/[\w.+-]+|video\/[\w.+-]+)$/;

/**
 * Blob type for decrypted bytes whose MIME type the item owner chose. A
 * blob: URL is same-origin with the app, so text/html or image/svg+xml opened
 * from it would run as a Keeplas page: anything not plainly media is stored
 * as opaque bytes (downloads keep their file name).
 */
export function inertBlobType(mimeType: string | undefined): string {
  const type = mimeType?.trim().toLowerCase() ?? "";
  return INERT_TYPE.test(type) ? type : "application/octet-stream";
}

/**
 * Downloads an encrypted attachment from its signed URL, decrypts it client-side
 * and exposes the plaintext blob and its URL for rendering/download. Shared by the vault (owner) and
 * memorial (contact) attachment views — the only differences (which signed-URL
 * query, which key to decrypt with, when decryption may start) are injected by
 * the caller so the fetch + decrypt + object-URL lifecycle lives here once.
 *
 * `decrypt` must be referentially stable (wrap it in `useCallback` at the call
 * site) so the effect doesn't re-run on every render.
 */
export function useDecryptedAttachmentUrl({
  signedUrl,
  iv,
  mimeType,
  decrypt,
  enabled,
  errorFallback,
}: {
  signedUrl: string | null | undefined;
  iv: string;
  mimeType?: string;
  decrypt: (cipher: Blob, iv: string) => Promise<Blob>;
  enabled: boolean;
  errorFallback: string;
}): {
  plainUrl: string | null;
  plainBlob: Blob | null;
  decrypting: boolean;
  error: string;
} {
  const [plain, setPlain] = useState<{ url: string; blob: Blob } | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function run() {
      if (!signedUrl || !enabled || plain || decrypting) return;
      setDecrypting(true);
      setError("");
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const cipherBlob = await res.blob();
        const plainBlob = await decrypt(cipherBlob, iv);
        const typedBlob = new Blob([plainBlob], {
          type: inertBlobType(mimeType || plainBlob.type),
        });
        createdUrl = URL.createObjectURL(typedBlob);
        if (!cancelled) setPlain({ url: createdUrl, blob: typedBlob });
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, errorFallback));
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl, enabled, iv, mimeType, decrypt, errorFallback]);

  return {
    plainUrl: plain?.url ?? null,
    plainBlob: plain?.blob ?? null,
    decrypting,
    error,
  };
}
