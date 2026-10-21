import { useRef, useState } from "react";
import { Button, Icon, InfoCallout, Progress } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import {
  NotKeeplasArchive,
  useImportArchive,
  type ImportProgress,
  type ImportResult,
} from "@/lib/use-import-archive";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; progress: ImportProgress | null }
  | { kind: "done"; result: ImportResult }
  | { kind: "failed"; message: string };

export default function ImportPage() {
  const t = useTranslations("settings.importArchive");
  const importArchive = useImportArchive();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function start(file: File) {
    setPhase({ kind: "running", progress: null });
    try {
      const result = await importArchive(
        file,
        {
          untitled: t("untitled"),
          folderSuffix: (name) => t("folderSuffix", { name }),
        },
        (progress) => setPhase({ kind: "running", progress }),
      );
      setPhase({ kind: "done", result });
    } catch (error) {
      setPhase({
        kind: "failed",
        message:
          error instanceof NotKeeplasArchive ? t("notKeeplas") : t("failed"),
      });
    }
  }

  const progress = phase.kind === "running" ? phase.progress : null;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[16px]">
      <div className="flex flex-col gap-[8px]">
        <h1 className="text-h1 text-text-primary">{t("title")}</h1>
        <p className="text-body-lg text-text-muted">{t("body")}</p>
      </div>
      <InfoCallout icon={ICON_PATHS.alertCircle} tone="info">
        {t("notes")}
      </InfoCallout>

      {phase.kind === "running" ? (
        <div className="flex flex-col gap-[8px]">
          <span className="text-label text-text-primary">
            {progress && progress.total > 0
              ? t("progress", { done: progress.done, total: progress.total })
              : t("reading")}
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
      {phase.kind === "done" ? (
        <InfoCallout icon={ICON_PATHS.checkCircle} tone="success">
          {t("done", { n: phase.result.imported })}
        </InfoCallout>
      ) : null}
      {phase.kind === "done" && phase.result.skippedFiles > 0 ? (
        <InfoCallout icon={ICON_PATHS.alertTriangle} tone="warning">
          {t("skippedFiles", { n: phase.result.skippedFiles })}
        </InfoCallout>
      ) : null}
      {phase.kind === "failed" ? (
        <InfoCallout icon={ICON_PATHS.alertTriangle} tone="warning">
          {phase.message}
        </InfoCallout>
      ) : null}

      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void start(file);
        }}
      />
      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={phase.kind === "running"}
          onClick={() => input.current?.click()}
        >
          <Icon path={ICON_PATHS.download} className="size-[18px]" />
          {t("choose")}
        </Button>
      </div>
    </div>
  );
}
