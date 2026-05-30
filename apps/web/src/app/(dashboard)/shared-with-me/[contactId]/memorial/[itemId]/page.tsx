"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Loader, RichTextEditor } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { useTranslations } from "@/lib/i18n";
import { VaultLinkList } from "@/components/vault-link-list";
import { MemorialItemAttachments } from "@/components/memorial-item-attachments";
import { useMemorialCrypto } from "@/lib/use-memorial-crypto";
import { normalizeContentForRichText } from "@/lib/normalize-content-for-rich-text";
import { getCategoryConfig } from "@/lib/vault-categories";

export default function MemorialItemPage() {
  const t = useTranslations("sharedWithMe");
  const params = useParams();
  const contactId = params.contactId as Id<"trusted_contacts">;
  const itemId = params.itemId as Id<"vault_items">;

  const data = useQuery(api.memorial.getReleasedItemForMe, {
    contactId,
    itemId,
  });
  const { decryptItem, isReady } = useMemorialCrypto();

  const [content, setContent] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    const item = data?.item;
    if (!item || !isReady || content !== null || decrypting) return;

    (async () => {
      setDecrypting(true);
      try {
        if (!item.readable || !item.wrappedDek) {
          setContent(t("item.decryptFailedLegacy"));
          return;
        }
        const res = await decryptItem({
          wrappedDek: item.wrappedDek,
          encryptedContent: item.encryptedContent,
          encryptedLinks: item.encryptedLinks,
        });
        setContent(res.content);
        setLinks(res.links);
        setDek(res.dek);
      } catch {
        setContent(t("item.decryptFailed"));
      } finally {
        setDecrypting(false);
      }
    })();
  }, [data, isReady, content, decrypting, decryptItem, t]);

  if (data === undefined) return <Loader size="md" />;

  if (data === null) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl">
          <h3 className="text-headline-sm text-primary">
            {t("item.notAvailable.title")}
          </h3>
          <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-md">
            {t("item.notAvailable.description")}
          </p>
          <Link
            href="/shared-with-me"
            className="text-body-md font-bold text-secondary hover:underline mt-4"
          >
            {t("memorial.back")}
          </Link>
        </div>
      </div>
    );
  }

  const { owner, item } = data;
  const category = getCategoryConfig(item.category);

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/shared-with-me/${contactId}/memorial`}
        className="text-label-md text-on-surface-variant hover:text-primary"
      >
        ← {t("item.backToMemorial", { ownerName: owner.name })}
      </Link>

      <h1 className="text-headline-lg text-primary mt-3 mb-1">{item.title}</h1>
      <p className="text-body-md text-on-surface-variant mb-8">
        {t("item.categoryInMemory", {
          category: category.label,
          ownerName: owner.name,
        })}
      </p>

      {content === null ? (
        <div className="flex items-center gap-3 text-body-md text-on-surface-variant">
          <Loader size="sm" /> {t("item.decrypting")}
        </div>
      ) : (
        <div className="space-y-8">
          <RichTextEditor
            readOnly
            value={normalizeContentForRichText(content)}
          />

          {links.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-label-md text-secondary">
                {t("item.linkedUrls")}
              </h2>
              <VaultLinkList urls={links} />
            </section>
          )}

          {dek && (
            <MemorialItemAttachments
              contactId={contactId}
              itemId={item._id}
              itemDek={dek}
            />
          )}
        </div>
      )}
    </div>
  );
}
