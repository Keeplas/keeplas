import { useState, type ReactNode } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import { Link, useParams } from "@/lib/navigation";
import { Button, buttonVariants, Loader, ErrorAlert } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { AuthHeroSection } from "../../(auth)/components/auth-hero-section";
import { MobileBrand } from "../../(auth)/components/mobile-brand";
import { useTranslations } from "@/lib/i18n";

const KNOWN_ROLES = ["family", "friend", "lawyer", "doctor", "other"];

interface InvitationShellProps {
  badgeLabel: string;
  heading: string;
  description: ReactNode;
  children: ReactNode;
}

function InvitationShell({
  badgeLabel,
  heading,
  description,
  children,
}: InvitationShellProps) {
  return (
    <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
      <AuthHeroSection />
      <section className="flex-1 flex items-center justify-center p-8 md:p-10 lg:p-12 xl:p-16 relative bg-surface md:overflow-y-auto">
        <MobileBrand />
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface-container-lowest rounded-full mb-4 shadow-sm">
              <svg
                className="w-5 h-5 text-secondary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
              <span className="text-label-md text-primary">{badgeLabel}</span>
            </div>
            <h3 className="text-headline-md text-primary mb-2">{heading}</h3>
            <p className="text-body-md text-on-surface-variant">
              {description}
            </p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const t = useTranslations("invite");
  const invitation = useQuery(api.trusted_contacts.getInvitationByToken, {
    token,
  });
  const acceptInvitation = useAuditedMutation(
    api.trusted_contacts.acceptInvitation,
  );
  const declineInvitation = useAuditedMutation(
    api.trusted_contacts.declineInvitation,
  );
  const { ensureOwnerKeypair, isReady: cryptoReady } = useRecipientCrypto();

  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (invitation === undefined || authLoading) {
    return <Loader fullscreen />;
  }

  if (invitation === null) {
    return (
      <InvitationShell
        badgeLabel={t("invalid.badge")}
        heading={t("invalid.heading")}
        description={t("invalid.body")}
      >
        <Link
          href="/login"
          className={buttonVariants({
            variant: "vault",
            size: "md",
            className: "w-full",
          })}
        >
          {t("goToKeeplas")}
        </Link>
      </InvitationShell>
    );
  }

  if (invitation.invitationStatus !== "pending") {
    const wasAccepted = invitation.invitationStatus === "accepted";
    return (
      <InvitationShell
        badgeLabel={t("processed.badge")}
        heading={t("processed.heading")}
        description={
          wasAccepted ? t("processed.accepted") : t("processed.declined")
        }
      >
        <Link
          href="/hub"
          className={buttonVariants({
            variant: "vault",
            size: "md",
            className: "w-full",
          })}
        >
          {t("goToHub")}
        </Link>
      </InvitationShell>
    );
  }

  if (done) {
    return (
      <InvitationShell
        badgeLabel={t("confirmed.badge")}
        heading={t("confirmed.heading")}
        description={
          <>
            {t("confirmed.bodyPre")}
            <strong className="text-primary">{invitation.inviterName}</strong>
            {t("confirmed.bodyPost")}
          </>
        }
      >
        <Link
          href="/hub"
          className={buttonVariants({
            variant: "vault",
            size: "md",
            className: "w-full",
          })}
        >
          {t("goToHub")}
        </Link>
      </InvitationShell>
    );
  }

  async function handleAccept() {
    if (!isAuthenticated) return;
    setAccepting(true);
    setError("");
    try {
      let contactPublicKey: string | undefined;
      if (cryptoReady) {
        const { publicKeyB64 } = await ensureOwnerKeypair();
        contactPublicKey = publicKeyB64;
      }
      await acceptInvitation({ token, contactPublicKey });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, t("acceptFailed")));
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!isAuthenticated) return;
    setDeclining(true);
    setError("");
    try {
      await declineInvitation({ token });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, t("declineFailed")));
    } finally {
      setDeclining(false);
    }
  }

  const roleLabel = KNOWN_ROLES.includes(invitation.role)
    ? t(`roles.${invitation.role}`)
    : t("roleFallback");

  return (
    <InvitationShell
      badgeLabel={t("invite.badge")}
      heading={t("invite.heading", { name: invitation.inviterName })}
      description={
        <>
          {t("invite.bodyPre")}
          <strong className="text-primary">{roleLabel}</strong>
          {t("invite.bodyPost", { name: invitation.inviterName })}
        </>
      }
    >
      <div className="bg-surface-container-low rounded-2xl p-5 mb-6 space-y-3">
        <p className="text-label-md text-secondary uppercase tracking-widest font-bold">
          {t("meaning.title")}
        </p>
        <ul className="text-body-md text-on-surface-variant space-y-2">
          <li className="flex gap-2">
            <span className="text-secondary mt-1.5 w-1 h-1 rounded-full bg-secondary shrink-0" />
            {t("meaning.bullet1")}
          </li>
          <li className="flex gap-2">
            <span className="text-secondary mt-1.5 w-1 h-1 rounded-full bg-secondary shrink-0" />
            {t("meaning.bullet2")}
          </li>
          <li className="flex gap-2">
            <span className="text-secondary mt-1.5 w-1 h-1 rounded-full bg-secondary shrink-0" />
            {t("meaning.bullet3")}
          </li>
        </ul>
      </div>

      <ErrorAlert message={error} />

      {!isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-body-md text-on-surface-variant text-center">
            {t("needAccount")}
          </p>
          <Link
            href={`/signup?redirect=/invite/${token}`}
            className={buttonVariants({
              variant: "vault",
              size: "md",
              className: "w-full",
            })}
          >
            {t("createAccount")}
          </Link>
          <Link
            href={`/login?redirect=/invite/${token}`}
            className="bg-surface-container text-primary w-full py-3 rounded-xl font-headline font-bold block text-center hover:bg-surface-container-high transition-colors"
          >
            {t("signIn")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            variant="vault"
            size="md"
            className="w-full cursor-pointer"
            onClick={handleAccept}
            disabled={accepting || declining}
          >
            {accepting ? t("accepting") : t("accept")}
          </Button>
          <button
            onClick={handleDecline}
            disabled={accepting || declining}
            className="bg-surface-container text-on-surface-variant w-full py-3 rounded-xl font-headline font-bold hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60"
          >
            {declining ? t("declining") : t("decline")}
          </button>
        </div>
      )}
    </InvitationShell>
  );
}
