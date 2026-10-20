import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { SectionHeader } from "@/components/rows";
import { Screen } from "@/components/screen";
import { IconTile, ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, type SemanticToken } from "@/theme";

/** M06-1 Trusted people: trust contacts and beneficiaries. */
export default function People() {
  const router = useRouter();
  const { t } = useI18n();
  const shared = useQuery(api.folders.sharedWithMe);

  return (
    <Screen header={<AppHeader right={<LanguageDropdown />} />} gap={14}>
      <Text variant="h1">{t("people.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("people.body")}
      </Text>
      <RoleCard
        background="bg.info"
        title={t("people.trustTitle")}
        body={t("people.trustBody")}
        lineIcon="user"
        line={t("people.trustLine")}
        action={t("people.manageTrust")}
        onPress={() => router.push("/people/trust-contacts")}
      />
      <RoleCard
        background="bg.warm"
        title={t("people.beneficiariesTitle")}
        body={t("people.beneficiariesBody")}
        lineIcon="document"
        line={t("people.beneficiariesLine")}
        action={t("people.manageBeneficiaries")}
        onPress={() => router.push("/people/beneficiaries")}
      />
      {shared && shared.length > 0 ? (
        <>
          <SectionHeader title={t("people.sharedWithMe")} />
          {shared.map((folder) => (
            <ListRow
              key={folder.grantId}
              icon="folder"
              title={folder.ownerName || t("people.sharedFolder")}
              description={
                folder.available
                  ? t("people.items", { n: folder.itemCount })
                  : t("people.notAvailable")
              }
              trailing={
                <StatusChip
                  label={
                    folder.available ? t("people.available") : t("people.later")
                  }
                  tone={folder.available ? "success" : "neutral"}
                />
              }
              onPress={
                folder.available
                  ? () =>
                      router.push({
                        pathname: "/shared-folder/[id]",
                        params: { id: folder.grantId },
                      })
                  : undefined
              }
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function RoleCard({
  background,
  title,
  body,
  lineIcon,
  line,
  action,
  onPress,
}: {
  background: SemanticToken;
  title: string;
  body: string;
  lineIcon: IconName;
  line: string;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors[background] }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.row}
      >
        <IconTile icon="people" size={48} background={colors["bg.surface"]} />
        <View style={styles.text}>
          <Text variant="label">{title}</Text>
          <Text variant="body-sm" color="text.muted">
            {body}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="text.muted" />
      </Pressable>
      <View style={styles.line}>
        <Icon name={lineIcon} size={16} color="text.primary" />
        <Text variant="body-sm">{line}</Text>
      </View>
      <Button label={action} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
});
