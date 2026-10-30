import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { SectionHeader } from "@/components/rows";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { unwrapOwnerDek } from "@/crypto/owner-keys";
import { openTitle } from "@/features/vault/open-sealed-item";
import { useVaultData } from "@/features/vault/vault-data";
import { formatPhone } from "@/lib/phone";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";

/**
 * M03-2 for a released vault: what its owner left me, read-only. Each item
 * DEK is wrapped to my own ML-KEM key, so titles open on this phone.
 */
export default function SharedVault() {
  const params = useLocalSearchParams<{ contactId: string }>();
  const contactId = params.contactId as Id<"trusted_contacts">;
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { ownerKeys } = useVaultData();
  const vault = useQuery(api.memorial.getReleasedVaultForMe, { contactId });
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!vault) return;
    let alive = true;
    void ownerKeys()
      .then((keys) =>
        Promise.all(
          [...vault.introductions, ...vault.items].map(async (item) => {
            try {
              if (item.wrappedDek) {
                const dek = await unwrapOwnerDek(item.wrappedDek, keys);
                return [item._id, await openTitle(item, dek)] as const;
              }
            } catch {
              // Shown with its legacy title, or untitled.
            }
            return [item._id, item.title ?? ""] as const;
          }),
        ),
      )
      .then((opened) => {
        if (alive) setTitles(Object.fromEntries(opened));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [vault, ownerKeys]);

  const titleOf = (itemId: string) => {
    const title = titles[itemId];
    return title === undefined
      ? t("item.decrypting")
      : title || t("capture.untitled");
  };
  const open = (itemId: Id<"vault_items">) =>
    router.push({
      pathname: "/shared/[contactId]/[itemId]",
      params: { contactId, itemId },
    });

  const header = (
    <NavBar
      title={vault ? formatPhone(vault.owner.name) : t("shared.title")}
      onBack={router.back}
      right={<LanguageDropdown />}
    />
  );

  if (vault === undefined) {
    return (
      <Screen header={header} center>
        <ActivityIndicator color={colors["text.muted"]} />
      </Screen>
    );
  }
  if (vault === null) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="lock"
          tone="warning"
          title={t("shared.notReleasedTitle")}
          body={t("shared.notReleasedBody")}
          primary={{ label: t("common.back"), onPress: router.back }}
        />
      </Screen>
    );
  }

  const { items, introductions } = vault;
  // A nameless owner is named by their phone (backend fallback).
  const ownerName = formatPhone(vault.owner.name);
  return (
    <Screen header={header} gap={14}>
      <Text variant="h1">{ownerName}</Text>
      <Callout icon="lock" text={t("shared.readOnly", { name: ownerName })} />
      {introductions.length > 0 ? (
        <SectionHeader title={t("shared.messageFrom", { name: ownerName })} />
      ) : null}
      {introductions.map((intro) => (
        <ListRow
          key={intro._id}
          icon="mail"
          title={titleOf(intro._id)}
          onPress={intro.readable ? () => open(intro._id) : undefined}
        />
      ))}
      <SectionHeader title={t("shared.items", { count: items.length })} />
      {items.length === 0 ? (
        <Text color="text.muted">{t("shared.nothingLeft")}</Text>
      ) : null}
      {items.map((item) => (
        <ListRow
          key={item._id}
          icon="document"
          title={titleOf(item._id)}
          description={item.readable ? undefined : t("shared.unreadable")}
          onPress={item.readable ? () => open(item._id) : undefined}
        />
      ))}
    </Screen>
  );
}
