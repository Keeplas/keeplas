import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from "@keeplas/ui";
import { Illustration } from "@/components/illustration";
import { StateDialog } from "@/components/state-dialog";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { usePathname } from "@/lib/navigation";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";

/**
 * Section 10 "We missed you": the check went unanswered and contacts are
 * being asked (stage 2). Nothing is shared until they confirm.
 */
export function LifeCheckMissedMessage({
  onConfirm,
  busy,
}: {
  onConfirm: () => void;
  busy: boolean;
}) {
  const t = useTranslations("lifeCheck.prompt.missed");
  return (
    <StateMessage
      icon={ICON_PATHS.activity}
      tone="warning"
      title={t("title")}
      body={t("body")}
    >
      <Button
        variant="primary"
        size="cta"
        className="w-full"
        onClick={onConfirm}
        disabled={busy}
      >
        {t("confirm")}
      </Button>
    </StateMessage>
  );
}

/**
 * W05-3 / W05-4 life check modal: one action, no snooze (BUSINESS-RULES).
 * It cannot be dismissed; answering closes it.
 */
export function LifeCheckModal({
  missed,
  onConfirm,
  busy,
}: {
  missed: boolean;
  onConfirm: () => void;
  busy: boolean;
}) {
  const t = useTranslations("lifeCheck.prompt");
  // Answering is the only way out: Escape and outside clicks do nothing.
  const stayOpen = () => {};
  if (missed) {
    return (
      <StateDialog open onOpenChange={stayOpen} title={t("missed.title")}>
        <LifeCheckMissedMessage onConfirm={onConfirm} busy={busy} />
      </StateDialog>
    );
  }
  return (
    <Dialog open onOpenChange={stayOpen}>
      <DialogContent
        overlayClassName="bg-scrim backdrop-blur-none"
        className={cn(
          "flex w-[520px] max-w-[calc(100%-32px)] flex-col items-center gap-[18px] rounded-lg border border-border-default bg-bg-surface p-[40px] text-center shadow-card",
          // Figma centers the modal on the main column, 147 px from the top.
          "md:left-[calc(50%+124px)] md:top-[max(24px,calc(50%-303px))] md:translate-y-0",
        )}
      >
        {/* The crest paints a daylight sky; Noir uses the night landscape. */}
        <img
          src="/assets/illustrations/desktop-modal-crest.svg"
          alt=""
          width={440}
          height={275}
          className="h-auto w-full max-w-[440px] dark:hidden"
        />
        <Illustration
          src="/assets/illustrations/desktop-landscape-night.svg"
          width={440}
          height={275}
          className="hidden h-auto w-full max-w-[440px] rounded-md dark:block"
        />
        <DialogTitle className="text-h1 text-text-primary">
          {t("title")}
        </DialogTitle>
        <DialogDescription className="text-body-lg text-text-muted">
          {t("body")}
        </DialogDescription>
        <Button
          variant="primary"
          size="cta"
          className="w-full"
          onClick={onConfirm}
          disabled={busy}
        >
          {t("confirm")}
        </Button>
        <p className="text-body-sm text-text-muted">{t("footer")}</p>
      </DialogContent>
    </Dialog>
  );
}

/** Shows the life check modal while a check is waiting for an answer. */
export function LifeCheckPrompt() {
  const t = useTranslations("lifeCheck.prompt");
  const pathname = usePathname();
  const cycle = useQuery(api.life_check.getActiveCycle);
  const validate = useAuditedMutation(api.life_check.validateCycle);
  const [busy, setBusy] = useState(false);

  // The Life check page answers, postpones or pauses the check itself.
  if (!cycle || pathname.startsWith("/life-check")) return null;

  async function confirm() {
    setBusy(true);
    try {
      await validate({ method: "tap" });
      toast({ title: t("thanks") });
    } catch (err) {
      toast({ variant: "error", title: getErrorMessage(err, t("failed")) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <LifeCheckModal
      missed={cycle.status === "awaiting_confirmation"}
      onConfirm={() => void confirm()}
      busy={busy}
    />
  );
}
