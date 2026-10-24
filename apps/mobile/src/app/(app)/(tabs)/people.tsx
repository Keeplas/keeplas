import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { IconTile, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius } from "@/theme";

const AVATAR_COLORS = Object.values(palette.category);

/**
 * M06-1 Trusted people: every contact is a trust contact. They help recover
 * the account, confirm a death, and receive the items shared with them.
 */
export default function People() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const revoke = useAuditedMutation(api.trusted_contacts.revokeContact);
  const resend = useAuditedMutation(api.trusted_contacts.resendInvitation);
  const ready = (contacts ?? []).filter(
    (contact) => contact.invitationStatus === "accepted",
  ).length;

  function confirm(
    title: string,
    body: string,
    action: string,
    run: () => Promise<unknown>,
  ) {
    Alert.alert(title, body, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: action,
        style: "destructive",
        onPress: () =>
          void run().catch(() =>
            toast({ variant: "error", title: t("common.genericError") }),
          ),
      },
    ]);
  }

  function replace(contactId: Id<"trusted_contacts">, name: string) {
    confirm(
      t("people.replaceTitle", { name }),
      t("people.replaceBody", { name }),
      t("people.replace"),
      async () => {
        await revoke({ contactId });
        router.push("/people/add");
      },
    );
  }

  function more(
    contactId: Id<"trusted_contacts">,
    name: string,
    invited: boolean,
  ) {
    Alert.alert(name, undefined, [
      {
        text: t("people.editTitle"),
        onPress: () =>
          router.push({ pathname: "/people/edit", params: { id: contactId } }),
      },
      ...(invited
        ? [
            {
              text: t("people.resend"),
              onPress: () =>
                void resend({ contactId })
                  .then(() =>
                    toast({ variant: "success", title: t("people.resent") }),
                  )
                  .catch(() =>
                    toast({
                      variant: "error",
                      title: t("common.genericError"),
                    }),
                  ),
            },
          ]
        : []),
      {
        text: t("people.remove"),
        style: "destructive" as const,
        onPress: () =>
          confirm(
            t("people.removeTitle", { name }),
            t("people.removeBody", { name }),
            t("people.remove"),
            () => revoke({ contactId }),
          ),
      },
      { text: t("common.cancel"), style: "cancel" as const },
    ]);
  }

  return (
    <Screen header={<AppHeader right={<LanguageDropdown />} />} gap={14}>
      <Text variant="h1">{t("people.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("people.body")}
      </Text>
      <View style={styles.ready}>
        <IconTile icon="people" size={48} />
        <View style={styles.flex}>
          <Text variant="h3">{t("people.ready", { n: ready })}</Text>
          <Text variant="body-sm" color="text.muted">
            {t("people.readyBody")}
          </Text>
        </View>
      </View>
      {(contacts ?? []).map((contact, index) => {
        const invited = contact.invitationStatus === "pending";
        return (
          <View
            key={contact._id}
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
                  {contact.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text variant="label">{contact.name}</Text>
                <Text variant="body-sm" color="text.muted">
                  {contact.email ?? contact.phoneNumber ?? ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={contact.name}
                hitSlop={10}
                onPress={() => more(contact._id, contact.name, invited)}
              >
                <Icon name="more" size={20} color="text.muted" />
              </Pressable>
            </View>
            <View style={styles.footer}>
              <StatusChip
                label={t(`people.status.${contact.invitationStatus}`)}
                tone={invited ? "warning" : "success"}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => replace(contact._id, contact.name)}
                style={[
                  styles.replace,
                  { borderColor: colors["border.strong"] },
                ]}
              >
                <Text variant="body-sm-strong">{t("people.replace")}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Button
        variant="secondary"
        label={t("people.addTrust")}
        onPress={() => router.push("/people/add")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  ready: { flexDirection: "row", alignItems: "center", gap: 14 },
  card: { gap: 12, padding: 14, borderWidth: 1, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replace: {
    height: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
});
