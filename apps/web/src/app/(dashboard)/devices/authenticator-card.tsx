import { useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Icon, Input, toast } from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
import { Panel, RowText, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";

/**
 * Google Authenticator (TOTP) on accounts that enrolled it before v2. New
 * accounts can't add one, so the card only shows while it is on, to turn it
 * off with a current code (step-up, see totp.disable).
 */
export function AuthenticatorCard() {
  const t = useTranslations("devices.authenticator");
  const status = useQuery(api.totp.getMyTotpStatus);
  const [open, setOpen] = useState(false);

  if (!status?.enrolled) return null;

  return (
    <Panel className="flex items-center gap-[12px] p-[20px]">
      <Icon
        path={ICON_PATHS.shieldCheck}
        className="size-[24px] shrink-0 text-text-link"
      />
      <RowText title={t("title")} description={t("description")} />
      <StatusChip
        tone="neutral"
        label={t("on")}
        dotClassName="bg-status-active"
      />
      <Button variant="danger" size="compact" onClick={() => setOpen(true)}>
        {t("turnOff")}
      </Button>
      {open ? <TurnOffDialog onClose={() => setOpen(false)} /> : null}
    </Panel>
  );
}

function TurnOffDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("devices.authenticator");
  const tc = useTranslations("common");
  const disable = useAuditedMutation(api.totp.disable);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await disable({ code });
      if (!result.success) {
        setError(t("invalid"));
        setCode("");
        return;
      }
      toast({ title: t("done") });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t("invalid")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("dialogTitle")}
      description={t("dialogBody")}
      width="w-[440px]"
    >
      <form onSubmit={submit} className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[6px]">
          <label
            htmlFor="totp-disable-code"
            className="text-body-sm text-text-muted"
          >
            {t("codeLabel")}
          </label>
          <Input
            id="totp-disable-code"
            variant="field"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          {error ? (
            <p role="alert" className="text-body-sm text-action-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-[12px]">
          <Button
            type="button"
            variant="plain"
            size="regular"
            onClick={onClose}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="regular"
            disabled={busy || code.length !== 6}
          >
            {t("turnOff")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
