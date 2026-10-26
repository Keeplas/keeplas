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
  devicePinLength,
  PIN_LENGTH,
  setDevicePin,
} from "@/crypto/device-vault";
import { ChoosePin, PinReasons } from "@/features/pin/choose-pin";
import { pinErrorText } from "@/features/pin/use-pin-gate";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";

type Step =
  | { kind: "overview" }
  | { kind: "current"; next: "change" | "off" }
  | { kind: "choose"; current?: string };

export default function PinCode() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const { refreshDeviceVault } = useSession();
  // Digits of the current PIN, null without one, undefined while loading.
  const [pinLength, setPinLength] = useState<number | null>();
  const [step, setStep] = useState<Step>({ kind: "overview" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void devicePinLength(viewer._id).then((length) => {
      if (alive) setPinLength(length);
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
      setPinLength(next ? next.length : null);
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

  function completeCurrent(value: string) {
    if (busy || step.kind !== "current") return;
    if (step.next === "off") void save(value, undefined);
    else go({ kind: "choose", current: value });
  }

  const cancel = {
    label: t("common.cancel"),
    onPress: () => go({ kind: "overview" }),
  };

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={14}>
      <Text variant="h1">{t("privacy.pin")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("pin.body", { n: PIN_LENGTH })}
      </Text>

      {step.kind === "current" && pinLength ? (
        <View style={styles.entry}>
          <Text variant="label" align="center">
            {t("pin.enterCurrent")}
          </Text>
          <OtpInput
            length={pinLength}
            value={code}
            onChange={setCode}
            onComplete={completeCurrent}
            invalid={error !== null}
            label={t("pin.enterCurrent")}
            secure
          />
          {error ? (
            <Text variant="body-sm" color="status.revoked" align="center">
              {error}
            </Text>
          ) : null}
          <Button
            variant="text"
            label={cancel.label}
            disabled={busy}
            onPress={cancel.onPress}
          />
        </View>
      ) : step.kind === "choose" ? (
        <ChoosePin
          onChosen={(next) => void save(step.current, next)}
          secondary={cancel}
          error={error}
          busy={busy}
        />
      ) : pinLength === undefined ? null : (
        <View style={styles.entry}>
          {done ? (
            <Callout tone="success" icon="check-circle" text={done} />
          ) : null}
          {error ? (
            <Callout tone="danger" icon="alert-triangle" text={error} />
          ) : null}
          {pinLength ? (
            <Callout icon="shield-check" text={t("pin.statusOn")} />
          ) : (
            <Callout
              tone="warning"
              icon="alert-triangle"
              text={t("pin.statusOff")}
            />
          )}
          <PinReasons />
          {pinLength ? (
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
              onPress={() => go({ kind: "choose" })}
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
