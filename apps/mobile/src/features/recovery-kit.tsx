import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Callout, Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { openDeviceVault } from "@/crypto/device-vault";
import { useWithPin } from "@/features/pin/use-pin-gate";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useReplaceKit } from "@/lib/use-replace-kit";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { colors, radius } from "@/theme";
import { shareKitImage, shareKitPdf } from "./kit-export";

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
 * fires once a file went through the share sheet.
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
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);
  const [saved, setSaved] = useState<"pdf" | "image" | null>(null);
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
          rules: [t("kit.rule1"), t("kit.warning"), t("kit.rule3")],
        });
      } else {
        await shareKitImage(card, t("kit.title"));
      }
      setSaved(kind);
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
      {saved ? (
        <View style={styles.saved}>
          <Icon name="check" size={16} color="status.active" />
          <Text variant="body-sm-strong" color="status.active">
            {t(saved === "pdf" ? "kit.pdfSaved" : "kit.imageSaved")}
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
  saved: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  inverse: { color: colors.white },
  inverseMuted: { color: colors.navy["200"] },
  inverseWord: { color: colors.navy["900"] },
});
