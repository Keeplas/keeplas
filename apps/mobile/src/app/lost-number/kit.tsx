import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@keeplas/backend/_generated/api";
import { base64ToUint8 } from "@keeplas/crypto/encoding";
import { derivePhraseVerifier } from "@keeplas/crypto/recovery";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { PhoneInput } from "@/components/phone-input";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { isFullKit, kitWords, rememberKit } from "@/features/kit-open";
import { KitWordsField } from "@/features/kit-words-field";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * Old number + 24 words → `phone-recovery` sign-in: the phrase verifier is
 * computed here, the words never leave the phone. The new number comes
 * next (stage newNumber), then the same words open the vault.
 */
export default function LostNumberKit() {
  const router = useRouter();
  const { t } = useI18n();
  const { signIn } = useAuthActions();
  const { expectNewNumber } = useSession();
  const phone = usePhoneField();
  const phraseSalt = useAuditedMutation(api.phone_auth.getPhraseSaltByPhone);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const phoneNumber = phone.validate();
    if (!phoneNumber) return setError(t("phone.invalid"));
    setBusy(true);
    setError(null);
    try {
      const salt = await phraseSalt({ phoneNumber });
      if (!salt) throw new Error("No recovery kit for this number");
      const phrase = kitWords(words);
      const phraseHash = await derivePhraseVerifier(
        phrase,
        base64ToUint8(salt.phraseSalt),
      );
      expectNewNumber(true);
      rememberKit(phrase.join(" "));
      await signIn("phone-recovery", { phoneNumber, phraseHash });
    } catch {
      expectNewNumber(false);
      rememberKit(null);
      setError(t("lostNumber.kitInvalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
    >
      <Text variant="h1">{t("lostNumber.withKit")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("lostNumber.kitBody")}
      </Text>
      <Text variant="label">{t("lostNumber.oldNumber")}</Text>
      <PhoneInput {...phone.inputProps} />
      <KitWordsField value={words} onChangeText={setWords} />
      {error ? (
        <Callout tone="danger" icon="alert-circle" text={error} />
      ) : null}
      <Button
        label={t("lostNumber.kitCta")}
        chevron
        loading={busy}
        disabled={!isFullKit(words)}
        onPress={submit}
      />
    </Screen>
  );
}
