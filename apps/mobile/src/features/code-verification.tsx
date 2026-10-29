import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { OtpInput, OTP_LENGTH } from "@/components/otp-input";
import { Screen } from "@/components/screen";
import { StateSheet, type StateMessageProps } from "@/components/state-message";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { classifyCodeError, type CodeFailure } from "@/lib/errors";
import { useI18n } from "@/providers/i18n-provider";

/** Server-side attempt budget per code (phone_auth / login_otp MAX_ATTEMPTS). */
const MAX_ATTEMPTS = 5;
/**
 * Wait before asking for another code: WhatsApp can take a moment, each new
 * code voids the previous one, and a number gets 3 codes an hour.
 */
const RESEND_COOLDOWN_S = 30;

/**
 * M01-2 "Verify your number" layout, shared by phone sign-up / sign-in, the
 * email login-OTP step and the migration phone check. Failures open the
 * matching Sign-in error sheet (wrong code, expired, too many tries,
 * code not arriving).
 */
export function CodeVerification({
  title,
  body,
  destination,
  confirmLabel,
  note,
  onSubmit,
  onResend,
  footer,
}: {
  title: string;
  body: string;
  /** Shown in "Code not arriving?" (masked phone or email). */
  destination: string;
  confirmLabel: string;
  note?: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [sheet, setSheet] = useState<CodeFailure | "notArriving" | null>(null);
  const [resent, setResent] = useState(false);
  // Every caller sends a code right before showing this screen.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(value = code) {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
    } catch (error) {
      setAttempts((n) => n + 1);
      setSheet(classifyCodeError(error));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setSheet(null);
    setBusy(true);
    try {
      await onResend();
      setAttempts(0);
      setResent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (error) {
      setSheet(
        classifyCodeError(error) === "tooMany" ? "tooMany" : "notArriving",
      );
    } finally {
      setBusy(false);
    }
  }

  const close = () => setSheet(null);
  const sheets: Record<NonNullable<typeof sheet>, StateMessageProps> = {
    wrong: {
      icon: "alert-circle",
      tone: "danger",
      title: t("codeErrors.wrongTitle"),
      body: t("codeErrors.wrongBody", {
        count: Math.max(0, MAX_ATTEMPTS - attempts),
      }),
      primary: { label: t("common.tryAgain"), onPress: close },
      secondary: { label: t("verify.resend"), onPress: resend },
    },
    expired: {
      icon: "clock",
      tone: "warning",
      title: t("codeErrors.expiredTitle"),
      body: t("codeErrors.expiredBody"),
      primary: { label: t("codeErrors.expiredCta"), onPress: resend },
    },
    tooMany: {
      icon: "lock",
      tone: "danger",
      title: t("codeErrors.tooManyTitle"),
      body: t("codeErrors.tooManyBody"),
      primary: { label: t("common.ok"), onPress: close },
    },
    notArriving: {
      icon: "whatsapp",
      tone: "info",
      title: t("codeErrors.notArrivingTitle"),
      body: t("codeErrors.notArrivingBody", { phone: destination }),
      primary: { label: t("verify.resend"), onPress: resend },
      secondary: {
        label: t("codeErrors.changeNumber"),
        onPress: () => router.back(),
      },
    },
  };

  return (
    <Screen
      decor="landscape"
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
    >
      <Text variant="h1">{title}</Text>
      <Text variant="body-lg" color="text.muted">
        {body}
      </Text>
      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={submit}
        label={title}
      />
      <Button
        label={confirmLabel}
        chevron
        loading={busy}
        onPress={() => submit()}
      />
      <Text variant="body-sm" color="text.muted" align="center">
        {resent ? t("verify.resent") : t("verify.noCode")}
      </Text>
      <Button
        variant="text"
        label={
          cooldown > 0
            ? t("verify.resendIn", { seconds: cooldown })
            : t("verify.resend")
        }
        disabled={cooldown > 0}
        onPress={() => setSheet("notArriving")}
      />
      {note ? <Callout icon="whatsapp" text={note} /> : null}
      {footer}
      {sheet ? (
        <StateSheet visible onDismiss={close} {...sheets[sheet]} />
      ) : null}
    </Screen>
  );
}
