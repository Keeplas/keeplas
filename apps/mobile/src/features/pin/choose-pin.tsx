import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorText } from "@/components/error-text";
import { OtpInput } from "@/components/otp-input";
import { BulletCard } from "@/components/surfaces";
import { Text } from "@/components/text";
import { PIN_LENGTH } from "@/crypto/device-vault";
import { useI18n } from "@/providers/i18n-provider";

/** Why a Keeplas PIN is worth adding (setup step and Settings). */
export function PinReasons() {
  const { t } = useI18n();
  return (
    <BulletCard
      icon="shield-check"
      title={t("pin.whyTitle")}
      items={[t("pin.why1"), t("pin.why2", { n: PIN_LENGTH }), t("pin.why3")]}
    />
  );
}

/**
 * Choose a new PIN, then type it again. `onChosen` gets the PIN once both
 * entries match; `secondary` is the text action under the first entry
 * (Skip / Cancel), the second entry offers to choose another code.
 */
export function ChoosePin({
  onChosen,
  secondary,
  error,
  busy = false,
}: {
  onChosen: (pin: string) => void;
  secondary: { label: string; onPress: () => void };
  /** Error from the parent (save failed), shown under the boxes. */
  error?: string | null;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const [first, setFirst] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const entry = useRef<View>(null);

  function restart() {
    setFirst(null);
    setCode("");
  }

  function complete(value: string) {
    if (busy) return;
    if (first === null) {
      setFirst(value);
      setCode("");
      setMismatch(false);
    } else if (value !== first) {
      restart();
      setMismatch(true);
    } else {
      onChosen(value);
    }
  }

  const message = mismatch ? t("pin.mismatch") : error;
  const prompt =
    first === null
      ? t("pin.enterNew", { n: PIN_LENGTH })
      : t("pin.enterConfirm");

  return (
    <View ref={entry} style={styles.entry}>
      <Text variant="label" align="center">
        {prompt}
      </Text>
      <OtpInput
        key={first === null ? "new" : "confirm"}
        length={PIN_LENGTH}
        value={code}
        onChange={setCode}
        onComplete={complete}
        invalid={!!message}
        label={prompt}
        secure
        keepVisible={entry}
      />
      <ErrorText align="center">{message}</ErrorText>
      {first === null ? (
        <Button
          variant="text"
          label={secondary.label}
          disabled={busy}
          onPress={secondary.onPress}
        />
      ) : (
        <Button
          variant="text"
          label={t("pin.chooseAnother")}
          disabled={busy}
          onPress={restart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { gap: 12 },
});
