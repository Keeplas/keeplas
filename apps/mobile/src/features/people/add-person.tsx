import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import { isValidEmail, normalizeEmail } from "@keeplas/backend/lib/email";

import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { PhoneInput } from "@/components/phone-input";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { errorText } from "@/lib/errors";
import { formatPhone } from "@/lib/phone";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius } from "@/theme";

/**
 * M06-2 Add trusted person: details, then what they can do. Mounted from
 * People and from setup (M01-5), so it returns with `router.back()`.
 */
export function AddPerson() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const invite = useAuditedMutation(api.trusted_contacts.inviteContact);
  const phone = usePhoneField();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    const emailOk = isValidEmail(email);
    setEmailError(!emailOk);
    const e164 = phone.validate();
    if (!emailOk || !e164) return;
    setPhoneNumber(e164);
  }

  async function send() {
    if (!phoneNumber) return;
    setError(null);
    setBusy(true);
    try {
      await invite({
        name: name.trim(),
        email: normalizeEmail(email),
        phoneNumber,
        role: "friend",
      });
      router.back();
    } catch (failure) {
      const text = errorText(failure);
      setError(
        text.includes("already")
          ? t("people.alreadyInvited")
          : t("people.inviteFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <NavBar
      title={t("people.addTitle")}
      onBack={router.back}
      right={<LanguageDropdown />}
    />
  );

  if (!phoneNumber) {
    return (
      <Screen
        header={header}
        footer={
          <Button
            label={t("people.continue")}
            chevron
            onPress={next}
            disabled={!name.trim() || !email.trim() || !phone.inputProps.value}
          />
        }
      >
        <Text variant="h1">{t("people.addTitle")}</Text>
        <Text variant="body-lg" color="text.muted">
          {t("people.addBody")}
        </Text>
        <TextField
          label={t("people.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          textContentType="name"
        />
        <TextField
          label={t("people.email")}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setEmailError(false);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
        />
        {emailError ? (
          <Text variant="body-sm" color="status.revoked">
            {t("people.emailInvalid")}
          </Text>
        ) : null}
        <Text variant="label">{t("people.phone")}</Text>
        <PhoneInput {...phone.inputProps} onSubmit={next} />
        {phone.inputProps.invalid ? (
          <Text variant="body-sm" color="status.revoked">
            {t("phone.invalid")}
          </Text>
        ) : null}
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
        {t("people.addBody")}
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
              {name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="label" style={styles.flex}>
            {name.trim()}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("people.edit")}
            hitSlop={10}
            onPress={() => setPhoneNumber(null)}
          >
            <Icon name="edit" size={18} color="text.link" />
          </Pressable>
        </View>
        <Detail icon="mail" text={normalizeEmail(email)} />
        <Detail icon="whatsapp" text={formatPhone(phoneNumber)} />
      </View>

      <View style={[styles.summary, { backgroundColor: colors["bg.info"] }]}>
        <Text variant="label">{t("people.permissions")}</Text>
        <Permission icon="check-circle" text={t("people.permRecovery")} />
        <Permission icon="check-circle" text={t("people.permReceive")} />
        <Permission icon="revoke" text={t("people.permNoFiles")} />
      </View>
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
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
});
