import { useState, type ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button, cn, Icon, Input, Spinner } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen, authCardClass } from "./auth-screen";
import { Field } from "./vault/form-fields";

interface VerifyCodeScreenProps {
  /** Dictionary holding heading, codeLabel, verify, recoverInApp, signOut. */
  namespace: "auth.otp" | "auth.totp";
  body: string;
  busy: boolean;
  error: string | null;
  notice?: string | null;
  onSubmit: (code: string) => void;
  /** Extra action under the button (login OTP: "Resend code"). */
  children?: ReactNode;
}

/**
 * Sign-in step-up (login OTP, TOTP): a 6-digit code in the W04-1 card, beside
 * the sign-in hero.
 */
export function VerifyCodeScreen({
  namespace,
  body,
  busy,
  error,
  notice,
  onSubmit,
  children,
}: VerifyCodeScreenProps) {
  const t = useTranslations(namespace);
  const signInT = useTranslations("auth.signIn");
  const { signOut } = useAuthActions();
  const [code, setCode] = useState("");

  return (
    <AuthScreen title={signInT("heroTitle")} body={signInT("heroBody")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit(code);
        }}
        className={cn(
          authCardClass,
          "flex max-w-[456px] flex-col gap-[14px] p-[32px] shadow-card",
        )}
      >
        <h2 className="text-h2 text-text-primary">{t("heading")}</h2>
        <p className="text-body text-text-muted">{body}</p>
        {error ? (
          <p role="alert" className="text-body-sm text-action-danger">
            {error}
          </p>
        ) : notice ? (
          <p
            role="status"
            className="rounded-sm bg-bg-info px-[14px] py-[10px] text-body-sm text-text-body"
          >
            {notice}
          </p>
        ) : null}
        <Field label={t("codeLabel")} className="mt-[4px]">
          {(id) => (
            <Input
              id={id}
              variant="field"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
              className="h-[64px] border-border-strong text-center text-code"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="cta"
          disabled={code.length !== 6 || busy}
          className="w-full"
        >
          {busy ? (
            <Spinner size="sm" />
          ) : (
            <>
              {t("verify")}
              <Icon path={ICON_PATHS.chevronRight} className="size-[20px]" />
            </>
          )}
        </Button>
        {children}
        <div className="mt-[4px] flex flex-col items-center gap-[10px] border-t border-border-default pt-[14px] text-center text-body-sm text-text-muted">
          <p>{t("recoverInApp")}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-xs font-semibold text-text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {t("signOut")}
          </button>
        </div>
      </form>
    </AuthScreen>
  );
}
