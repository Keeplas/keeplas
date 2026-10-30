import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { Checkbox } from "@/components/controls";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { StateSheet } from "@/components/state-message";
import { Callout, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { readDeviceRootKey } from "@/crypto/device-vault";
import {
  cloudKeyName,
  cloudNames,
  useSealCloudBackup,
} from "@/features/cloud-backup";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";
import {
  KitWords,
  useCreateKit,
  useGuardKitWords,
} from "@/features/recovery-kit";
import { serverMessage } from "@/lib/errors";
import { writePreference } from "@/lib/preferences";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import * as CloudKey from "../../../modules/cloud-key";

/** Steps of turning the backup off. */
type OffStep = "warn" | "kit" | "confirm";

/**
 * D7 / M07-6: Keeplas envelope + synced platform CBK, on or off together.
 * Turning it off takes 3 steps: what it means, a new recovery kit that must
 * be saved as a PDF or an image, then a last check.
 */
export default function CloudBackup() {
  const withPin = useWithPin();
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const status = useQuery(api.cloud_backup.status);
  const seal = useSealCloudBackup();
  const disable = useAuditedMutation(api.cloud_backup.disable);
  const createKit = useCreateKit();
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState<OffStep | null>(null);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [exported, setExported] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const { account } = cloudNames;
  const confirmLeave = useGuardKitWords(phrase !== null && off !== null);

  /** A reason this phone can't back up, shown as is (not a server error). */
  function cannotBackUp(reason: string) {
    toast({
      variant: "error",
      title: t("common.genericError"),
      description: reason,
    });
  }

  async function enable() {
    setBusy(true);
    try {
      // Checked before the screen lock, so nobody unlocks for nothing.
      if (!(await CloudKey.isEndToEndEncrypted())) {
        cannotBackUp(t("backup.notEncrypted"));
        return;
      }
      const rootKey = await withPin((pin) =>
        readDeviceRootKey(viewer._id, t("backup.auth"), pin),
      );
      if (!rootKey) {
        cannotBackUp(t("backup.noRootKey"));
        return;
      }
      try {
        await seal(rootKey);
      } finally {
        rootKey.fill(0);
      }
    } catch (error) {
      if (isPinAbort(error)) return;
      toast({
        variant: "error",
        title: t("common.genericError"),
        description: serverMessage(error),
      });
    } finally {
      setBusy(false);
    }
  }

  function stopTurningOff() {
    setOff(null);
    setPhrase(null);
    setExported(false);
    setUnderstood(false);
  }

  /** Cancelling the last check keeps the new words on screen. */
  function backToWords() {
    setUnderstood(false);
    setOff("kit");
  }

  async function saveWords() {
    setOff(null);
    setBusy(true);
    try {
      setPhrase(await createKit());
      setOff("kit");
    } catch (error) {
      if (!isPinAbort(error)) {
        toast({ variant: "error", title: t("common.genericError") });
      }
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setOff(null);
    setBusy(true);
    try {
      await disable({});
      await CloudKey.remove(cloudKeyName(viewer._id));
      toast({ variant: "success", title: t("backupOff.done") });
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      stopTurningOff();
      setBusy(false);
    }
  }

  if (phrase && off !== null) {
    return (
      <Screen
        header={
          <NavBar
            title={t("backup.title")}
            onBack={() => confirmLeave(stopTurningOff)}
          />
        }
        footer={
          <Button
            label={t("common.continue")}
            disabled={!exported}
            onPress={() => setOff("confirm")}
          />
        }
      >
        <Text variant="caption" color="text.muted">
          {t("backupOff.kitStep")}
        </Text>
        <Text variant="h1">{t("backupOff.kitTitle")}</Text>
        <Text color="text.muted">{t("backupOff.kitBody")}</Text>
        <KitWords
          phrase={phrase}
          onExported={() => {
            setExported(true);
            void writePreference("kitExported", "true");
          }}
        />
        <StateSheet
          visible={off === "confirm"}
          onDismiss={backToWords}
          icon="alert-triangle"
          tone="danger"
          title={t("backupOff.confirmTitle")}
          body={t("backupOff.confirmBody", { account })}
          primary={{
            label: t("backupOff.confirm"),
            variant: "danger",
            disabled: !understood,
            onPress: () => void turnOff(),
          }}
          secondary={{ label: t("common.cancel"), onPress: backToWords }}
        >
          <View style={styles.check}>
            <Checkbox
              checked={understood}
              onChange={setUnderstood}
              label={t("backupOff.understand")}
            />
          </View>
        </StateSheet>
      </Screen>
    );
  }

  return (
    <Screen
      header={<NavBar title={t("backup.title")} onBack={router.back} />}
      footer={
        <Button
          label={status?.enabled ? t("backup.disable") : t("backup.enable")}
          variant={status?.enabled ? "secondary" : "primary"}
          onPress={() => (status?.enabled ? setOff("warn") : void enable())}
          loading={busy}
        />
      }
    >
      <View style={styles.chip}>
        <StatusChip
          label={status?.enabled ? t("backup.on") : t("backup.off")}
          tone={status?.enabled ? "success" : "neutral"}
        />
      </View>
      <Text variant="h1">{t("backup.title")}</Text>
      <Text color="text.muted">
        {t("backup.body", {
          account,
        })}
      </Text>
      <Callout
        icon="shield-check"
        text={t("backup.protected", {
          account,
        })}
      />
      <StateSheet
        visible={off === "warn"}
        onDismiss={stopTurningOff}
        icon="alert-triangle"
        tone="warning"
        title={t("backupOff.warnTitle")}
        body={t("backupOff.warnBody", { account })}
        primary={{
          label: t("backupOff.saveWords"),
          onPress: () => void saveWords(),
        }}
        secondary={{ label: t("backupOff.keep"), onPress: stopTurningOff }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: "flex-start" },
  check: { paddingTop: 4 },
});
