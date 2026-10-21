import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  ErrorAlert,
  Icon,
  InfoCallout,
  Input,
  Label,
} from "@keeplas/ui";
import { Panel } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/navigation";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";

const LOSSES = ["items", "shares", "succession", "plan"] as const;

export default function DeleteAccountPage() {
  const t = useTranslations("settings.deleteAccount");
  const locale = useLocale();
  const router = useRouter();
  const status = useQuery(api.account_deletion.getStatus);
  const requestDeletion = useAuditedMutation(api.account_deletion.request);
  const cancelDeletion = useAuditedMutation(api.account_deletion.cancel);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const word = t("confirmWord");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setTyped("");
    } catch (err) {
      setError(getErrorMessage(err, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  if (status === undefined) return null;

  if (status) {
    const date = new Date(status.scheduledAt).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[16px]">
        <h1 className="text-h1 text-text-primary">{t("scheduledTitle")}</h1>
        <p className="text-body-lg text-text-muted">
          {t("scheduledBody", { date })}
        </p>
        <ErrorAlert message={error} />
        <div className="flex flex-col gap-[12px] sm:flex-row">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void run(() => cancelDeletion({}))}
          >
            {t("cancel")}
          </Button>
          <Link
            href="/settings/export"
            className="self-center text-label text-text-link"
          >
            {t("exportFirst")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[16px]">
      <h1 className="text-h1 text-text-primary">{t("title")}</h1>
      <p className="text-body-lg text-text-muted">{t("body")}</p>

      <Panel className="flex flex-col gap-[14px] p-[20px]">
        <span className="text-label text-text-primary">{t("losesTitle")}</span>
        {LOSSES.map((key) => (
          <div key={key} className="flex gap-[10px]">
            <Icon
              path={ICON_PATHS.alertCircle}
              className="mt-[2px] size-[18px] shrink-0 text-action-danger"
            />
            <span className="text-body text-text-body">
              {t(`loses.${key}`)}
            </span>
          </div>
        ))}
      </Panel>

      <InfoCallout icon={ICON_PATHS.download} tone="info">
        <Link href="/settings/export" className="text-text-link underline">
          {t("exportFirst")}
        </Link>{" "}
        {t("exportHint")}
      </InfoCallout>

      <InfoCallout icon={ICON_PATHS.alertTriangle} tone="warning">
        {t("graceNote")}
      </InfoCallout>

      <form
        className="flex flex-col gap-[12px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (typed.trim().toUpperCase() !== word) {
            setError(t("typeWord", { word }));
            return;
          }
          void run(() => requestDeletion({ confirmation: "DELETE" }));
        }}
      >
        <ErrorAlert message={error} />
        <Label htmlFor="confirm-delete">{t("typeLabel", { word })}</Label>
        <Input
          id="confirm-delete"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={word}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex flex-col gap-[12px] sm:flex-row">
          <Button type="submit" variant="danger" disabled={busy}>
            {t("submit")}
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={() => router.push("/settings")}
          >
            {t("keep")}
          </Button>
        </div>
      </form>
    </div>
  );
}
