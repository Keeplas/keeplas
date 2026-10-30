import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import QRCode from "react-native-qrcode-svg";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Callout, Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { openDeviceVault } from "@/crypto/device-vault";
import { useWithPin } from "@/features/pin/use-pin-gate";
import { holdLock } from "@/lib/auto-lock";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useNoScreenCapture } from "@/lib/use-no-screen-capture";
import { useReplaceKit } from "@/lib/use-replace-kit";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { colors, radius } from "@/theme";
import { shareKitImage, shareKitPdf } from "./kit-export";
import { encodeKitQr } from "./kit-qr";

/**
 * Create a new recovery kit: new 24 words for this vault (the previous ones
 * stop working). Resolves to the words; they are never stored.
 */
export function useCreateKit() {
  const withPin = useWithPin();
  const { t } = useI18n();
  const viewer = useViewer();
  const replaceKit = useReplaceKit();

  return useCallback(async () => {
    const { pin, masterKey } = await withPin(async (code) => {
      const keys = await openDeviceVault(viewer._id, t("kit.auth"), code);
      keys.rootKey?.fill(0);
      return { pin: code, masterKey: keys.masterKey };
    });
    try {
      return await replaceKit(viewer._id, masterKey, pin);
    } finally {
      masterKey.fill(0);
    }
  }, [withPin, t, viewer._id, replaceKit]);
}

/**
 * While new kit words are `shown`, they exist nowhere else and the previous
 * kit already stopped working: keep the vault from auto-locking, and ask
 * before any way out that removes the screen (back, swipe, hardware back,
 * tab bar). Returns the same question for an in-screen exit:
 * `confirmLeave(leave)`.
 */
export function useGuardKitWords(shown: boolean) {
  const { t } = useI18n();
  const navigation = useNavigation();
  // One question at a time: a tab tap tries to leave twice.
  const asking = useRef(false);

  const confirmLeave = useCallback(
    (leave: () => void) => {
      if (asking.current) return;
      asking.current = true;
      const answer = (leaving: boolean) => () => {
        asking.current = false;
        if (leaving) leave();
      };
      Alert.alert(
        t("kit.leaveTitle"),
        t("kit.leaveBody"),
        [
          { text: t("kit.stay"), style: "cancel", onPress: answer(false) },
          { text: t("kit.leave"), style: "destructive", onPress: answer(true) },
        ],
        { cancelable: true, onDismiss: answer(false) },
      );
    },
    [t],
  );

  useEffect(() => (shown ? holdLock() : undefined), [shown]);
  usePreventRemove(shown, ({ data }) =>
    confirmLeave(() => navigation.dispatch(data.action)),
  );
  return confirmLeave;
}

function WordGrid({
  phrase,
  inverse,
}: {
  phrase: string[];
  inverse?: boolean;
}) {
  return (
    <View style={styles.grid}>
      {phrase.map((word, index) => (
        <View key={index} style={styles.word}>
          <Text variant="body-sm" color="text.subtle" style={styles.index}>
            {String(index + 1).padStart(2, "0")}
          </Text>
          <Text
            variant="label"
            selectable={false}
            style={inverse ? styles.inverseWord : undefined}
          >
            {word}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The 24 words with "Download PDF" / "Save image" actions. `onExported`
 * fires once the share sheet closes: the OS doesn't say whether the file was
 * saved or the sheet cancelled, so the screen never claims it was saved.
 */
export function KitWords({
  phrase,
  onExported,
}: {
  phrase: string[];
  onExported?: () => void;
}) {
  const { t, language } = useI18n();
  const card = useRef<View>(null);
  useNoScreenCapture();
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);
  const [shared, setShared] = useState<"pdf" | "image" | null>(null);
  // When these words were shown: the kit's creation date on the files.
  const [createdAt] = useState(() => Date.now());
  const created = t("kit.created", { date: formatDate(createdAt, language) });

  async function save(kind: "pdf" | "image") {
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await shareKitPdf(phrase, {
          title: t("kit.title"),
          created,
          qr: t("kit.qr"),
          rules: [t("kit.rule1"), t("kit.warning"), t("kit.rule3")],
        });
      } else {
        await shareKitImage(card, t("kit.title"));
      }
      setShared(kind);
      onExported?.();
    } catch {
      toast({ variant: "error", title: t("kit.exportFailed") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card>
        <WordGrid phrase={phrase} />
      </Card>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon="download"
          label={t("kit.pdf")}
          loading={busy === "pdf"}
          disabled={busy !== null}
          onPress={() => void save("pdf")}
          style={styles.flex}
        />
        <Button
          variant="secondary"
          icon="image-gallery"
          label={t("kit.image")}
          loading={busy === "image"}
          disabled={busy !== null}
          onPress={() => void save("image")}
          style={styles.flex}
        />
      </View>
      {shared ? (
        <View style={styles.shared}>
          <Icon name="info" size={16} color="accent" />
          <Text variant="body-sm-strong" style={styles.flex}>
            {t(shared === "pdf" ? "kit.pdfShared" : "kit.imageShared")}
          </Text>
        </View>
      ) : null}
      <Callout tone="danger" icon="alert-circle" text={t("kit.fileWarning")} />

      {/* Off-screen card captured by "Save image": same look in any theme. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={card} collapsable={false} style={styles.imageCard}>
          <Text variant="h3" style={styles.inverse}>
            Keeplas
          </Text>
          <Text variant="h2" style={styles.inverse}>
            {t("kit.title")}
          </Text>
          <Text variant="body-sm" style={styles.inverseMuted}>
            {created}
          </Text>
          <View style={styles.imageWords}>
            <WordGrid phrase={phrase} inverse />
          </View>
          <View style={styles.imageQr}>
            <View style={styles.qrTile}>
              <QRCode value={encodeKitQr(phrase)} size={112} />
            </View>
            <Text variant="body-sm" style={[styles.inverseMuted, styles.flex]}>
              {t("kit.qr")}
            </Text>
          </View>
          <Text variant="body-sm" style={styles.inverseMuted}>
            {t("kit.warning")}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  word: { width: "50%", flexDirection: "row", gap: 8, alignItems: "baseline" },
  index: { width: 22 },
  actions: { flexDirection: "row", gap: 10 },
  shared: { flexDirection: "row", alignItems: "center", gap: 6 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
  imageCard: {
    width: 390,
    gap: 12,
    padding: 26,
    backgroundColor: colors.navy["900"],
  },
  imageWords: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.ivory["50"],
  },
  imageQr: { flexDirection: "row", alignItems: "center", gap: 16 },
  qrTile: {
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  inverse: { color: colors.white },
  inverseMuted: { color: colors.navy["200"] },
  inverseWord: { color: colors.navy["900"] },
});
