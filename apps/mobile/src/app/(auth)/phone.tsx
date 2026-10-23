import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { LanguageSegment } from "@/components/language";
import { PhoneInput } from "@/components/phone-input";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { errorText, passkeyFailure } from "@/lib/errors";
import { openLegalPage } from "@/lib/legal";
import { attestationReference } from "@/lib/attestation";
import { usePasskeySignIn } from "@/lib/use-passkey-sign-in";
import { usePhoneField } from "@/lib/use-phone-field";
import {
  AttestationFailed,
  useRequestPhoneCode,
  type PhoneIntent,
} from "@/lib/use-request-phone-code";
import { useI18n } from "@/providers/i18n-provider";

const linkStyle = { textDecorationLine: "underline" } as const;

/** M01-1 Set up your account (sign-up) / the same form to sign in. */
export default function PhoneScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const params = useLocalSearchParams<{ intent?: PhoneIntent }>();
  const intent: PhoneIntent = params.intent === "signin" ? "signin" : "signup";
  const phone = usePhoneField();
  const requestCode = useRequestPhoneCode();
  const passkeySignIn = usePasskeySignIn();
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<PhoneIntent | null>(null);

  async function submit() {
    const phoneNumber = phone.validate();
    if (!phoneNumber) return setError(t("phone.invalid"));
    setBusy(true);
    setError(null);
    setSwitchTo(null);
    try {
      await requestCode(phoneNumber, intent);
      router.push({
        pathname: "/verify",
        params: { phone: phoneNumber, intent },
      });
    } catch (err) {
      if (err instanceof AttestationFailed) {
        router.push({
          pathname: "/device-check",
          params: { ref: attestationReference() },
        });
      } else {
        const text = errorText(err);
        setSwitchTo(
          text.includes("already exists")
            ? "signin"
            : text.includes("No account")
              ? "signup"
              : null,
        );
        setError(
          text.includes("already exists")
            ? t("phone.accountExists")
            : text.includes("No account")
              ? t("phone.noAccount")
              : text.includes("Too many")
                ? t("codeErrors.tooManyBody")
                : t("common.genericError"),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // The stage gate moves on once the session opens.
  async function signInWithPasskey() {
    setPasskeyBusy(true);
    setError(null);
    setSwitchTo(null);
    try {
      await passkeySignIn();
    } catch (err) {
      if (passkeyFailure(err) !== null) setError(t("phone.passkeyFailed"));
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <Screen
      decor="branches"
      header={
        <AppHeader
          onBack={router.canGoBack() ? router.back : undefined}
          right={<LanguageSegment />}
        />
      }
    >
      <Text variant="display">
        {t(intent === "signup" ? "phone.title" : "phone.signInTitle")}
      </Text>
      <Text variant="body-lg" color="text.muted">
        {t(intent === "signup" ? "phone.subtitle" : "phone.signInSubtitle")}
      </Text>
      {intent === "signup" ? <RequiredSteps completed={0} /> : null}
      <Text variant="label">{t("phone.label")}</Text>
      <PhoneInput {...phone.inputProps} onSubmit={submit} />
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
      {switchTo ? (
        <Button
          variant="text"
          label={t(
            switchTo === "signup"
              ? "phone.createAccount"
              : "phone.signInInstead",
          )}
          onPress={() => {
            setError(null);
            setSwitchTo(null);
            router.setParams({ intent: switchTo });
          }}
        />
      ) : null}
      <Button label={t("phone.cta")} chevron loading={busy} onPress={submit} />
      {intent === "signup" ? (
        <Text variant="body-sm" color="text.muted" align="center">
          {t("legal.agreeBefore")}
          <Text
            variant="body-sm"
            color="text.link"
            accessibilityRole="link"
            style={linkStyle}
            onPress={() => openLegalPage("terms", language)}
          >
            {t("legal.terms")}
          </Text>
          {t("legal.agreeAnd")}
          <Text
            variant="body-sm"
            color="text.link"
            accessibilityRole="link"
            style={linkStyle}
            onPress={() => openLegalPage("privacy", language)}
          >
            {t("legal.privacy")}
          </Text>
          {t("legal.agreeAfter")}
        </Text>
      ) : null}
      {intent === "signin" ? (
        <Button
          variant="secondary"
          label={t("phone.passkey")}
          loading={passkeyBusy}
          onPress={signInWithPasskey}
        />
      ) : null}
      <Callout icon="shield-check" text={t("phone.reassure")} />
      {intent === "signin" ? (
        <>
          <Button
            variant="text"
            label={t("lostNumber.title")}
            onPress={() => router.push("/lost-number")}
          />
          <Button
            variant="text"
            label={t("phone.emailAccount")}
            onPress={() => router.push("/email")}
          />
        </>
      ) : null}
    </Screen>
  );
}
