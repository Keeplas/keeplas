import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import { formatSenderIdentity } from "@keeplas/backend/lib/identity";

import { Button } from "@/components/button";
import { ErrorText } from "@/components/error-text";
import { Icon, type IconName } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { keepUnlockedWhile } from "@/lib/auto-lock";
import { formatPhone, toE164, type CountryCode } from "@/lib/phone";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius } from "@/theme";
import type { ContactPhone } from "./device-contact";
import { inviteErrorKey } from "./invite-error";
import { PersonFields, usePersonForm } from "./person-form";
import { pickContact } from "./pick-contact";

/**
 * M06-2 Add trusted person: details, then what they can do. Mounted from
 * People and from setup (M01-5), so it returns with `router.back()`.
 * The details can be prefilled from a contact picked in the phone's
 * address book (no contacts permission on either platform), then edited.
 * The review step says what Keeplas sends them, on which channels.
 */
export function AddPerson() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const viewer = useViewer();
  const invite = useAuditedMutation(api.trusted_contacts.inviteContact);
  const form = usePersonForm("add-person", () => ({
    name: "",
    email: "",
    phoneCountry: undefined as CountryCode | undefined,
    phoneInput: "",
    // Set once the details are valid: moves to the review step.
    details: null as {
      name: string;
      email?: string;
      phoneNumber: string;
    } | null,
  }));
  const { details } = form.draft;
  const phoneCountry = form.phone.inputProps.country;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phoneChoices, setPhoneChoices] = useState<ContactPhone[]>([]);

  function fillPhone(country: CountryCode, number: string) {
    form.phone.inputProps.onCountryChange(country);
    form.phone.inputProps.onChangeText(number);
    setPhoneChoices([]);
  }

  async function fillFromContacts() {
    // Android opens the contacts app: the vault must not lock meanwhile.
    const picked = await keepUnlockedWhile(() => pickContact(phoneCountry));
    if (!picked) return;
    form.updateDraft({ name: picked.name, email: picked.email });
    form.setEmailError(false);
    const [first] = picked.phones;
    if (picked.phones.length > 1) setPhoneChoices(picked.phones);
    else fillPhone(first?.country ?? phoneCountry, first?.number ?? "");
  }

  function next() {
    const valid = form.validate();
    if (valid) form.updateDraft({ details: valid });
  }

  async function send() {
    if (!details) return;
    setError(null);
    setBusy(true);
    try {
      await invite({ ...details, role: "friend" });
      form.clearDraft();
      router.back();
    } catch (failure) {
      setError(t(inviteErrorKey(failure, "people.inviteFailed")));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <NavBar
      title={t("people.addTitle")}
      onBack={() => {
        form.clearDraft();
        router.back();
      }}
      right={<LanguageDropdown />}
    />
  );

  if (!details) {
    return (
      <Screen
        header={header}
        footer={
          <Button
            label={t("people.continue")}
            chevron
            onPress={next}
            disabled={!form.filled}
          />
        }
      >
        <Text variant="h1">{t("people.addTitle")}</Text>
        <Text variant="body-lg" color="text.muted">
          {t("people.addBody")}
        </Text>
        <Callout icon="shield-check" text={t("people.addWhy")} />
        <Button
          variant="secondary"
          label={t("people.fromContacts")}
          onPress={fillFromContacts}
        />
        <View style={styles.divider}>
          <View
            style={[styles.line, { backgroundColor: colors["border.default"] }]}
          />
          <Text variant="caption" color="text.subtle">
            {t("people.orManual")}
          </Text>
          <View
            style={[styles.line, { backgroundColor: colors["border.default"] }]}
          />
        </View>
        <PersonFields form={form} onSubmit={next} />
        <BottomSheet
          visible={phoneChoices.length > 0}
          onDismiss={() => setPhoneChoices([])}
          title={t("people.whichNumber")}
        >
          <DetailRows
            rows={phoneChoices.map(({ label, country, number }) => {
              const e164 = toE164(country, number);
              return {
                icon: "phone",
                label,
                value: e164 ? formatPhone(e164) : number,
                onPress: () => fillPhone(country, number),
              };
            })}
          />
        </BottomSheet>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <Button label={t("people.sendInvite")} onPress={send} loading={busy} />
      }
    >
      <Text variant="h1">{t("people.addTitle")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t(
          details.email ? "people.invitePreviewEmail" : "people.invitePreview",
          {
            name: details.name,
            inviter: formatSenderIdentity(viewer),
          },
        )}
      </Text>
      <View
        style={[
          styles.person,
          {
            backgroundColor: colors["bg.surface"],
            borderColor: colors["border.default"],
          },
        ]}
      >
        <View style={styles.personRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: palette.category.account },
            ]}
          >
            <Text variant="label" color="text.inverse">
              {details.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="label" style={styles.flex}>
            {details.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("people.edit")}
            hitSlop={10}
            onPress={() => form.updateDraft({ details: null })}
          >
            <Icon name="edit" size={18} color="text.link" />
          </Pressable>
        </View>
        {details.email ? <Detail icon="mail" text={details.email} /> : null}
        <Detail icon="whatsapp" text={formatPhone(details.phoneNumber)} />
      </View>

      <View style={[styles.summary, { backgroundColor: colors["bg.info"] }]}>
        <Text variant="label">{t("people.permissions")}</Text>
        <Permission icon="check-circle" text={t("people.permRecovery")} />
        <Permission icon="check-circle" text={t("people.permReceive")} />
        <Permission icon="revoke" text={t("people.permNoFiles")} />
      </View>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.detail}>
      <Icon name={icon} size={16} color="text.muted" />
      <Text variant="body-sm">{text}</Text>
    </View>
  );
}

function Permission({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.detail}>
      <Icon name={icon} size={16} color="accent" />
      <Text variant="body-sm" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  person: { gap: 10, padding: 14, borderWidth: 1, borderRadius: radius.md },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
  summary: { gap: 10, padding: 14, borderRadius: radius.md },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1 },
});
