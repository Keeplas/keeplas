import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Spinner } from "@keeplas/ui";
import { ImageLightbox } from "@/components/image-lightbox";
import { useDecryptedAttachmentUrl } from "@/lib/use-decrypted-attachment-url";

type AttachmentFile = Doc<"vault_item_files">;

/**
 * Square, decrypt-on-mount image thumbnail for the attachment grid. Shares the
 * decrypt lifecycle with the full-width attachment cards via
 * {@link useDecryptedAttachmentUrl}; the caller injects the signed-URL query
 * result, the key-bound `decrypt` fn and the `enabled` gate (which differ
 * between the vault and memorial views). Clicking opens the existing lightbox,
 * which also carries the download action since the cell has no header.
 */
export function AttachmentThumbnail({
  file,
  signedUrl,
  decrypt,
  enabled,
  errorFallback,
  enlargeLabel,
  closeLabel,
  downloadLabel,
}: {
  file: AttachmentFile;
  signedUrl: string | null | undefined;
  decrypt: (cipher: Blob, iv: string) => Promise<Blob>;
  enabled: boolean;
  errorFallback: string;
  enlargeLabel: string;
  closeLabel: string;
  downloadLabel: string;
}) {
  const { plainUrl, decrypting, error } = useDecryptedAttachmentUrl({
    signedUrl,
    iv: file.iv,
    mimeType: file.mimeType,
    decrypt,
    enabled,
    errorFallback,
  });

  if (plainUrl) {
    return (
      <ImageLightbox
        src={plainUrl}
        alt={file.name}
        enlargeLabel={enlargeLabel}
        closeLabel={closeLabel}
        triggerClassName="aspect-square"
        imgClassName="h-full w-full max-h-none object-cover"
        downloadUrl={plainUrl}
        downloadName={file.name}
        downloadLabel={downloadLabel}
      />
    );
  }

  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-surface-container-low p-3 text-center">
      {error ? (
        <p className="text-label-sm text-error">{error}</p>
      ) : decrypting ? (
        <Spinner size="sm" />
      ) : null}
    </div>
  );
}
