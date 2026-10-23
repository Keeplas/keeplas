import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import type { File } from "expo-file-system";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { ProgressBar } from "@/components/controls";
import { Screen } from "@/components/screen";
import { Callout, Card, InfoRow } from "@/components/surfaces";
import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import {
  ExportCancelled,
  useExportVault,
  type ExportProgress,
} from "@/features/export/use-export-vault";
import { formatBytes } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { keepUnlockedWhile } from "@/lib/auto-lock";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; progress: ExportProgress | null }
  | { kind: "ready"; archive: File; skipped: number }
  | { kind: "failed" };

const CONTENTS: { key: string; icon: IconName }[] = [
  { key: "items", icon: "document" },
  { key: "files", icon: "image-gallery" },
  { key: "notes", icon: "note" },
  { key: "contacts", icon: "people" },
];

export default function ExportData() {
  const router = useRouter();
  const { t, language } = useI18n();
  const exportVault = useExportVault();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const stop = useRef(false);
  const archive = useRef<File | null>(null);

  useEffect(
    () => () => {
      stop.current = true;
      if (archive.current?.exists) archive.current.delete();
    },
    [],
  );

  async function start() {
    stop.current = false;
    setPhase({ kind: "running", progress: null });
    try {
      const { archive: file, skipped } = await exportVault(
        (progress) => setPhase({ kind: "running", progress }),
        () => stop.current,
      );
      archive.current = file;
      setPhase({ kind: "ready", archive: file, skipped });
    } catch (error) {
      setPhase(
        error instanceof ExportCancelled
          ? { kind: "idle" }
          : { kind: "failed" },
      );
    }
  }

  async function share(file: File) {
    await keepUnlockedWhile(() =>
      Sharing.shareAsync(file.uri, {
        mimeType: "application/zip",
        UTI: "public.zip-archive",
        dialogTitle: t("export.title"),
      }),
    );
  }

  const progress = phase.kind === "running" ? phase.progress : null;

  return (
    <Screen
      header={<AppHeader onBack={router.back} />}
      gap={14}
      footer={
        phase.kind === "running" ? (
          <Button
            variant="secondary"
            label={t("common.cancel")}
            onPress={() => {
              stop.current = true;
            }}
          />
        ) : phase.kind === "ready" ? (
          <Button
            label={t("export.share")}
            onPress={() => void share(phase.archive)}
          />
        ) : (
          <Button
            label={
              phase.kind === "failed" ? t("common.tryAgain") : t("export.start")
            }
            onPress={() => void start()}
          />
        )
      }
    >
      <Text variant="h1">{t("export.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("export.body")}
      </Text>
      <Card gap={14}>
        {CONTENTS.map((row) => (
          <InfoRow
            key={row.key}
            leading={<Icon name={row.icon} size={22} />}
            title={t(`export.contents.${row.key}`)}
            description={t(`export.contents.${row.key}Body`)}
          />
        ))}
      </Card>
      {phase.kind === "running" ? (
        <View style={styles.progress}>
          <Text variant="label">
            {progress && progress.total > 0
              ? t("export.progress", {
                  done: progress.done,
                  total: progress.total,
                })
              : t("export.preparing")}
          </Text>
          <ProgressBar
            value={
              progress && progress.total ? progress.done / progress.total : 0
            }
          />
          <Text variant="body-sm" color="text.muted">
            {t("export.keepOpen")}
          </Text>
        </View>
      ) : null}
      {phase.kind === "ready" ? (
        <Callout
          tone="success"
          icon="check-circle"
          text={t("export.ready", {
            size: formatBytes(phase.archive.size ?? 0, language),
          })}
        />
      ) : null}
      {phase.kind === "ready" && phase.skipped > 0 ? (
        <Callout
          tone="warning"
          icon="alert-circle"
          text={t("export.skipped", { n: phase.skipped })}
        />
      ) : null}
      {phase.kind === "failed" ? (
        <Callout
          tone="danger"
          icon="alert-triangle"
          text={t("export.failed")}
        />
      ) : null}
      <Callout
        tone="warning"
        icon="alert-triangle"
        text={t("export.warning")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { gap: 8 },
});
