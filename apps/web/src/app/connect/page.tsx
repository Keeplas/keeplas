import { useEffect, useState, type ReactNode } from "react";
import { Button, Checkbox, cn, Spinner } from "@keeplas/ui";
import { useRouter } from "@/lib/navigation";
import { formatCountdown } from "@/lib/format";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen, authCardClass } from "@/components/auth-screen";
import { QRCodeSVG } from "@/components/qr-code-svg";
import { useConnectWithPhone } from "./use-connect-with-phone";

const QR_SIZE = 240;

/** W04-2: link this browser by scanning a QR code with the Keeplas app. */
export default function ConnectWithPhonePage() {
  const t = useTranslations("auth.connect");
  const router = useRouter();
  const flow = useConnectWithPhone();
  const { state } = flow;

  useEffect(() => {
    if (state.phase === "done") router.replace("/hub");
  }, [state.phase, router]);

  return (
    <AuthScreen
      title={t("heroTitle")}
      body={t("heroBody")}
      heroClassName="lg:w-[44.4%]"
    >
      <div
        className={cn(
          authCardClass,
          "flex max-w-[656px] flex-col gap-[40px] p-[40px] md:flex-row",
        )}
      >
        <div className="flex flex-col gap-[24px] md:w-[260px]">
          <Step number={1} title={t("step1")} detail={t("step1Detail")} />
          <Step number={2} title={t("step2")} detail={t("step2Detail")} />
          <Step number={3} title={t("step3")} detail={t("step3Detail")} />
          <div className="flex items-center gap-[10px]">
            <span className="text-body text-text-muted">{t("expiresIn")}</span>
            <span className="text-h2 tabular-nums text-text-primary">
              {state.phase === "waiting" ? (
                <Countdown expiresAt={state.expiresAt} onEnd={flow.expire} />
              ) : (
                formatCountdown(0)
              )}
            </span>
          </div>
          <label className="flex gap-[12px]">
            <Checkbox
              checked={flow.trusted}
              onCheckedChange={(checked) => flow.setTrusted(checked === true)}
              disabled={state.phase !== "creating" && state.phase !== "waiting"}
            />
            <span className="flex flex-col gap-[2px]">
              <span className="text-label text-text-primary">{t("trust")}</span>
              <span className="text-body-sm text-text-muted">
                {t("trustDetail")}
              </span>
            </span>
          </label>
        </div>

        <div className="flex size-[274px] shrink-0 items-center justify-center self-center rounded-[16px] border border-border-default bg-bg-surface p-[16px]">
          {state.phase === "waiting" ? (
            <QRCodeSVG value={state.qrUrl} size={QR_SIZE} />
          ) : state.phase === "expired" ? (
            <QrNotice text={t("expired")}>
              <Button variant="primary" size="cta" onClick={flow.restart}>
                {t("newCode")}
              </Button>
            </QrNotice>
          ) : state.phase === "rejected" ? (
            <QrNotice text={t("rejected")}>
              <Button variant="primary" size="cta" onClick={flow.restart}>
                {t("retry")}
              </Button>
            </QrNotice>
          ) : state.phase === "error" ? (
            <QrNotice text={t("error")}>
              <Button variant="primary" size="cta" onClick={flow.restart}>
                {t("retry")}
              </Button>
            </QrNotice>
          ) : (
            <QrNotice text={state.phase === "creating" ? "" : t("linking")}>
              <Spinner />
            </QrNotice>
          )}
        </div>
      </div>
    </AuthScreen>
  );
}

function Step({
  number,
  title,
  detail,
}: {
  number: number;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-bg-info text-label text-text-primary">
        {number}
      </span>
      <span className="flex flex-col gap-[2px]">
        <span className="text-label text-text-primary">{title}</span>
        <span className="text-body-sm text-text-muted">{detail}</span>
      </span>
    </div>
  );
}

function QrNotice({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-[16px] text-center">
      {text ? <p className="text-body text-text-body">{text}</p> : null}
      {children}
    </div>
  );
}

/** mm:ss until `expiresAt`; calls `onEnd` once at zero. */
function Countdown({
  expiresAt,
  onEnd,
}: {
  expiresAt: number;
  onEnd: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = expiresAt - now;

  useEffect(() => {
    if (remaining <= 0) {
      onEnd();
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onEnd]);

  return <>{formatCountdown(remaining)}</>;
}
