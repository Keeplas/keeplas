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
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRotateVault, type RotateStatus } from "@/lib/use-rotate-vault";

const STATUS_LABEL: Record<RotateStatus, string> = {
  idle: "",
  validating: "Verifying your recovery phrase…",
  rotating_keys: "Generating a new master key…",
  redistributing: "Re-sealing recovery shards…",
  reencrypting: "Re-encrypting your vault…",
  finalizing: "Finalizing…",
  done: "Done",
  error: "",
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
      setLocalError("Enter all 24 words of your recovery phrase.");
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
        title: "Vault secured",
        description: "Access was revoked and your vault was re-keyed.",
      });
    }
  }

  return (
    <>
      <div className="mb-8 rounded-2xl bg-error-container text-on-error-container p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon path={ICON_PATHS.shieldCheck} className="w-6 h-6 shrink-0 mt-1" />
          <div>
            <p className="text-title-md">
              {rotationInProgress
                ? "Finish securing your vault"
                : "Your vault was released"}
            </p>
            <p className="text-body-md mt-1 max-w-xl">
              {rotationInProgress
                ? "A re-keying was started but not finished. Resume it to fully retire the old keys."
                : "Trusted contacts were granted access. If you are back, revoke that access and re-key your vault. This protects everything from now on — it cannot recover what was already read."}
            </p>
          </div>
        </div>
        <Button
          variant="vault"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          {rotationInProgress ? "Resume re-keying" : "I'm back — secure my vault"}
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
            <DialogTitle>Secure my vault</DialogTitle>
            <DialogDescription>
              Enter your 24-word recovery phrase. We&apos;ll revoke the released
              access and generate a fresh master key, re-encrypting every item.
              Items a contact already opened during the release cannot be taken
              back — this secures everything going forward.
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
              placeholder="Paste or type your 24 words…"
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
                  {STATUS_LABEL[status]}
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
                Cancel
              </Button>
              <Button type="submit" variant="vault" disabled={working}>
                {working ? "Securing…" : "Revoke & re-key"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
