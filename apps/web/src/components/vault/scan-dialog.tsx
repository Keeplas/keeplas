import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  buildCaptureQr,
  CAPTURE_QR_TTL_MS,
} from "@keeplas/backend/lib/capture_qr";
import { Button, Icon, toast } from "@keeplas/ui";
import { QRCodeSVG } from "@/components/qr-code-svg";
import { Modal } from "@/components/v2/modal";
import { formatClock } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useNow } from "@/lib/use-now";
import { EncryptionNote } from "./form-fields";

const STEPS = ["open", "add", "point"] as const;

interface Session {
  handoffId: Id<"capture_handoffs">;
  /** When to show a new code, on this computer's clock. */
  deadline: number;
}

const RENEW_EARLY_MS = 5_000;

/** W06-7 body: the QR, the three steps, the live status, the actions. */
export function ScanView({
  qr,
  status,
  remainingMs,
  onRenew,
  onUpload,
  onCancel,
}: {
  /** undefined while the code is being made. */
  qr: string | undefined;
  status: "waiting" | "claimed";
  remainingMs: number;
  /** A phone claimed the code but the scan never came: start over. */
  onRenew: () => void;
  onUpload: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("vaultItem.scan");
  return (
    <>
      <div className="flex flex-col items-center gap-[28px] sm:flex-row">
        <div className="flex size-[230px] shrink-0 items-center justify-center rounded-md border border-border-default bg-bg-surface p-[14px]">
          {qr ? (
            <QRCodeSVG
              value={qr}
              size={200}
              badge={
                <span className="flex size-[40px] items-center justify-center rounded-full bg-header-text text-bg-header">
                  <Icon path={ICON_PATHS.lock} className="size-[20px]" />
                </span>
              }
            />
          ) : (
            <span className="size-[200px] animate-pulse rounded-sm bg-bg-subtle" />
          )}
        </div>
        <ol className="flex min-w-0 flex-1 flex-col gap-[16px]">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-[12px]">
              <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-bg-info text-[13px] leading-[18px] font-semibold text-text-primary">
                {index + 1}
              </span>
              <span className="flex flex-col gap-[2px]">
                <span className="text-[15px] leading-[22px] font-semibold text-text-primary">
                  {t(`steps.${step}.title`)}
                </span>
                <span className="text-body-sm text-text-muted">
                  {t(`steps.${step}.body`)}
                </span>
              </span>
            </li>
          ))}
          <li
            role="status"
            className="flex items-center gap-[10px] rounded-sm bg-bg-subtle px-[12px] py-[10px] text-[13px] leading-[18px] font-medium text-text-body"
          >
            <Icon
              path={ICON_PATHS.sync}
              className="size-[16px] shrink-0 text-text-accent motion-safe:animate-spin motion-safe:[animation-duration:3s]"
            />
            <span className="flex-1">
              {status === "claimed"
                ? t("scanning")
                : t("waiting", { time: formatClock(remainingMs / 1000) })}
            </span>
            {status === "claimed" ? (
              <button
                type="button"
                onClick={onRenew}
                className="shrink-0 rounded-xs font-semibold text-text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                {t("newCode")}
              </button>
            ) : null}
          </li>
        </ol>
      </div>
      <EncryptionNote>{t("encrypted")}</EncryptionNote>
      <div className="flex items-center gap-[12px]">
        <Button variant="plain" size="regular" onClick={onUpload}>
          <Icon path={ICON_PATHS.cloudUpload} className="size-[16px]" />
          {t("upload")}
        </Button>
        <span className="flex-1" />
        <Button variant="bordered" size="regular" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </>
  );
}

/**
 * W06-7 "Scan with your phone": the owner's phone scans the QR, captures
 * the pages and seals them itself; the item then opens here. The code is
 * renewed every 2 minutes until the phone claims it.
 */
export function ScanDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: () => void;
}) {
  const t = useTranslations("vaultItem.scan");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      width="w-[640px]"
    >
      {/* Mounted while open: no code is made or renewed when closed. */}
      <ScanSession onUpload={onUpload} onClose={() => onOpenChange(false)} />
    </Modal>
  );
}

function ScanSession({
  onUpload,
  onClose,
}: {
  onUpload: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("vaultItem.scan");
  const router = useRouter();
  const now = useNow(1000);
  const create = useAuditedMutation(api.capture_handoffs.create);
  const [session, setSession] = useState<Session | null>(null);
  const handoff = useQuery(
    api.capture_handoffs.get,
    session ? { handoffId: session.handoffId } : "skip",
  );
  const creating = useRef(false);
  const opened = useRef(false);

  // Gone (replaced or purged), or unclaimed past its deadline: a new code.
  const stale =
    session !== null &&
    (handoff === null ||
      (handoff?.status !== "claimed" &&
        handoff?.status !== "completed" &&
        now >= session.deadline));

  useEffect(() => {
    if ((session && !stale) || creating.current) return;
    creating.current = true;
    create({})
      .then((next) =>
        setSession({
          handoffId: (next as { handoffId: Id<"capture_handoffs"> }).handoffId,
          // Measured on this computer's clock (it may differ from the
          // server's), a few seconds before the server stops accepting it.
          deadline: Date.now() + CAPTURE_QR_TTL_MS - RENEW_EARLY_MS,
        }),
      )
      .catch(() => toast({ variant: "error", title: t("failed") }))
      .finally(() => {
        creating.current = false;
      });
  }, [session, stale, create, t]);

  useEffect(() => {
    if (handoff?.status !== "completed" || !handoff.itemId) return;
    if (opened.current) return;
    opened.current = true;
    toast({ variant: "success", title: t("saved") });
    onClose();
    router.push(`/vault/${handoff.itemId}`);
  }, [handoff, onClose, router, t]);

  return (
    <ScanView
      qr={
        session && !stale
          ? buildCaptureQr(window.location.origin, session.handoffId)
          : undefined
      }
      status={handoff?.status === "claimed" ? "claimed" : "waiting"}
      remainingMs={session ? Math.max(0, session.deadline - now) : 0}
      onRenew={() => setSession(null)}
      onUpload={() => {
        onClose();
        onUpload();
      }}
      onCancel={onClose}
    />
  );
}
