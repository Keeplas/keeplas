import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout, IconBadge } from "@/components/surfaces";
import { Text } from "@/components/text";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Someone asked to move this account to a new number (number_change.ts):
 * "It wasn't me" cancels it from any signed-in device.
 */
export default function NumberChange() {
  const router = useRouter();
  const { t, language } = useI18n();
  const request = useQuery(api.number_change.getMineOpen);
  const cancel = useAuditedMutation(api.number_change.cancel);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  async function notMe() {
    setBusy(true);
    try {
      await cancel();
      setCancelled(true);
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  const header = <NavBar title={t("numberChange.nav")} onBack={router.back} />;
  if (cancelled || request === null) {
    return (
      <Screen header={header}>
        <IconBadge icon="shield-check" tone="success" />
        <Text variant="h1">
          {t(cancelled ? "numberChange.cancelled" : "numberChange.none")}
        </Text>
      </Screen>
    );
  }
  if (!request) return <Screen header={header}>{null}</Screen>;

  return (
    <Screen
      header={header}
      footer={
        <Button
          variant="danger"
          label={t("numberChange.notMe")}
          loading={busy}
          onPress={notMe}
        />
      }
    >
      <IconBadge icon="shield-alert" tone="danger" />
      <Text variant="h1">{t("numberChange.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("numberChange.body", {
          phone: request.newPhoneMasked,
          date: `${formatDate(request.createdAt, language)} · ${formatTime(request.createdAt, language)}`,
        })}
      </Text>
      <Callout
        icon="clock"
        text={t("numberChange.wait", {
          date: formatDate(request.windowEndsAt, language),
        })}
      />
    </Screen>
  );
}
