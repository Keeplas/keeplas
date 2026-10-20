import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { wrapBytes, wrapDek } from "@keeplas/crypto/kem";

import { Button } from "@/components/button";
import { Checkbox, Radio } from "@/components/controls";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

type Timing = "now" | "after_verification";

/** M06-4 Share content: choose people and timing for one folder. */
export default function ShareFolder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folderId = id as Id<"folders">;
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const { folders, itemKey } = useVaultData();
  const folder = folders?.find((row) => row.id === id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [timing, setTiming] = useState<Timing>("after_verification");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grant = useAuditedMutation(api.folders.grant);
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);

  const granted = new Set(folder?.grants.map((g) => g.contactId) ?? []);
  const live = (contacts ?? []).filter(
    (contact) =>
      contact.invitationStatus === "accepted" ||
      contact.invitationStatus === "pending",
  );
  const ready = live.filter(
    (contact) =>
      contact.invitationStatus === "accepted" && !granted.has(contact._id),
  );

  function toggle(contactId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(contactId);
      else next.delete(contactId);
      return next;
    });
  }

  async function share() {
    if (!folder) return;
    if (!folder.name) return setError(t("folders.nameMissing"));
    setBusy(true);
    setError(null);
    const items = (rawItems ?? []).filter((item) => item.folderId === id);
    for (const contact of ready.filter((c) => selected.has(c._id))) {
      try {
        const publicKey = await requireVerifiedKey(
          contactKeyMaterial(contact),
          (contactId, fingerprint) =>
            pin({
              contactId: contactId as Id<"trusted_contacts">,
              fingerprint,
            }),
        );
        const itemKeys = await Promise.all(
          items.map(async (item) => ({
            itemId: item._id,
            wrappedDek: await wrapDek(await itemKey(item), publicKey),
          })),
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
      } catch {
        setBusy(false);
        return setError(t("folders.shareFailed", { name: contact.name }));
      }
    }
    setBusy(false);
    router.back();
  }

  const reason =
    live.length === 0
      ? t("folders.nobody")
      : ready.length === 0
        ? t("folders.noneAccepted")
        : selected.size === 0
          ? t("folders.noneSelected")
          : null;

  return (
    <Screen
      header={
        <NavBar
          title={t("folders.shareScreenTitle")}
          onBack={router.back}
          right={<LanguageDropdown />}
        />
      }
      footer={
        <View style={styles.footer}>
          {(error ?? reason) ? (
            <Text
              variant="body-sm"
              color={error ? "status.revoked" : "text.muted"}
              align="center"
            >
              {error ?? reason}
            </Text>
          ) : null}
          <Button
            label={t("folders.create")}
            onPress={() => void share()}
            loading={busy}
            disabled={selected.size === 0}
          />
        </View>
      }
      gap={14}
    >
      <Text variant="h1">{t("folders.shareScreenTitle")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("folders.shareScreenBody")}
      </Text>
      <ListRow
        icon="folder"
        title={folder?.name ?? t("folders.title")}
        description={t("folders.itemsCount", { n: folder?.itemCount ?? 0 })}
        onPress={() =>
          router.push({ pathname: "/folder/[id]", params: { id: folderId } })
        }
      />

      <Text variant="label">{t("folders.people")}</Text>
      {live.map((contact) => {
        const has = granted.has(contact._id);
        const pending = contact.invitationStatus === "pending";
        return (
          <Checkbox
            key={contact._id}
            checked={has || selected.has(contact._id)}
            disabled={has || pending}
            onChange={(checked) => toggle(contact._id, checked)}
            label={contact.name}
            description={
              has
                ? t("folders.hasAccess")
                : pending
                  ? t("folders.waiting")
                  : (contact.email ?? contact.phoneNumber ?? "")
            }
          />
        );
      })}
      <Button
        variant="secondary"
        label={`+  ${t("folders.addPerson")}`}
        onPress={() => router.push("/people/add")}
      />

      <Text variant="label">{t("folders.scope")}</Text>
      <View
        style={[
          styles.scope,
          {
            backgroundColor: colors["bg.surface"],
            borderColor: colors["border.strong"],
          },
        ]}
      >
        <Icon name="folder" size={18} color="text.primary" />
        <Text variant="body">{t("folders.scopeFolder")}</Text>
      </View>
      <Text variant="body-sm" color="text.muted">
        {t("folders.scopeHint")}
      </Text>

      <Text variant="label">{t("folders.timingTitle")}</Text>
      <Radio
        selected={timing === "now"}
        onPress={() => setTiming("now")}
        label={t("folders.timingNowTitle")}
        description={t("folders.timingNowBody")}
      />
      <Radio
        selected={timing === "after_verification"}
        onPress={() => setTiming("after_verification")}
        label={t("folders.timingLaterTitle")}
        description={t("folders.timingLaterBody")}
      />
      {timing === "after_verification" ? (
        <Callout icon="info" text={t("folders.timingLaterBody")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
  scope: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
