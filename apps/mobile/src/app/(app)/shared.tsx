import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { unwrapBytes } from "@keeplas/crypto/kem";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useVaultData } from "@/features/vault/vault-data";
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
  const { ownerKeys } = useVaultData();
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!shared?.length) return;
    let alive = true;
    void ownerKeys()
      .then((keys) =>
        Promise.all(
          shared.map(async (grant) => {
            try {
              const name = new TextDecoder().decode(
                await unwrapBytes(grant.sealedName, keys.secretKey),
              );
              return [grant.grantId, name] as const;
            } catch {
              return null;
            }
          }),
        ),
      )
      .then((opened) => {
        if (!alive) return;
        const next: Record<string, string> = {};
        for (const entry of opened) {
          if (entry?.[1]) next[entry[0]] = entry[1];
        }
        setNames(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [shared, ownerKeys]);

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
        const title =
          names[folder.grantId] ?? t("shared.folderFrom", { name: owner });
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
