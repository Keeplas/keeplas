import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils";

/**
 * Downloads an encrypted attachment from its signed URL, decrypts it client-side
 * and exposes a blob URL for rendering/download. Shared by the vault (owner) and
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
}): { plainUrl: string | null; decrypting: boolean; error: string } {
  const [plainUrl, setPlainUrl] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function run() {
      if (!signedUrl || !enabled || plainUrl || decrypting) return;
      setDecrypting(true);
      setError("");
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const cipherBlob = await res.blob();
        const plainBlob = await decrypt(cipherBlob, iv);
        const typedBlob = new Blob([plainBlob], {
          type: mimeType || plainBlob.type || "application/octet-stream",
        });
        createdUrl = URL.createObjectURL(typedBlob);
        if (!cancelled) setPlainUrl(createdUrl);
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

  return { plainUrl, decrypting, error };
}
