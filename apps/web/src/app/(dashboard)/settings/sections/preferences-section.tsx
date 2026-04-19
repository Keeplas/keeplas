"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Button, Label, Select, SelectItem, Switch } from "@keeplas/ui";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  useLocalStorageState,
  useLocalStorageString,
} from "@/lib/use-local-storage-state";
import { getErrorMessage } from "@/lib/utils";
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
  label: string;
  description: string;
}> = [
  {
    key: "lifeCheckReminders",
    label: "Life Check Reminders",
    description: "Bi-weekly proof-of-life verification.",
  },
  {
    key: "vaultAccessAlerts",
    label: "Vault Access Alerts",
    description: "Instant push notification on login.",
  },
  {
    key: "newsletterUpdates",
    label: "Newsletter & Updates",
    description: "Occasional legacy planning insights.",
  },
];

export function PreferencesSection({ user, onError }: PreferencesSectionProps) {
  const updatePreferences = useMutation(api.users.updatePreferences);

  const [language, setLanguage] = useState(user.language ?? "en-US");
  const [timezone, setTimezone] = useState(user.timezone ?? "UTC");
  const [currency, setCurrency] = useLocalStorageString(
    STORAGE_KEYS.currency,
    "USD"
  );
  const [notifications, setNotifications] =
    useLocalStorageState<NotificationPrefs>(
      STORAGE_KEYS.notifications,
      DEFAULT_NOTIFICATIONS
    );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLanguage(user.language ?? "en-US");
    setTimezone(user.timezone ?? "UTC");
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    setSaved(false);
    try {
      await updatePreferences({ language, timezone });
      setSaved(true);
    } catch (err) {
      onError(getErrorMessage(err, "Failed to save preferences"));
    } finally {
      setSaving(false);
    }
  }

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <section className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="bg-surface-container-low rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-headline-sm text-primary">
              Platform Localization
            </h2>
            <p className="text-body-md text-on-surface-variant">
              Define how your legacy is presented across global regions.
            </p>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-label-md text-secondary">
                Interface Language
              </Label>
              <Select
                value={language}
                onValueChange={setLanguage}
                placeholder="Choose language"
              >
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-label-md text-secondary">
                Timezone
              </Label>
              <Select
                value={timezone}
                onValueChange={setTimezone}
                placeholder="Choose timezone"
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
                Currency Display
              </Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                placeholder="Choose currency"
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
              Alert Preferences
            </h2>
            <p className="text-body-md text-on-surface-variant">
              Control the frequency of Life Checks and vault synchronization alerts.
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
                    {item.label}
                  </p>
                  <p className="text-body-md text-on-surface-variant">
                    {item.description}
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

        <div className="col-span-full flex items-center justify-end gap-4">
          {saved && (
            <span className="text-body-md text-secondary font-medium">
              Preferences saved ✓
            </span>
          )}
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </form>
    </section>
  );
}
