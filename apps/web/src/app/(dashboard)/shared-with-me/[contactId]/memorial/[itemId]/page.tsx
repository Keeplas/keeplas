"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Loader, RichTextEditor } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { VaultLinkList } from "@/components/vault-link-list";
import { MemorialItemAttachments } from "@/components/memorial-item-attachments";
import { useMemorialCrypto } from "@/lib/use-memorial-crypto";
import { getCategoryConfig } from "@/lib/vault-categories";

// Legacy items were stored as plain text; new items are TipTap HTML. Wrap plain
// text into a paragraph so newlines survive the rich-text round-trip. (Mirrors
// the owner item page; small enough to keep local — only two call sites today.)
function normalizeContentForRichText(content: string): string {
  if (/^\s*<[a-z!/]/i.test(content)) return content;
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p>${escaped}</p>`;
}

export default function MemorialItemPage() {
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
          setContent(
            "[Unable to decrypt — this item was stored in a legacy format]",
          );
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
        setContent("[Unable to decrypt]");
      } finally {
        setDecrypting(false);
      }
    })();
  }, [data, isReady, content, decrypting, decryptItem]);

  if (data === undefined) return <Loader size="md" />;

  if (data === null) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl">
          <h3 className="text-headline-sm text-primary">Item not available</h3>
          <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-md">
            This item was not released to you.
          </p>
          <Link
            href="/shared-with-me"
            className="text-body-md font-bold text-secondary hover:underline mt-4"
          >
            Back to Shared with me
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
        ← {owner.name}&apos;s memorial vault
      </Link>

      <h1 className="text-headline-lg text-primary mt-3 mb-1">{item.title}</h1>
      <p className="text-body-md text-on-surface-variant mb-8">
        {category.label} · In memory of {owner.name}
      </p>

      {content === null ? (
        <div className="flex items-center gap-3 text-body-md text-on-surface-variant">
          <Loader size="sm" /> Decrypting…
        </div>
      ) : (
        <div className="space-y-8">
          <RichTextEditor
            readOnly
            value={normalizeContentForRichText(content)}
          />

          {links.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-label-md text-secondary">Linked URLs</h2>
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
