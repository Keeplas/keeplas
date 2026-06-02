import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";
import { Loader } from "@keeplas/ui";
import { Sidebar } from "@/components/sidebar";
import { FabAddEntry } from "@/components/fab-add-entry";
import { UnlockGate } from "@/components/unlock-gate";
import { UploadQueueProvider } from "@/lib/upload-queue";
import { useTranslations } from "@/lib/i18n";
import { api } from "@keeplas/backend/_generated/api";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const t = useTranslations("chrome");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated ? {} : "skip",
  );
  const totpGate = useQuery(
    api.totp.getMyTotpGate,
    isAuthenticated ? {} : "skip",
  );
  const loginOtpGate = useQuery(
    api.login_otp.getMyLoginOtpGate,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (onboardingState && onboardingState.onboardingStep !== "complete") {
      navigate({ to: "/onboarding" });
    }
  }, [onboardingState, navigate]);

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

  if (
    isLoading ||
    onboardingState === undefined ||
    totpGate === undefined ||
    loginOtpGate === undefined
  ) {
    return <Loader fullscreen label={t("layout.unlockingVault")} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (onboardingState && onboardingState.onboardingStep !== "complete") {
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
        <div className="flex flex-col md:flex-row min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 px-6 py-6 pb-24 md:pb-6">
            <Outlet />
          </main>
          <FabAddEntry />
        </div>
      </UploadQueueProvider>
    </UnlockGate>
  );
}
