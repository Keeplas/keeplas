import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Label, Select, SelectItem, Switch } from "@keeplas/ui";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  useLocalStorageState,
  useLocalStorageString,
} from "@/lib/use-local-storage-state";
import { getErrorMessage } from "@/lib/utils";
import { normalizeUserLanguage, resolveLocale } from "@/lib/locale";
import { useSetLocale, useTranslations } from "@/lib/i18n";
import {
  CURRENCIES,
  DEFAULT_NOTIFICATIONS,
  LANGUAGES,
  TIMEZONES,
  type NotificationPrefs,
} from "./constants";

interface PreferencesSectionProps {
  user: Doc<"users">;
  onError: (message: string) => void;
}

const NOTIFICATION_ITEMS: Array<{
  key: keyof NotificationPrefs;
}> = [
  { key: "lifeCheckReminders" },
  { key: "vaultAccessAlerts" },
  { key: "newsletterUpdates" },
];

export function PreferencesSection({ user, onError }: PreferencesSectionProps) {
  const updatePreferences = useAuditedMutation(api.users.updatePreferences);
  const setLocale = useSetLocale();
  const t = useTranslations("settings");

  const [language, setLanguage] = useState(
    normalizeUserLanguage(user.language),
  );
  const [timezone, setTimezone] = useState(user.timezone ?? "UTC");
  const [currency, setCurrency] = useLocalStorageString(
    STORAGE_KEYS.currency,
    "USD",
  );
  const [notifications, setNotifications] =
    useLocalStorageState<NotificationPrefs>(
      STORAGE_KEYS.notifications,
      DEFAULT_NOTIFICATIONS,
    );

  // Re-seed the editable fields whenever the viewer record changes, adjusting
  // during render instead of syncing in an effect.
  const [seededFrom, setSeededFrom] = useState(user);
  if (user !== seededFrom) {
    setSeededFrom(user);
    setLanguage(normalizeUserLanguage(user.language));
    setTimezone(user.timezone ?? "UTC");
  }

  // Auto-save each field on change. Language/timezone are persisted to Convex;
  // currency and notifications are localStorage-only and persist via their setters.
  async function persist(next: { language?: string; timezone?: string }) {
    onError("");
    try {
      await updatePreferences(next);
      // Apply the new locale immediately (also persists to localStorage);
      // ViewerLocaleSync keeps it in sync from the stored preference too.
      if (next.language) setLocale(resolveLocale(next.language));
    } catch (err) {
      onError(getErrorMessage(err, t("preferences.saveError")));
    }
  }

  function handleLanguageChange(value: string) {
    setLanguage(value);
    void persist({ language: value });
  }

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    void persist({ timezone: value });
  }

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-headline-sm text-primary">
              {t("preferences.localization.title")}
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {t("preferences.localization.description")}
            </p>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-label-md text-secondary">
                {t("preferences.interfaceLanguage")}
              </Label>
              <Select
                value={language}
                onValueChange={handleLanguageChange}
                placeholder={t("preferences.chooseLanguage")}
              >
                {LANGUAGES.map((lang) => (
                  <SelectItem
                    key={lang.value}
                    value={lang.value}
                    disabled={lang.upcoming}
                  >
                    {lang.upcoming
                      ? t("preferences.languageUpcoming", { label: lang.label })
                      : lang.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-label-md text-secondary">
                {t("preferences.timezone")}
              </Label>
              <Select
                value={timezone}
                onValueChange={handleTimezoneChange}
                placeholder={t("preferences.chooseTimezone")}
              >
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-label-md text-secondary">
                {t("preferences.currencyDisplay")}
              </Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                placeholder={t("preferences.chooseCurrency")}
              >
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-headline-sm text-primary">
              {t("preferences.alerts.title")}
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {t("preferences.alerts.description")}
            </p>
          </div>
          <div className="space-y-5">
            {NOTIFICATION_ITEMS.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-body-md font-bold text-primary truncate">
                    {t(`preferences.notifications.${item.key}.label`)}
                  </p>
                  <p className="text-body-md text-on-surface-variant">
                    {t(`preferences.notifications.${item.key}.description`)}
                  </p>
                </div>
                <Switch
                  checked={notifications[item.key]}
                  onCheckedChange={() => toggleNotification(item.key)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
