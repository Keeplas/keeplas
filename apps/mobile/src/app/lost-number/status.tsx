import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { StepList } from "@/features/step-list";
import { formatDate, formatTime } from "@/lib/format";
import { clearClaim, readClaim } from "@/lib/lost-number";
import { contactSupport } from "@/lib/support";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";

const HOUR_MS = 60 * 60 * 1000;

/**
 * The request this phone made: support review + 72 h wait, then the code to
 * the new number. Closed requests (cancelled, rejected, lapsed) offer a new
 * one.
 */
export default function LostNumberStatus() {
  const router = useRouter();
  const { t, language } = useI18n();
  const [claim] = useState(readClaim);
  const args = claim
    ? {
        requestId: claim.requestId as Id<"number_change_requests">,
        claimToken: claim.claimToken,
      }
    : "skip";
  const request = useQuery(api.number_change.status, args);
  const requestCode = useMutation(api.number_change.requestCompletionCode);
  const withdraw = useMutation(api.number_change.withdraw);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function startOver() {
    await clearClaim();
    router.replace("/lost-number");
  }

  async function sendCode() {
    if (args === "skip") return;
    setBusy(true);
    try {
      await requestCode(args);
      router.push("/lost-number/verify");
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (args === "skip") return;
    await withdraw(args).catch(() => undefined);
    await startOver();
  }

  const header = (
    <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
  );
  if (request === undefined && claim) {
    return <Screen header={header}>{null}</Screen>;
  }

  const closed =
    !request ||
    request.expired ||
    request.status === "rejected" ||
    request.status === "cancelled" ||
    request.status === "completed";
  if (closed) {
    const reason = !request
      ? "lostNumber.notFound"
      : request.expired
        ? "lostNumber.lapsed"
        : request.status === "rejected"
          ? "lostNumber.rejected"
          : "lostNumber.cancelled";
    return (
      <Screen header={header}>
        <Text variant="h1">{t("lostNumber.statusTitle")}</Text>
        <Callout
          tone={request?.status === "rejected" ? "danger" : "warning"}
          icon="alert-triangle"
          text={t(reason)}
        />
        <Button label={t("lostNumber.startOver")} onPress={startOver} />
        {request?.status === "rejected" ? (
          <Button
            variant="text"
            label={t("common.getHelp")}
            onPress={() =>
              contactSupport(`Lost number: ${claim?.requestId}`, "recovery")
            }
          />
        ) : null}
      </Screen>
    );
  }

  const approved = request.status === "approved";
  const waited = now >= request.windowEndsAt;
  const hoursLeft = Math.max(
    1,
    Math.ceil((request.windowEndsAt - now) / HOUR_MS),
  );
  const steps = [
    { title: t("lostNumber.stepSent"), done: true },
    {
      title: t("lostNumber.stepReview"),
      description: t("lostNumber.stepReviewBody"),
      done: approved,
    },
    {
      title: t("lostNumber.stepWait"),
      description: waited
        ? t("lostNumber.stepWaitDone")
        : t("lostNumber.stepWaitBody", {
            n: hoursLeft,
            date: `${formatDate(request.windowEndsAt, language)} · ${formatTime(request.windowEndsAt, language)}`,
          }),
      done: waited,
    },
  ];

  return (
    <Screen header={header}>
      <Text variant="h1">{t("lostNumber.statusTitle")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("lostNumber.statusBody", { phone: request.newPhoneMasked })}
      </Text>
      <StepList steps={steps} />
      {approved && waited ? (
        <Button
          label={t("lostNumber.sendCode", { phone: request.newPhoneMasked })}
          chevron
          loading={busy}
          onPress={sendCode}
        />
      ) : null}
      <Note icon="shield-check" text={t("lostNumber.statusNote")} />
      <Button
        variant="text"
        label={t("lostNumber.withdraw")}
        onPress={cancel}
      />
    </Screen>
  );
}
