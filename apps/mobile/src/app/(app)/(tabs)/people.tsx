import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { SectionHeader } from "@/components/rows";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/** M06-1 / M06-3 and M03-1: contacts and folders shared with this user. */
export default function People() {
  const router = useRouter();
  const { t } = useI18n();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const shared = useQuery(api.folders.sharedWithMe);

  return (
    <Screen header={<AppHeader />}>
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text variant="h1">{t("people.title")}</Text>
          <Text color="text.muted">{t("people.body")}</Text>
        </View>
        <Button
          label={t("people.add")}
          onPress={() => router.push("/people/add")}
          style={styles.add}
        />
      </View>
      <SectionHeader title={t("people.trusted")} />
      {(contacts ?? []).map((contact) => (
        <ListRow
          key={contact._id}
          icon="user-circle"
          title={contact.name}
          description={contact.email ?? contact.phoneNumber ?? ""}
          trailing={
            <StatusChip
              label={t(`people.status.${contact.invitationStatus}`)}
              tone={
                contact.invitationStatus === "accepted" ? "success" : "warning"
              }
            />
          }
        />
      ))}
      {contacts?.length === 0 ? (
        <Text color="text.muted">{t("people.empty")}</Text>
      ) : null}
      <SectionHeader title={t("people.sharedWithMe")} />
      {(shared ?? []).map((folder) => (
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
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, gap: 4 },
  add: { height: 42, paddingHorizontal: 14 },
});
