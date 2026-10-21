import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { Radio } from "@/components/controls";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { Callout, IconTile, ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius } from "@/theme";

type Timing = "now" | "after_verification";

const AVATAR_COLORS = Object.values(palette.category);

export default function FolderAccess() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { folders } = useVaultData();
  const folder = folders?.find((row) => row.id === id);
  const updateGrant = useAuditedMutation(api.folders.updateGrant);
  const revokeGrant = useAuditedMutation(api.folders.revokeGrant);
  const [editing, setEditing] = useState<{
    grantId: Id<"folder_grants">;
    name: string;
    timing: Timing;
  } | null>(null);

  function revoke(grantId: Id<"folder_grants">, name: string) {
    Alert.alert(
      t("folders.revokeTitle", { name }),
      t("folders.revokeBody", { name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("folders.revoke"),
          style: "destructive",
          onPress: () =>
            void revokeGrant({ grantId }).catch(() =>
              Alert.alert(t("common.genericError")),
            ),
        },
      ],
    );
  }

  async function saveTiming() {
    if (!editing) return;
    const { grantId, timing } = editing;
    setEditing(null);
    await updateGrant({ grantId, timing }).catch(() =>
      Alert.alert(t("common.genericError")),
    );
  }

  return (
    <Screen
      header={
        <NavBar
          title={t("folders.accessTitle")}
          onBack={router.back}
          right={<LanguageDropdown />}
        />
      }
      gap={14}
    >
      <Text variant="h1">{t("folders.accessTitle")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("folders.accessBody")}
      </Text>
      <ListRow
        icon="folder"
        title={folder?.name ?? t("folders.title")}
        description={t("folders.itemsCount", { n: folder?.itemCount ?? 0 })}
        onPress={router.back}
      />
      <Text variant="label">{t("folders.peopleWithAccess")}</Text>
      {(folder?.grants ?? []).length === 0 ? (
        <Text variant="body-sm" color="text.muted">
          {t("folders.nobodyYet")}
        </Text>
      ) : null}
      {(folder?.grants ?? []).map((grant, index) => {
        const now = grant.timing === "now";
        return (
          <View
            key={grant.grantId}
            style={[
              styles.card,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor:
                      AVATAR_COLORS[index % AVATAR_COLORS.length],
                  },
                ]}
              >
                <Text variant="label" color="text.inverse">
                  {grant.contactName.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text variant="label">{grant.contactName}</Text>
                <Text variant="body-sm" color="text.muted">
                  {now
                    ? t("folders.availableNow")
                    : t("folders.afterVerification")}
                </Text>
              </View>
              <StatusChip
                label={now ? t("folders.activeNow") : t("folders.scheduled")}
                tone={now ? "success" : "warning"}
              />
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setEditing({
                    grantId: grant.grantId,
                    name: grant.contactName,
                    timing: grant.timing,
                  })
                }
                style={[styles.small, { borderColor: colors["border.strong"] }]}
              >
                <Text variant="body-sm-strong">{t("folders.edit")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => revoke(grant.grantId, grant.contactName)}
                style={[styles.small, { borderColor: colors["action.danger"] }]}
              >
                <Text variant="body-sm-strong" color="action.danger">
                  {t("folders.revoke")}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Button
        variant="secondary"
        label={`+  ${t("folders.addPerson")}`}
        onPress={() =>
          router.push({ pathname: "/folder/[id]/share", params: { id } })
        }
      />
      <View style={[styles.explain, { backgroundColor: colors["bg.info"] }]}>
        <IconTile icon="folder" size={36} background={colors["bg.surface"]} />
        <View style={styles.flex}>
          <Text variant="label">{t("folders.timingLaterTitle")}</Text>
          <Text variant="body-sm" color="text.muted">
            {t("folders.timingLaterBody")}
          </Text>
        </View>
      </View>
      <Callout icon="info" text={t("folders.revokeNote")} />

      <BottomSheet
        visible={editing !== null}
        onDismiss={() => setEditing(null)}
        title={t("folders.editTitle", { name: editing?.name ?? "" })}
      >
        <Radio
          selected={editing?.timing === "now"}
          onPress={() =>
            setEditing((current) => current && { ...current, timing: "now" })
          }
          label={t("folders.timingNowTitle")}
          description={t("folders.timingNowBody")}
        />
        <Radio
          selected={editing?.timing === "after_verification"}
          onPress={() =>
            setEditing(
              (current) =>
                current && { ...current, timing: "after_verification" },
            )
          }
          label={t("folders.timingLaterTitle")}
          description={t("folders.timingLaterBody")}
        />
        <Button label={t("capture.save")} onPress={() => void saveTiming()} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { gap: 12, padding: 14, borderWidth: 1, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: 8 },
  small: {
    height: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  explain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
  },
});
