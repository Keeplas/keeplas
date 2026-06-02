import { useEffect, useState } from "react";
import { Loader, RichTextEditor } from "@keeplas/ui";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { useTranslations } from "@/lib/i18n";
import { MemorialItemAttachments } from "@/components/memorial-item-attachments";
import { useMemorialCrypto } from "@/lib/use-memorial-crypto";
import { normalizeContentForRichText } from "@/lib/normalize-content-for-rich-text";

export interface MemorialIntroductionData {
  _id: Id<"vault_items">;
  title: string;
  encryptedContent: string;
  encryptedLinks: string | null;
  wrappedDek: string | null;
  readable: boolean;
}

/**
 * Renders a single release introduction (welcome message) decrypted on-device.
 * Mirrors the memorial item page's decryption flow (useMemorialCrypto +
 * MemorialItemAttachments) but inline — these cards stack above the items
 * grid on the memorial vault landing.
 */
export function MemorialIntroductionCard({
  contactId,
  intro,
}: {
  contactId: Id<"trusted_contacts">;
  intro: MemorialIntroductionData;
}) {
  const t = useTranslations("sharedWithMe");
  const { decryptItem, isReady } = useMemorialCrypto();
  const [content, setContent] = useState<string | null>(null);
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (!isReady || content !== null || decrypting) return;
    (async () => {
      setDecrypting(true);
      try {
        if (!intro.readable || !intro.wrappedDek) {
          setContent(t("introCard.decryptFailedLegacy"));
          return;
        }
        const res = await decryptItem({
          wrappedDek: intro.wrappedDek,
          encryptedContent: intro.encryptedContent,
          encryptedLinks: intro.encryptedLinks,
        });
        setContent(res.content);
        setDek(res.dek);
      } catch {
        setContent(t("introCard.decryptFailed"));
      } finally {
        setDecrypting(false);
      }
    })();
  }, [intro, isReady, content, decrypting, decryptItem, t]);

  return (
    <article className="space-y-5">
      {intro.title && (
        <h3 className="text-headline-sm text-primary">{intro.title}</h3>
      )}
      {content === null ? (
        <div className="flex items-center gap-3 text-body-md text-on-surface-variant">
          <Loader size="sm" /> {t("introCard.decrypting")}
        </div>
      ) : (
        <>
          <RichTextEditor
            readOnly
            value={normalizeContentForRichText(content)}
          />
          {dek && (
            <MemorialItemAttachments
              contactId={contactId}
              itemId={intro._id}
              itemDek={dek}
            />
          )}
        </>
      )}
    </article>
  );
}
