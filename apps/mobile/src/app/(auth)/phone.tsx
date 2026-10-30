import { useRef, useState } from "react";
import type { TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { LanguageSegment } from "@/components/language";
import { PhoneInput } from "@/components/phone-input";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { errorText } from "@/lib/errors";
import { failWhenOffline, OfflineError } from "@/lib/offline";
import { openSitePage } from "@/lib/site";
import { attestationReference } from "@/lib/attestation";
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
  const phoneInput = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const requestCode = useRequestPhoneCode();
  const convex = useConvex();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<PhoneIntent | null>(null);

  async function submit() {
    const firstName = name.trim();
    if (intent === "signup" && !firstName)
      return setError(t("phone.nameRequired"));
    const phoneNumber = phone.validate();
    if (!phoneNumber) return setError(t("phone.invalid"));
    setBusy(true);
    setError(null);
    setSwitchTo(null);
    try {
      await failWhenOffline(requestCode(phoneNumber, intent), convex);
      router.push({
        pathname: "/verify",
        params: {
          phone: phoneNumber,
          intent,
          ...(intent === "signup" ? { name: firstName } : {}),
        },
      });
    } catch (err) {
      if (err instanceof AttestationFailed && err.transient) {
        setError(t("attestation.unavailable"));
      } else if (err instanceof AttestationFailed) {
        router.push({
          pathname: "/device-check",
          params: { ref: attestationReference() },
        });
      } else if (err instanceof OfflineError) {
        setError(t("offline.submitBody"));
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

  return (
    <Screen
      decor="branches"
      header={
        <AppHeader
          onBack={router.canGoBack() ? router.back : undefined}
          right={<LanguageSegment />}
        />
      }
      // The phone pad has no Return key: the CTA, the error it may raise and
      // the terms it accepts ride above the keyboard.
      footer={
        <>
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
          <Button
            label={t("phone.cta")}
            chevron
            loading={busy}
            onPress={submit}
          />
          {intent === "signin" ? (
            <Button
              variant="secondary"
              label={t("lostNumber.title")}
              onPress={() => router.push("/lost-number")}
            />
          ) : null}
          {intent === "signup" ? (
            <Text variant="body-sm" color="text.muted" align="center">
              {t("legal.agreeBefore")}
              <Text
                variant="body-sm"
                color="text.link"
                accessibilityRole="link"
                style={linkStyle}
                onPress={() => openSitePage("terms", language)}
              >
                {t("legal.terms")}
              </Text>
              {t("legal.agreeAnd")}
              <Text
                variant="body-sm"
                color="text.link"
                accessibilityRole="link"
                style={linkStyle}
                onPress={() => openSitePage("privacy", language)}
              >
                {t("legal.privacy")}
              </Text>
              {t("legal.agreeAfter")}
            </Text>
          ) : null}
        </>
      }
    >
      <Text variant="display">
        {t(intent === "signup" ? "phone.title" : "phone.signInTitle")}
      </Text>
      <Text variant="body-lg" color="text.muted">
        {t(intent === "signup" ? "phone.subtitle" : "phone.signInSubtitle")}
      </Text>
      {intent === "signup" ? (
        <>
          <RequiredSteps completed={0} />
          <TextField
            label={t("home.firstName")}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneInput.current?.focus()}
          />
        </>
      ) : null}
      <Text variant="label">{t("phone.label")}</Text>
      <PhoneInput ref={phoneInput} {...phone.inputProps} onSubmit={submit} />
      <Callout icon="shield-check" text={t("phone.reassure")} />
    </Screen>
  );
}
