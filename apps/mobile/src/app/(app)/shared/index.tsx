import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { StateMessage } from "@/components/state-message";
import { IconTile, InfoRow, ListRow, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { VaultSwitch } from "@/features/vault/vault-switch";
import { formatPhone } from "@/lib/phone";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

/** How a vault opens to a trusted contact, in order (help sheet). */
const RELEASE_STEPS = [
  { icon: "activity", key: "checkIn" },
  { icon: "bell", key: "silent" },
  { icon: "people", key: "confirm" },
  { icon: "clock", key: "grace" },
  { icon: "eye", key: "yours" },
] as const;

/**
 * Who chose me: their name and phone, so a homonym or a first name alone is
 * still recognisable. A nameless owner is named by their phone (backend
 * fallback), shown once.
 */
function OwnerIdentity({
  name,
  phone,
  detail,
}: {
  name: string;
  phone: string | null;
  detail?: string;
}) {
  return (
    <View style={styles.text}>
      <Text variant="label">{formatPhone(name)}</Text>
      {phone && phone !== name ? (
        <Text variant="body-sm" color="text.muted">
          {formatPhone(phone)}
        </Text>
      ) : null}
      {detail ? (
        <Text variant="body-sm" color="text.muted">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * M03-1 Shared with me: the people who chose me as a trusted contact. What
 * they left me opens once their vault is released to me.
 */
export default function SharedWithMe() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  const [helpOpen, setHelpOpen] = useState(false);

  const open = (contactId: Id<"trusted_contacts">) =>
    router.push({ pathname: "/shared/[contactId]", params: { contactId } });

  return (
    <Screen header={<AppHeader right={<LanguageDropdown />} />} gap={14}>
      <Text variant="h1">{t("shared.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("shared.body")}
      </Text>
      <VaultSwitch active="shared" />
      {vaults?.length === 0 ? (
        <StateMessage
          icon="inbox"
          tone="info"
          title={t("shared.emptyTitle")}
          body={t("shared.emptyBody")}
        />
      ) : null}
      {(vaults ?? []).map((vault) =>
        vault.released ? (
          <View
            key={vault._id}
            style={[
              styles.card,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => open(vault._id)}
              style={styles.row}
            >
              <IconTile icon="folder" size={44} />
              <OwnerIdentity
                name={vault.ownerName}
                phone={vault.ownerPhone}
                detail={
                  vault.releasedItemCount === 1
                    ? t("shared.oneItem")
                    : t("shared.items", { n: vault.releasedItemCount })
                }
              />
              <Icon name="chevron-right" size={20} color="text.muted" />
            </Pressable>
            <Button
              label={t("shared.accessNow")}
              onPress={() => open(vault._id)}
            />
          </View>
        ) : (
          <View
            key={vault._id}
            style={[styles.card, { backgroundColor: colors["bg.warm"] }]}
          >
            <View style={styles.row}>
              <IconTile
                icon="lock"
                size={44}
                background={colors["bg.subtle"]}
              />
              <OwnerIdentity
                name={vault.ownerName}
                phone={vault.ownerPhone}
                detail={t("shared.trusted")}
              />
            </View>
            <Text variant="body-sm" color="text.muted">
              {vault.confirmationThreshold === 1
                ? t("shared.laterOne", { name: formatPhone(vault.ownerName) })
                : t("shared.later", {
                    name: formatPhone(vault.ownerName),
                    n: vault.confirmationThreshold,
                  })}
            </Text>
          </View>
        ),
      )}
      <ListRow
        icon="help"
        title={t("shared.help.link")}
        onPress={() => setHelpOpen(true)}
      />
      <BottomSheet
        visible={helpOpen}
        onDismiss={() => setHelpOpen(false)}
        title={t("shared.help.title")}
      >
        <View style={styles.steps}>
          {RELEASE_STEPS.map((step) => (
            <InfoRow
              key={step.key}
              leading={<IconTile icon={step.icon} size={36} iconSize={20} />}
              title={t(`shared.help.${step.key}`)}
              description={t(`shared.help.${step.key}Body`)}
            />
          ))}
        </View>
        <Note icon="lock" text={t("shared.help.note")} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  steps: { gap: 16, paddingVertical: 6 },
});
