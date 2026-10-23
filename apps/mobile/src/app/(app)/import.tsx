import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { ProgressBar } from "@/components/controls";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  NotKeeplasArchive,
  useImportArchive,
  type ImportProgress,
  type ImportResult,
} from "@/features/import/use-import-archive";
import { useI18n } from "@/providers/i18n-provider";
import { keepUnlockedWhile } from "@/lib/auto-lock";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; progress: ImportProgress | null }
  | { kind: "done"; result: ImportResult }
  | { kind: "failed"; message: string };

export default function ImportArchive() {
  const router = useRouter();
  const { t } = useI18n();
  const importArchive = useImportArchive();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function choose() {
    const picked = await keepUnlockedWhile(() =>
      DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-zip-compressed"],
        copyToCacheDirectory: true,
      }),
    );
    if (picked.canceled) return;
    setPhase({ kind: "running", progress: null });
    try {
      const result = await importArchive(picked.assets[0].uri, (progress) =>
        setPhase({ kind: "running", progress }),
      );
      setPhase({ kind: "done", result });
    } catch (error) {
      setPhase({
        kind: "failed",
        message:
          error instanceof NotKeeplasArchive
            ? t("importArchive.notKeeplas")
            : t("importArchive.failed"),
      });
    }
  }

  const progress = phase.kind === "running" ? phase.progress : null;

  return (
    <Screen
      header={<AppHeader onBack={router.back} />}
      gap={14}
      footer={
        phase.kind === "done" ? (
          <Button
            label={t("importArchive.openVault")}
            onPress={() => router.replace("/home")}
          />
        ) : (
          <Button
            label={t("importArchive.choose")}
            loading={phase.kind === "running"}
            onPress={() => void choose()}
          />
        )
      }
    >
      <Text variant="h1">{t("importArchive.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("importArchive.body")}
      </Text>
      <Callout icon="info" text={t("importArchive.notes")} />
      {phase.kind === "running" ? (
        <View style={styles.progress}>
          <Text variant="label">
            {progress && progress.total > 0
              ? t("importArchive.progress", {
                  done: progress.done,
                  total: progress.total,
                })
              : t("importArchive.reading")}
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
      {phase.kind === "done" ? (
        <Callout
          tone="success"
          icon="check-circle"
          text={t("importArchive.done", { n: phase.result.imported })}
        />
      ) : null}
      {phase.kind === "done" && phase.result.skippedFiles > 0 ? (
        <Callout
          tone="warning"
          icon="alert-circle"
          text={t("importArchive.skippedFiles", {
            n: phase.result.skippedFiles,
          })}
        />
      ) : null}
      {phase.kind === "failed" ? (
        <Callout tone="danger" icon="alert-triangle" text={phase.message} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { gap: 8 },
});
