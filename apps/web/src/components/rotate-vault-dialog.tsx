import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Progress,
  toast,
} from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { useRotateVault, type RotateStatus } from "@/lib/use-rotate-vault";

// Status keys that map to a user-facing progress label (resolved via t()).
const STATUS_LABEL_KEYS: Partial<Record<RotateStatus, string>> = {
  validating: "return.status.validating",
  rotating_keys: "return.status.rotatingKeys",
  reencrypting: "return.status.reencrypting",
  finalizing: "return.status.finalizing",
  done: "return.status.done",
};

function progressPercent(
  status: RotateStatus,
  done: number,
  total: number,
): number {
  switch (status) {
    case "validating":
      return 5;
    case "rotating_keys":
      return 20;
    case "reencrypting":
      return total > 0 ? 20 + Math.round((done / total) * 70) : 20;
    case "finalizing":
      return 95;
    case "done":
      return 100;
    default:
      return 0;
  }
}

interface RotateVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  submitLabel: string;
  successDescription: string;
  /** Runs right before the re-key (e.g. revoke released access first). */
  beforeRotate?: () => Promise<unknown>;
  /** When false, the dialog can only be closed after a failed attempt. */
  dismissable: boolean;
}

/**
 * Asks for the 24-word phrase and rotates the master key (useRotateVault):
 * fresh master key + owner keypair, every item re-encrypted and re-wrapped.
 */
export function RotateVaultDialog({
  open,
  onOpenChange,
  description,
  submitLabel,
  successDescription,
  beforeRotate,
  dismissable,
}: RotateVaultDialogProps) {
  const t = useTranslations("lifeCheck");
  const { rotate, status, progress, error } = useRotateVault();
  const [phrase, setPhrase] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const working =
    status === "validating" ||
    status === "rotating_keys" ||
    status === "reencrypting" ||
    status === "finalizing";
  // Never close mid-rotation: an interrupted run is resumable, but the dialog
  // should not vanish under the user while keys are moving.
  const canClose = !working && (dismissable || status === "error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const words = parseRecoveryPhrase(phrase);
    if (words.length !== 24) {
      setLocalError(t("return.phraseError"));
      return;
    }

    await beforeRotate?.();
    const ok = await rotate(words);
    if (ok) {
      setPhrase("");
      onOpenChange(false);
      toast({
        variant: "success",
        title: t("return.successTitle"),
        description: successDescription,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (canClose) onOpenChange(next);
      }}
    >
      <DialogContent className="bg-surface max-w-lg p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{t("return.dialogTitle")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <textarea
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={working}
            rows={4}
            placeholder={t("return.phrasePlaceholder")}
            className="w-full rounded-xs bg-surface-container-low p-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-secondary resize-none"
            autoComplete="off"
            spellCheck={false}
          />

          {working || status === "done" ? (
            <div className="space-y-2">
              <Progress
                value={progressPercent(status, progress.done, progress.total)}
              />
              <p className="text-label-md text-on-surface-variant">
                {STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : ""}
                {status === "reencrypting" && progress.total > 0
                  ? ` (${progress.done}/${progress.total})`
                  : ""}
              </p>
            </div>
          ) : null}

          {localError && <ErrorAlert message={localError} />}
          {error && <ErrorAlert message={error} />}

          <div className="flex justify-end gap-3">
            {canClose && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("return.cancel")}
              </Button>
            )}
            <Button type="submit" variant="vault" disabled={working}>
              {working ? t("return.working") : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
