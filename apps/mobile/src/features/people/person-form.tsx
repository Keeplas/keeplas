import { useEffect, useState } from "react";
import { isValidEmail, normalizeEmail } from "@keeplas/backend/lib/email";

import { PhoneInput } from "@/components/phone-input";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useFormDraft } from "@/lib/form-drafts";
import type { CountryCode } from "@/lib/phone";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";

export interface PersonDraft {
  name: string;
  email: string;
  phoneCountry: CountryCode | undefined;
  phoneInput: string;
}

/**
 * Name / email / phone of a trusted person, kept as a form draft so it
 * survives the vault lock. Shared by Add and Edit trusted person.
 */
export function usePersonForm<T extends PersonDraft>(
  key: string,
  initial: () => T,
) {
  const [draft, updateDraft, clearDraft] = useFormDraft(key, initial);
  const phone = usePhoneField({
    country: draft.phoneCountry,
    number: draft.phoneInput,
  });
  const [emailError, setEmailError] = useState(false);
  const phoneCountry = phone.inputProps.country;
  const phoneInput = phone.inputProps.value;
  useEffect(() => {
    updateDraft({ phoneCountry, phoneInput } as Partial<T>);
  }, [phoneCountry, phoneInput, updateDraft]);

  return {
    draft,
    updateDraft,
    clearDraft,
    phone,
    emailError,
    setEmailError,
    filled: !!draft.name.trim() && !!phoneInput,
    /** Trimmed details with an E.164 phone, or null after flagging bad fields. */
    validate() {
      const emailOk = !draft.email.trim() || isValidEmail(draft.email);
      setEmailError(!emailOk);
      const phoneNumber = phone.validate();
      if (!emailOk || !phoneNumber) return null;
      return {
        name: draft.name.trim(),
        email: draft.email.trim() ? normalizeEmail(draft.email) : undefined,
        phoneNumber,
      };
    },
  };
}

export function PersonFields({
  form,
  onSubmit,
}: {
  form: ReturnType<typeof usePersonForm>;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const { draft, updateDraft, phone, emailError, setEmailError } = form;
  return (
    <>
      <TextField
        label={t("people.name")}
        value={draft.name}
        onChangeText={(name) => updateDraft({ name })}
        autoCapitalize="words"
        textContentType="name"
      />
      <TextField
        label={t("people.email")}
        value={draft.email}
        onChangeText={(email) => {
          updateDraft({ email });
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
      <PhoneInput {...phone.inputProps} onSubmit={onSubmit} />
      {phone.inputProps.invalid ? (
        <Text variant="body-sm" color="status.revoked">
          {t("phone.invalid")}
        </Text>
      ) : null}
    </>
  );
}
