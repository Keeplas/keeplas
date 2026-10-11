import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { buttonVariants, cn, Loader } from "@keeplas/ui";
import { Link, useParams } from "@/lib/navigation";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen } from "@/components/auth-screen";
import { QRCodeSVG } from "@/components/qr-code-svg";
import { StateMessage } from "@/components/state-message";
import { StoreBadges } from "@/components/store-badges";

const primaryAction = cn(
  buttonVariants({ variant: "primary", size: "cta" }),
  "w-full",
);

/**
 * Trusted-contact invitation link. Invitations are answered in the Keeplas
 * app: the web only hands the link over to it (`keeplas://invite/<token>`),
 * or explains why the link no longer works.
 */
export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const t = useTranslations("invite");
  const g = useTranslations("getApp");
  const invitation = useQuery(api.trusted_contacts.getInvitationByToken, {
    token,
  });

  if (invitation === undefined) {
    return <Loader fullscreen />;
  }

  const name = invitation?.inviterName;
  let message;
  if (!invitation || invitation.invitationStatus === "revoked") {
    message = (
      <StateMessage
        icon={ICON_PATHS.clock}
        tone="warning"
        title={t("expired.title")}
        body={name ? t("expired.body", { name }) : t("expired.bodyNoName")}
      >
        <Link href="/" className={primaryAction}>
          {t("expired.action")}
        </Link>
      </StateMessage>
    );
  } else if (invitation.invitationStatus === "accepted") {
    message = (
      <StateMessage
        icon={ICON_PATHS.checkCircle}
        tone="success"
        title={t("accepted.title")}
        body={t("accepted.body", { name })}
      >
        <Link href="/login" className={primaryAction}>
          {t("accepted.action")}
        </Link>
      </StateMessage>
    );
  } else if (invitation.invitationStatus === "declined") {
    message = (
      <StateMessage
        icon={ICON_PATHS.revoke}
        title={t("declined.title")}
        body={t("declined.body", { name })}
      >
        <Link href="/" className={primaryAction}>
          {t("declined.action")}
        </Link>
      </StateMessage>
    );
  } else {
    message = (
      <StateMessage
        icon={ICON_PATHS.laptop}
        title={t("openOnPhone.title")}
        body={t("openOnPhone.body")}
      >
        <a href={`keeplas://invite/${token}`} className={primaryAction}>
          {t("openOnPhone.action")}
        </a>
        <div className="hidden rounded-md border border-border-default bg-bg-surface p-[12px] md:block">
          <QRCodeSVG value={window.location.href} size={160} />
        </div>
        <StoreBadges />
      </StateMessage>
    );
  }

  return (
    <AuthScreen title={g("heroTitle")} body={g("heroBody")}>
      {message}
    </AuthScreen>
  );
}
