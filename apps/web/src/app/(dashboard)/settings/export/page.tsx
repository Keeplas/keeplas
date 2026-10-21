import { useEffect, useRef, useState } from "react";
import { Button, Icon, InfoCallout, Progress } from "@keeplas/ui";
import { Panel } from "@/components/v2/surface";
import { formatBytes } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import {
  ExportCancelled,
  useExportVault,
  type ExportProgress,
} from "@/lib/use-export-vault";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; progress: ExportProgress | null }
  | { kind: "ready"; size: number; skipped: number }
  | { kind: "failed" };

const CONTENTS = ["items", "files", "notes", "contacts"] as const;

export default function ExportPage() {
  const t = useTranslations("settings.export");
  const locale = useLocale();
  const exportVault = useExportVault();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const stop = useRef(false);

  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  async function start() {
    stop.current = false;
    setPhase({ kind: "running", progress: null });
    try {
      const { archive, name, skipped } = await exportVault(
        { untitled: t("untitled"), noFolder: t("noFolder"), file: t("file") },
        (progress) => setPhase({ kind: "running", progress }),
        () => stop.current,
      );
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPhase({ kind: "ready", size: archive.size, skipped });
    } catch (error) {
      setPhase(
        error instanceof ExportCancelled
          ? { kind: "idle" }
          : { kind: "failed" },
      );
    }
  }

  const progress = phase.kind === "running" ? phase.progress : null;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[16px]">
      <div className="flex flex-col gap-[8px]">
        <h1 className="text-h1 text-text-primary">{t("title")}</h1>
        <p className="text-body-lg text-text-muted">{t("body")}</p>
      </div>

      <Panel className="flex flex-col gap-[14px] p-[20px]">
        {CONTENTS.map((key) => (
          <div key={key} className="flex flex-col gap-[2px]">
            <span className="text-label text-text-primary">
              {t(`contents.${key}`)}
            </span>
            <span className="text-body-sm text-text-muted">
              {t(`contents.${key}Body`)}
            </span>
          </div>
        ))}
      </Panel>

      {phase.kind === "running" ? (
        <div className="flex flex-col gap-[8px]">
          <span className="text-label text-text-primary">
            {progress && progress.total > 0
              ? t("progress", { done: progress.done, total: progress.total })
              : t("preparing")}
          </span>
          <Progress
            value={
              progress && progress.total
                ? Math.round((progress.done / progress.total) * 100)
                : 0
            }
          />
          <span className="text-body-sm text-text-muted">{t("keepOpen")}</span>
        </div>
      ) : null}

      {phase.kind === "ready" ? (
        <InfoCallout icon={ICON_PATHS.checkCircle} tone="success">
          {t("ready", { size: formatBytes(phase.size, locale) })}
        </InfoCallout>
      ) : null}
      {phase.kind === "ready" && phase.skipped > 0 ? (
        <InfoCallout icon={ICON_PATHS.alertTriangle} tone="warning">
          {t("skipped", { n: phase.skipped })}
        </InfoCallout>
      ) : null}
      {phase.kind === "failed" ? (
        <InfoCallout icon={ICON_PATHS.alertTriangle} tone="warning">
          {t("failed")}
        </InfoCallout>
      ) : null}
      <InfoCallout icon={ICON_PATHS.lock} tone="warning">
        {t("warning")}
      </InfoCallout>

      <div className="flex justify-end gap-[12px]">
        {phase.kind === "running" ? (
          <Button
            variant="outlined"
            onClick={() => {
              stop.current = true;
            }}
          >
            {t("cancel")}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void start()}>
            <Icon path={ICON_PATHS.download} className="size-[18px]" />
            {phase.kind === "failed"
              ? t("retry")
              : phase.kind === "ready"
                ? t("again")
                : t("start")}
          </Button>
        )}
      </div>
    </div>
  );
}
