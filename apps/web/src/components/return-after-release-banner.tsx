"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Icon,
  Progress,
  toast,
} from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRotateVault, type RotateStatus } from "@/lib/use-rotate-vault";

// Status keys that map to a user-facing progress label (resolved via t()).
const STATUS_LABEL_KEYS: Partial<Record<RotateStatus, string>> = {
  validating: "return.status.validating",
  rotating_keys: "return.status.rotatingKeys",
  redistributing: "return.status.redistributing",
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
      return 15;
    case "redistributing":
      return 30;
    case "reencrypting":
      return total > 0 ? 30 + Math.round((done / total) * 60) : 30;
    case "finalizing":
      return 95;
    case "done":
      return 100;
    default:
      return 0;
  }
}

/**
 * Shown to a vault owner who returns AFTER an emergency release fired. Lets
 * them revoke the granted access and rotate the master key so the leaked
 * material can no longer open anything they change going forward.
 */
export function ReturnAfterReleaseBanner() {
  const t = useTranslations("lifeCheck");
  const requests = useQuery(api.access_requests.getAccessRequests);
  const viewer = useQuery(api.users.viewer);
  const revokeReleasedAccess = useAuditedMutation(
    api.access_requests.revokeReleasedAccess,
  );
  const { rotate, status, progress, error } = useRotateVault();

  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const hasApprovedRelease = (requests ?? []).some(
    (r) => r.status === "approved",
  );
  const rotationInProgress = !!viewer?.encryptedAsymmetricSecretKeyPrev;

  if (!hasApprovedRelease && !rotationInProgress) return null;

  const working =
    status === "validating" ||
    status === "rotating_keys" ||
    status === "redistributing" ||
    status === "reencrypting" ||
    status === "finalizing";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const words = parseRecoveryPhrase(phrase);
    if (words.length !== 24) {
      setLocalError(t("return.phraseError"));
      return;
    }

    // Cut the granted access first (idempotent), then re-key the vault.
    await revokeReleasedAccess();
    const ok = await rotate(words);
    if (ok) {
      setPhrase("");
      setOpen(false);
      toast({
        variant: "success",
        title: t("return.successTitle"),
        description: t("return.successDescription"),
      });
    }
  }

  return (
    <>
      <div className="mb-8 rounded-2xl bg-error-container text-on-error-container p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon
            path={ICON_PATHS.shieldCheck}
            className="w-6 h-6 shrink-0 mt-1"
          />
          <div>
            <p className="text-title-md">
              {rotationInProgress
                ? t("return.bannerTitleResume")
                : t("return.bannerTitleReleased")}
            </p>
            <p className="text-body-md mt-1 max-w-xl">
              {rotationInProgress
                ? t("return.bannerBodyResume")
                : t("return.bannerBodyReleased")}
            </p>
          </div>
        </div>
        <Button
          variant="vault"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          {rotationInProgress ? t("return.resumeCta") : t("return.secureCta")}
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Never close mid-rotation: an interrupted run is resumable, but the
          // dialog should not vanish under the user while keys are moving.
          if (!working) setOpen(next);
        }}
      >
        <DialogContent className="bg-surface max-w-lg p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{t("return.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("return.dialogDescription")}
            </DialogDescription>
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
              className="w-full rounded-xl bg-surface-container-low p-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-secondary resize-none"
              autoComplete="off"
              spellCheck={false}
            />

            {working || status === "done" ? (
              <div className="space-y-2">
                <Progress
                  value={progressPercent(status, progress.done, progress.total)}
                />
                <p className="text-label-md text-on-surface-variant">
                  {STATUS_LABEL_KEYS[status]
                    ? t(STATUS_LABEL_KEYS[status])
                    : ""}
                  {status === "reencrypting" && progress.total > 0
                    ? ` (${progress.done}/${progress.total})`
                    : ""}
                </p>
              </div>
            ) : null}

            {localError && <ErrorAlert message={localError} />}
            {error && <ErrorAlert message={error} />}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={working}
                onClick={() => setOpen(false)}
              >
                {t("return.cancel")}
              </Button>
              <Button type="submit" variant="vault" disabled={working}>
                {working ? t("return.working") : t("return.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
