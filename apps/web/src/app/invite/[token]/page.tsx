"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import Image from "next/image";
import Link from "next/link";
import { Button, buttonVariants, Loader, ErrorAlert } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { exportPublicKey } from "@keeplas/crypto";

const ROLE_LABELS: Record<string, string> = {
  family: "Family member",
  friend: "Friend",
  lawyer: "Lawyer",
  doctor: "Doctor",
  other: "Trusted contact",
};

export default function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const invitation = useQuery(api.trusted_contacts.getInvitationByToken, {
    token,
  });
  const acceptInvitation = useMutation(
    api.trusted_contacts.acceptInvitation
  );
  const declineInvitation = useMutation(
    api.trusted_contacts.declineInvitation
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
      <div className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="text-center max-w-md">
          <h1 className="text-display-lg text-primary mb-4">
            Invalid Invitation
          </h1>
          <p className="text-on-surface-variant mb-6">
            This invitation link is invalid or has expired. Please ask the vault
            owner to send a new invitation.
          </p>
          <Link
            href="/login"
            className={buttonVariants({ variant: "vault", size: "md" })}
          >
            Go to Keeplas
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.invitationStatus !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="text-center max-w-md">
          <h1 className="text-display-lg text-primary mb-4">
            Invitation Already Processed
          </h1>
          <p className="text-on-surface-variant mb-6">
            This invitation has already been{" "}
            {invitation.invitationStatus === "accepted"
              ? "accepted"
              : "declined"}
            .
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "vault", size: "md" })}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          </div>
          <h1 className="text-display-lg text-primary mb-4">
            You&apos;re now a Trusted Contact
          </h1>
          <p className="text-on-surface-variant mb-6">
            You are now part of {invitation.inviterName}&apos;s recovery
            network. You may receive a recovery fragment to help protect their
            vault.
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "vault", size: "md" })}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  async function handleAccept() {
    if (!isAuthenticated) return;
    setAccepting(true);
    setError("");
    try {
      let contactPublicKey: string | undefined;
      if (cryptoReady) {
        const { publicKey } = await ensureOwnerKeypair();
        contactPublicKey = await exportPublicKey(publicKey);
      }
      await acceptInvitation({ token, contactPublicKey });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to accept invitation"));
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
      setError(getErrorMessage(err, "Failed to decline invitation"));
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={36}
            height={36}
          />
          <span className="text-headline-md text-primary">
            Keeplas
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface-container-low rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-7 h-7 text-on-primary-container"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
          </div>

          <h1 className="text-headline-md text-primary mb-2">
            Trusted Contact Invitation
          </h1>

          <p className="text-body-lg text-on-surface-variant mb-6">
            <strong>{invitation.inviterName}</strong> has designated you as a{" "}
            <strong>
              {ROLE_LABELS[invitation.role] ?? "trusted contact"}
            </strong>{" "}
            in their Keeplas vault.
          </p>

          <div className="bg-surface-container-lowest rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm text-on-surface">
              <strong>What this means:</strong>
            </p>
            <ul className="text-sm text-on-surface-variant space-y-1.5 list-disc list-inside">
              <li>You will receive a recovery fragment</li>
              <li>
                You may be asked to help recover the vault in an emergency
              </li>
              <li>You will never see vault contents unless access is granted</li>
            </ul>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant mb-4">
                You need a Keeplas account to accept this invitation.
              </p>
              <Link
                href={`/signup?redirect=/invite/${token}`}
                className={buttonVariants({
                  variant: "vault",
                  size: "md",
                  className: "w-full",
                })}
              >
                Create Account
              </Link>
              <Link
                href={`/login?redirect=/invite/${token}`}
                className="bg-surface-container text-primary w-full py-3 rounded-xl font-headline font-bold block hover:bg-surface-container-high transition-colors"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {error && <ErrorAlert message={error} />}

              <Button
                variant="vault"
                size="md"
                className="w-full cursor-pointer"
                onClick={handleAccept}
                disabled={accepting || declining}
              >
                {accepting ? "Accepting..." : "Accept Invitation"}
              </Button>

              <button
                onClick={handleDecline}
                disabled={accepting || declining}
                className="bg-surface-container text-on-surface-variant w-full py-3 rounded-xl font-headline font-bold hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60"
              >
                {declining ? "Declining..." : "Decline"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
