import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

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

/** M03-1 Shared with me: folders trusted people share with this user. */
export default function SharedWithMe() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const shared = useQuery(api.folders.sharedWithMe);

  const open = (grantId: string) =>
    router.push({ pathname: "/shared-folder/[id]", params: { id: grantId } });

  return (
    <Screen header={<AppHeader right={<LanguageDropdown />} />} gap={14}>
      <Text variant="h1">{t("shared.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("shared.body")}
      </Text>
      <VaultSwitch active="shared" />
      {shared?.length === 0 ? (
        <StateMessage
          icon="people"
          tone="info"
          title={t("shared.emptyTitle")}
          body={t("shared.emptyBody")}
        />
      ) : null}
      {(shared ?? []).map((folder) => {
        const owner = folder.ownerName || t("shared.someone");
        const title = t("shared.folderFrom", { name: owner });
        return folder.available ? (
          <View
            key={folder.grantId}
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
              onPress={() => open(folder.grantId)}
              style={styles.row}
            >
              <IconTile icon="folder" size={44} />
              <View style={styles.text}>
                <Text variant="label">{title}</Text>
                <Text variant="body-sm" color="text.muted">
                  {t("shared.filesBy", { n: folder.itemCount, name: owner })}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="text.muted" />
            </Pressable>
            <Button
              label={t("shared.accessNow")}
              onPress={() => open(folder.grantId)}
            />
          </View>
        ) : (
          <View
            key={folder.grantId}
            style={[styles.card, { backgroundColor: colors["bg.warm"] }]}
          >
            <View style={styles.row}>
              <IconTile
                icon="lock"
                size={44}
                background={colors["bg.subtle"]}
              />
              <View style={styles.text}>
                <Text variant="label">{title}</Text>
                <Text variant="body-sm" color="text.muted">
                  {t("shared.sharedBy", { name: owner })}
                </Text>
              </View>
            </View>
            <Text variant="body-sm" color="text.muted">
              {t("shared.later")}
            </Text>
          </View>
        );
      })}
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
