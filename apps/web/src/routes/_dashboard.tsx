import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";
import { Loader } from "@keeplas/ui";
import { useAuthActions } from "@convex-dev/auth/react";
import { AppShell } from "@/components/shell/app-shell";
import { ShellAccountProvider } from "@/components/shell/shell-account";
import { UnlockGate } from "@/components/unlock-gate";
import { ForcedRotationGate } from "@/components/forced-rotation-gate";
import { LifeCheckPrompt } from "@/components/life-check-prompt";
import { OfflineNotice } from "@/components/offline-notice";
import { UploadQueueProvider } from "@/lib/upload-queue";
import { VaultDataProvider } from "@/lib/vault-data";
import { useTranslations } from "@/lib/i18n";
import { useBackfillPendingShares } from "@/lib/use-backfill-pending-shares";
import { purgeLegacyShards } from "@/lib/purge-legacy-shards";
import { api } from "@keeplas/backend/_generated/api";
import { getInitials } from "@/lib/user";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

/**
 * Mounts the owner-side re-wrap of deferred shares once the vault is unlocked.
 * Renders nothing — lives inside UnlockGate so it only runs with the master
 * key available.
 */
function PendingShareBackfill() {
  useBackfillPendingShares();
  return null;
}

function DashboardLayout() {
  const t = useTranslations("chrome");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const totpGate = useQuery(
    api.totp.getMyTotpGate,
    isAuthenticated ? {} : "skip",
  );
  const loginOtpGate = useQuery(
    api.login_otp.getMyLoginOtpGate,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    purgeLegacyShards();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (totpGate?.required) {
      navigate({ to: "/login/totp" });
    }
  }, [totpGate?.required, navigate]);

  // Login OTP is the last gate: only redirect once TOTP is satisfied so the
  // two gates don't fight over the route.
  useEffect(() => {
    if (totpGate && !totpGate.required && loginOtpGate?.required) {
      navigate({ to: "/login/otp" });
    }
  }, [totpGate, loginOtpGate?.required, navigate]);

  if (isLoading || totpGate === undefined || loginOtpGate === undefined) {
    return <Loader fullscreen label={t("layout.unlockingVault")} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (totpGate.required) {
    return null;
  }

  if (loginOtpGate.required) {
    return null;
  }

  return (
    <UnlockGate>
      <UploadQueueProvider>
        <VaultDataProvider>
          <PendingShareBackfill />
          <ForcedRotationGate />
          <LifeCheckPrompt />
          <OfflineNotice />
          <ShellAccountProvider
            account={{
              initials: getInitials(viewer?.name, 1),
              signOut: () => void signOut(),
            }}
          >
            <AppShell>
              <Outlet />
            </AppShell>
          </ShellAccountProvider>
        </VaultDataProvider>
      </UploadQueueProvider>
    </UnlockGate>
  );
}
