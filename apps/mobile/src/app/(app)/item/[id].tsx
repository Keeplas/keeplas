import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { NavBar } from "@/components/nav-bar";
import { DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { decryptText } from "@/crypto/envelope";
import { parseItemMeta } from "@/crypto/item-meta";
import { useVaultData } from "@/features/vault/vault-data";
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { wrapDek } from "@keeplas/crypto/kem";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/** M07-5: decrypted item details; plaintext exists only in component memory. */
export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const { t } = useI18n();
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const files = useQuery(api.vault_items.getItemFiles, { itemId });
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { itemKey, folders } = useVaultData();
  const moveItem = useAuditedMutation(api.folders.moveItem);
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);
  const [opened, setOpened] = useState<{
    title: string;
    note: string;
    category: string;
  }>();

  useEffect(() => {
    if (!raw) return;
    let alive = true;
    void (async () => {
      const key = await itemKey(raw);
      // Legacy rows may miss encryptedTitle/encryptedMeta; fall back to the
      // plaintext columns instead of failing the whole decryption.
      const [title, note, category] = await Promise.all([
        raw.encryptedTitle
          ? decryptText(raw.encryptedTitle, key)
          : (raw.title ?? ""),
        decryptText(raw.encryptedContent, key),
        raw.encryptedMeta
          ? decryptText(raw.encryptedMeta, key).then(
              (meta) => parseItemMeta(meta).category,
            )
          : (raw.category ?? "other"),
      ]);
      if (alive) setOpened({ title, note, category });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [raw, itemKey]);

  async function move(folderId: Id<"folders"> | null) {
    if (!raw) return;
    const folder = folders?.find((candidate) => candidate.id === folderId);
    const dek = await itemKey(raw);
    const recipientKeys = await Promise.all(
      (folder?.grants ?? []).map(async (grant) => {
        const contact = contacts?.find(
          (candidate) => candidate._id === grant.contactId,
        );
        if (!contact) throw new Error("Contact unavailable");
        const publicKey = await requireVerifiedKey(
          contactKeyMaterial(contact),
          (contactId, fingerprint) =>
            pin({
              contactId: contactId as Id<"trusted_contacts">,
              fingerprint,
            }),
        );
        return {
          contactId: contact._id,
          wrappedDek: await wrapDek(dek, publicKey),
        };
      }),
    );
    await moveItem({ itemId, folderId, recipientKeys });
  }

  return (
    <Screen
      header={
        <NavBar title={opened?.title ?? t("item.title")} onBack={router.back} />
      }
    >
      <Text variant="h1">{opened?.title ?? t("item.decrypting")}</Text>
      {opened?.note ? <Text>{opened.note}</Text> : null}
      <DetailRows
        rows={[
          {
            icon: "folder",
            label: t("item.category"),
            value: opened?.category ?? "—",
          },
          {
            icon: "document",
            label: t("item.attachments"),
            value: String(files?.length ?? 0),
          },
        ]}
      />
      <Callout icon="lock" text={t("item.encrypted")} />
      <Text variant="label">{t("folders.move")}</Text>
      <ListRow
        icon="mail"
        title={t("folders.noFolder")}
        onPress={() => void move(null)}
      />
      {(folders ?? []).map((folder) => (
        <ListRow
          key={folder.id}
          icon="folder"
          title={folder.name ?? t("folders.title")}
          onPress={() => void move(folder.id)}
        />
      ))}
    </Screen>
  );
}
