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
import { StateMessage } from "@/components/state-message";
import { IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { VaultSwitch } from "@/features/vault/vault-switch";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

/**
 * M03-1 Shared with me: the people who chose me as a trusted contact. What
 * they left me opens once their vault is released to me.
 */
export default function SharedWithMe() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);

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
              <View style={styles.text}>
                <Text variant="label">{vault.ownerName}</Text>
                <Text variant="body-sm" color="text.muted">
                  {vault.releasedItemCount === 1
                    ? t("shared.oneItem")
                    : t("shared.items", { n: vault.releasedItemCount })}
                </Text>
              </View>
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
              <View style={styles.text}>
                <Text variant="label">{vault.ownerName}</Text>
                <Text variant="body-sm" color="text.muted">
                  {t("shared.trusted")}
                </Text>
              </View>
            </View>
            <Text variant="body-sm" color="text.muted">
              {t("shared.later")}
            </Text>
          </View>
        ),
      )}
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
});
