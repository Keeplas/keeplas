import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { wrapBytes, wrapDek } from "@keeplas/crypto/kem";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Chip } from "@/components/rows";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

export default function ShareFolder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folderId = id as Id<"folders">;
  const router = useRouter();
  const { t } = useI18n();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const { folders, itemKey } = useVaultData();
  const folder = folders?.find((row) => row.id === id);
  const [selected, setSelected] = useState<Id<"trusted_contacts"> | null>(null);
  const [timing, setTiming] = useState<"now" | "after_verification">("now");
  const grant = useAuditedMutation(api.folders.grant);
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);

  async function share() {
    const contact = contacts?.find((row) => row._id === selected);
    if (!contact || !folder?.name) return;
    try {
      const publicKey = await requireVerifiedKey(
        contactKeyMaterial(contact),
        (contactId, fingerprint) =>
          pin({ contactId: contactId as Id<"trusted_contacts">, fingerprint }),
      );
      const itemKeys = await Promise.all(
        (rawItems ?? [])
          .filter((item) => item.folderId === id)
          .map(async (item) => {
            const dek = await itemKey(item);
            return {
              itemId: item._id,
              wrappedDek: await wrapDek(dek, publicKey),
            };
          }),
      );
      await grant({
        folderId,
        contactId: contact._id,
        timing,
        sealedName: await wrapBytes(
          new TextEncoder().encode(folder.name),
          publicKey,
        ),
        itemKeys,
      });
      router.back();
    } catch (error) {
      Alert.alert(
        t("common.genericError"),
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  return (
    <Screen
      header={<NavBar title={t("folders.share")} onBack={router.back} />}
      footer={
        <Button
          label={t("folders.share")}
          onPress={() => void share()}
          disabled={!selected}
        />
      }
    >
      <Text variant="h1">
        {t("folders.shareTitle", { name: folder?.name ?? "" })}
      </Text>
      {(contacts ?? [])
        .filter((contact) => contact.invitationStatus === "accepted")
        .map((contact) => (
          <ListRow
            key={contact._id}
            icon="user-circle"
            title={contact.name}
            trailing={
              <Chip
                label={
                  selected === contact._id
                    ? t("folders.selected")
                    : t("folders.select")
                }
                selected={selected === contact._id}
                onPress={() => setSelected(contact._id)}
              />
            }
          />
        ))}
      <Text variant="label">{t("folders.when")}</Text>
      <Chip
        label={t("folders.timing.now")}
        selected={timing === "now"}
        onPress={() => setTiming("now")}
      />
      <Chip
        label={t("folders.timing.after_verification")}
        selected={timing === "after_verification"}
        onPress={() => setTiming("after_verification")}
      />
    </Screen>
  );
}
