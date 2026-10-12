import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, IconBadge } from "@/components/surfaces";
import { Text } from "@/components/text";
import { PasskeyButton } from "@/features/passkey-step";
import { StepList } from "@/features/step-list";
import { formatPhone } from "@/lib/phone";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useEnsureDevice } from "@/lib/use-register-passkey";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";

/**
 * M09-7 Move to phone sign-in (D5). Checklist from
 * `account_migration.getStatus`; the button runs the current step, and
 * `finalize` turns password sign-in off once all are done (→ M09-8).
 */
export default function MoveToPhone() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const { deferMigration } = useSession();
  const status = useQuery(api.account_migration.getStatus);
  const ensureDevice = useEnsureDevice();
  const finalize = useAuditedMutation(api.account_migration.finalize);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const phone = status?.phoneVerified ?? false;
  const passkey = status?.hasPasskey ?? false;
  const device = status?.hasMobileDevice ?? false;
  const steps = [
    {
      title: t("migration.phoneStep"),
      description: viewer.phoneNumber
        ? formatPhone(viewer.phoneNumber)
        : undefined,
      done: phone,
    },
    {
      title: t("migration.verifyStep"),
      description: t("migration.verifyStepBody"),
      done: phone,
    },
    {
      title: t("migration.passkeyStep"),
      description: t("migration.passkeyStepBody"),
      done: passkey,
    },
    {
      title: t("migration.appStep"),
      description: t("migration.appStepBody"),
      done: device,
    },
    {
      title: t("migration.offStep"),
      description: t("migration.offStepBody"),
      done: false,
    },
  ];

  let action;
  if (!phone) {
    action = (
      <Button
        label={t("migration.sendCode")}
        onPress={() => router.push("/migrate-phone")}
      />
    );
  } else if (!passkey) {
    action = (
      <PasskeyButton
        userId={viewer._id}
        label={t("migration.createPasskey")}
        onDone={() => undefined}
      />
    );
  } else if (!device) {
    action = (
      <Button
        label={t("migration.registerDevice")}
        loading={busy}
        onPress={() => run(() => ensureDevice(viewer._id))}
      />
    );
  } else {
    action = (
      <Button
        label={t("migration.finish")}
        loading={busy}
        onPress={() =>
          run(async () => {
            await finalize();
            router.replace("/migrated");
          })
        }
      />
    );
  }

  return (
    <Screen header={<AppHeader />}>
      <IconBadge icon="phone" tone="info" />
      <Text variant="h1">{t("migration.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("migration.body")}
      </Text>
      <StepList steps={steps} />
      <Callout icon="shield-check" text={t("migration.note")} />
      {action}
      <Button
        variant="text"
        label={t("migration.later")}
        onPress={deferMigration}
      />
    </Screen>
  );
}
