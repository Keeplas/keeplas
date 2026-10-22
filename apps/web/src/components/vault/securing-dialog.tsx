import type { FileKind } from "@keeplas/backend/lib/vault_groups";
import { Button, cn, Icon } from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import type { JobProgress } from "@/lib/upload-queue";
import { FileRow } from "./file-row";
import { EncryptionNote } from "./form-fields";

type StepState = "done" | "active" | "pending";

const ORDER = ["encrypting", "uploading", "saving", "done"] as const;

/** Figma "App/Progress step": indicator, title, detail, optional bar. */
function Step({
  state,
  title,
  detail,
  percent,
}: {
  state: StepState;
  title: string;
  detail: string;
  percent?: number;
}) {
  return (
    <li className="flex gap-[14px]">
      <span
        className={cn(
          "flex size-[28px] shrink-0 items-center justify-center rounded-full",
          state === "done" && "bg-status-active text-text-inverse",
          state === "active" && "border-2 border-progress-fill bg-bg-surface",
          state === "pending" && "border-2 border-border-default bg-bg-surface",
        )}
      >
        {state === "done" ? (
          <Icon
            path={ICON_PATHS.check}
            strokeWidth={2.4}
            className="size-[16px]"
          />
        ) : state === "active" ? (
          <span className="size-[10px] rounded-full bg-progress-fill" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <span
          className={cn(
            "text-[15px] leading-[22px] font-semibold",
            state === "pending" ? "text-text-muted" : "text-text-primary",
          )}
        >
          {title}
        </span>
        <span className="text-body-sm text-text-muted">{detail}</span>
        {percent !== undefined ? (
          <span
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={title}
            className="mt-[2px] h-[6px] overflow-hidden rounded-full bg-progress-track"
          >
            <span
              className="block h-full rounded-full bg-progress-fill transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * W06-4 "Securing your item": encrypted here, encrypted copy uploading,
 * then protected once the server has it. Closing keeps it going in the
 * background (a toast follows it).
 */
export function SecuringDialog({
  open,
  file,
  progress,
  onCancel,
  onBackground,
  onOpenItem,
}: {
  open: boolean;
  file: { kind: FileKind; name: string; detail: string };
  progress: JobProgress | undefined;
  onCancel: () => void;
  onBackground: () => void;
  onOpenItem: () => void;
}) {
  const t = useTranslations("vaultItem.securing");
  const phase = progress?.phase ?? "encrypting";
  const at = ORDER.indexOf(phase as (typeof ORDER)[number]);
  const state = (step: number): StepState =>
    at > step ? "done" : at === step ? "active" : "pending";
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.uploaded / progress.total) * 100)
      : 0;
  const done = phase === "done";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && (done ? onOpenItem() : onBackground())}
      title={t("title")}
      description={done ? t("doneBody") : t("body")}
      width="w-[540px]"
      // Anchored at the top (W06-4: 141 px on 900): the steps change
      // height as they progress, the dialog must not jump.
      className="md:top-[max(16px,calc(50%-309px))] md:translate-y-0"
    >
      <FileRow kind={file.kind} name={file.name} detail={file.detail} />
      <ol className="flex flex-col gap-[22px] py-[4px]">
        <Step
          state={state(0)}
          title={t(state(0) === "done" ? "encrypted" : "encrypting")}
          detail={t(state(0) === "done" ? "encryptedBody" : "encryptingBody")}
        />
        <Step
          state={state(1)}
          title={t("uploading")}
          detail={
            state(1) === "done"
              ? t("uploadedBody")
              : t("uploadingBody", { percent })
          }
          percent={state(1) === "active" ? percent : undefined}
        />
        <Step
          state={done ? "done" : state(2)}
          title={t("protected")}
          detail={done ? t("protectedBody") : t("protectedWaiting")}
        />
      </ol>
      <EncryptionNote>{t("note")}</EncryptionNote>
      <div className="flex justify-end gap-[12px]">
        {done ? (
          <Button variant="primary" size="regular" onClick={onOpenItem}>
            {t("open")}
          </Button>
        ) : (
          <>
            <Button variant="plain" size="regular" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button variant="bordered" size="regular" onClick={onBackground}>
              {t("background")}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
