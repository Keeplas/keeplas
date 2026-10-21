import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { useShellAccount } from "@/components/shell/shell-account";
import { useLocale, useTranslations } from "@/lib/i18n";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import {
  DEFAULT_NOTIFICATIONS,
  type NotificationPrefs,
} from "./sections/constants";
import { SettingsView } from "./settings-view";

const KINDS = [
  { kind: "document", colorClassName: "bg-category-document" },
  { kind: "image", colorClassName: "bg-category-account" },
  { kind: "audio", colorClassName: "bg-category-instruction" },
  { kind: "video", colorClassName: "bg-category-note" },
] as const;

export default function SettingsPage() {
  const t = useTranslations("settings.overview");
  const locale = useLocale();
  const { signOut } = useShellAccount();
  const stats = useQuery(api.vaults.getUsageStats);
  const lifeCheck = useQuery(api.life_check.getConfig);
  const [notifications] = useLocalStorageState<NotificationPrefs>(
    STORAGE_KEYS.notifications,
    DEFAULT_NOTIFICATIONS,
  );

  if (!stats || lifeCheck === undefined) return <Loader />;

  return (
    <SettingsView
      usedBytes={stats.storageBytes}
      quotaBytes={stats.quotaBytes}
      breakdown={KINDS.filter(({ kind }) => stats.bytesByKind[kind] > 0).map(
        ({ kind, colorClassName }) => ({
          label: t(`storage.kinds.${kind}`),
          bytes: stats.bytesByKind[kind],
          colorClassName,
        }),
      )}
      plan={stats.plan}
      language={t(`languages.${locale}`)}
      lifeCheck={
        lifeCheck?.isActive
          ? t(`frequency.${lifeCheck.frequency}`)
          : t("frequency.off")
      }
      notifications={
        notifications.lifeCheckReminders || notifications.vaultAccessAlerts
          ? t("on")
          : t("off")
      }
      onSignOut={signOut}
    />
  );
}
