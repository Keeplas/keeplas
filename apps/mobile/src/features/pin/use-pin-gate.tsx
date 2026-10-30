import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, StyleSheet, View } from "react-native";

import { ErrorText } from "@/components/error-text";
import { OtpInput } from "@/components/otp-input";
import { BottomSheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { DevicePinError, devicePinLength } from "@/crypto/device-vault";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";

export class PinCancelled extends Error {}

export const isPinAbort = (error: unknown) =>
  error instanceof PinCancelled ||
  (error instanceof DevicePinError && error.code === "wiped");

export function pinErrorText(
  error: DevicePinError,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (error.code === "locked") {
    const seconds = Math.max(
      1,
      Math.ceil(((error.detail.lockedUntil ?? Date.now()) - Date.now()) / 1000),
    );
    return t("pin.locked", { seconds });
  }
  if (error.code === "wrong") {
    return t("pin.wrong", { count: error.detail.remaining ?? 0 });
  }
  return t("pin.required");
}

interface Pending {
  run: (pin: string) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

type WithPin = <T>(run: (pin?: string) => Promise<T>) => Promise<T>;

const PinGateContext = createContext<WithPin | null>(null);

export function useWithPin(): WithPin {
  const withPin = useContext(PinGateContext);
  if (!withPin) throw new Error("useWithPin outside PinGateProvider");
  return withPin;
}

export function PinGateProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const viewer = useViewer();
  const { refreshDeviceVault } = useSession();
  // Digits of the PIN asked for; 0 while the sheet is closed.
  const [length, setLength] = useState(0);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Pending | null>(null);

  const withPin = useCallback(
    async <T,>(run: (pin?: string) => Promise<T>): Promise<T> => {
      const pinLength = await devicePinLength(viewer._id);
      if (!pinLength) return run(undefined);
      return new Promise<T>((resolve, reject) => {
        pending.current = {
          run,
          resolve: resolve as (value: unknown) => void,
          reject,
        };
        setPin("");
        setError(null);
        setLength(pinLength);
      });
    },
    [viewer._id],
  );

  async function submit(code: string) {
    const current = pending.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      const result = await current.run(code);
      pending.current = null;
      setLength(0);
      current.resolve(result);
    } catch (caught) {
      setPin("");
      if (caught instanceof DevicePinError && caught.code === "wiped") {
        pending.current = null;
        setLength(0);
        current.reject(caught);
        Alert.alert(t("pin.wipedTitle"), t("pin.wipedBody"));
        refreshDeviceVault();
      } else if (caught instanceof DevicePinError) {
        setError(pinErrorText(caught, t));
      } else {
        pending.current = null;
        setLength(0);
        current.reject(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    pending.current?.reject(new PinCancelled());
    pending.current = null;
    setLength(0);
  }

  const sheet = (
    <BottomSheet
      visible={length > 0}
      onDismiss={cancel}
      title={t("pin.sheetTitle")}
    >
      <View style={styles.body}>
        <Text variant="body" color="text.muted">
          {t("pin.sheetBody", { n: length })}
        </Text>
        <OtpInput
          length={length}
          value={pin}
          onChange={setPin}
          onComplete={(code) => void submit(code)}
          invalid={error !== null}
          label={t("pin.label")}
          secure
        />
        <ErrorText>{error}</ErrorText>
      </View>
    </BottomSheet>
  );

  return (
    <PinGateContext.Provider value={withPin}>
      {children}
      {sheet}
    </PinGateContext.Provider>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
});
