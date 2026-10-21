import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { OtpInput } from "@/components/otp-input";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  DevicePinError,
  hasDevicePin,
  setDevicePin,
} from "@/crypto/device-vault";
import { pinErrorText } from "@/features/pin/use-pin-gate";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";

type Step =
  | { kind: "overview" }
  | { kind: "current"; next: "change" | "off" }
  | { kind: "new"; current?: string }
  | { kind: "confirm"; current?: string; first: string };

export default function PinCode() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const { refreshDeviceVault } = useSession();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>({ kind: "overview" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void hasDevicePin(viewer._id).then((has) => {
      if (alive) setEnabled(has);
    });
    return () => {
      alive = false;
    };
  }, [viewer._id]);

  function go(next: Step) {
    setCode("");
    setError(null);
    setStep(next);
  }

  async function save(current: string | undefined, next: string | undefined) {
    setBusy(true);
    try {
      await setDevicePin(viewer._id, t("pin.auth"), current, next);
      setEnabled(Boolean(next));
      setDone(
        next
          ? current
            ? t("pin.changed")
            : t("pin.enabled")
          : t("pin.disabled"),
      );
      go({ kind: "overview" });
    } catch (caught) {
      if (caught instanceof DevicePinError && caught.code === "wiped") {
        Alert.alert(t("pin.wipedTitle"), t("pin.wipedBody"));
        refreshDeviceVault();
        return;
      }
      if (caught instanceof DevicePinError) {
        go(
          current
            ? { kind: "current", next: next ? "change" : "off" }
            : { kind: "overview" },
        );
        setError(pinErrorText(caught, t));
        return;
      }
      setCode("");
      setError(t("pin.failed"));
    } finally {
      setBusy(false);
    }
  }

  function complete(value: string) {
    if (busy) return;
    if (step.kind === "current") {
      if (step.next === "off") void save(value, undefined);
      else go({ kind: "new", current: value });
    } else if (step.kind === "new") {
      go({ kind: "confirm", current: step.current, first: value });
    } else if (step.kind === "confirm") {
      if (value !== step.first) {
        go({ kind: "new", current: step.current });
        setError(t("pin.mismatch"));
        return;
      }
      void save(step.current, value);
    }
  }

  const prompt =
    step.kind === "current"
      ? t("pin.enterCurrent")
      : step.kind === "new"
        ? t("pin.enterNew")
        : step.kind === "confirm"
          ? t("pin.enterConfirm")
          : null;

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={14}>
      <Text variant="h1">{t("privacy.pin")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("pin.body")}
      </Text>

      {prompt ? (
        <View style={styles.entry}>
          <Text variant="label">{prompt}</Text>
          <OtpInput
            key={step.kind}
            value={code}
            onChange={setCode}
            onComplete={complete}
            invalid={error !== null}
            label={prompt}
            secure
          />
          {error ? (
            <Text variant="body-sm" color="status.revoked">
              {error}
            </Text>
          ) : null}
          <Button
            variant="text"
            label={t("common.cancel")}
            disabled={busy}
            onPress={() => go({ kind: "overview" })}
          />
        </View>
      ) : enabled === null ? null : (
        <View style={styles.entry}>
          {done ? (
            <Callout tone="success" icon="check-circle" text={done} />
          ) : null}
          {error ? (
            <Callout tone="danger" icon="alert-triangle" text={error} />
          ) : null}
          <Callout
            icon="shield-check"
            text={enabled ? t("pin.statusOn") : t("pin.statusOff")}
          />
          {enabled ? (
            <>
              <Button
                label={t("pin.change")}
                onPress={() => go({ kind: "current", next: "change" })}
              />
              <Button
                variant="danger"
                label={t("pin.turnOff")}
                onPress={() => go({ kind: "current", next: "off" })}
              />
            </>
          ) : (
            <Button
              label={t("pin.turnOn")}
              onPress={() => go({ kind: "new" })}
            />
          )}
          <Text variant="body-sm" color="text.muted">
            {t("pin.forgot")}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: { gap: 12 },
});
