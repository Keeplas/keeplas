import { useState } from "react";
import { Platform } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { BottomSheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { fromPickerDate, latestBirthday, toPickerDate } from "./birthday";
import { accountErrorKey } from "./errors";

/**
 * Edit the date of birth: the system date dialog on Android, a spinner in a
 * bottom sheet on iOS. Render `sheet` once; call `edit` to open the picker.
 */
export function useBirthdayEditor(birthday: number | undefined) {
  const { t, language } = useI18n();
  const { colors, scheme } = useTheme();
  const updateBirthday = useAuditedMutation(api.users.updateBirthday);
  const [draft, setDraft] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(date: Date) {
    await updateBirthday({ birthday: fromPickerDate(date) });
    toast({ variant: "success", title: t("account.legal.birthdaySaved") });
  }

  function edit() {
    const value = birthday ? toPickerDate(birthday) : latestBirthday();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        maximumDate: latestBirthday(),
        onValueChange: (_, date) =>
          void save(date).catch((err: unknown) =>
            toast({ variant: "error", title: t(accountErrorKey(err)) }),
          ),
      });
      return;
    }
    setError(null);
    setDraft(value);
  }

  async function confirm() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await save(draft);
      setDraft(null);
    } catch (err) {
      setError(t(accountErrorKey(err)));
    } finally {
      setSaving(false);
    }
  }

  const sheet = (
    <BottomSheet
      visible={draft !== null}
      onDismiss={() => setDraft(null)}
      title={t("account.legal.birthday")}
    >
      {draft ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="spinner"
          maximumDate={latestBirthday()}
          locale={language}
          themeVariant={scheme}
          textColor={colors["text.primary"]}
          onValueChange={(_, date) => setDraft(date)}
        />
      ) : null}
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
      <Button
        label={t("account.save")}
        loading={saving}
        onPress={() => void confirm()}
      />
    </BottomSheet>
  );

  return { edit, sheet };
}
