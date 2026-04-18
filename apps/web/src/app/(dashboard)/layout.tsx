"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader } from "@keeplas/ui";
import { Sidebar } from "@/components/sidebar";
import { useRestoreMasterKey } from "@/lib/use-restore-master-key";
import { api } from "@keeplas/backend/_generated/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated ? {} : "skip"
  );

  useRestoreMasterKey();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (onboardingState && onboardingState.onboardingStep !== "complete") {
      router.push("/onboarding");
    }
  }, [onboardingState, router]);

  if (isLoading || onboardingState === undefined) {
    return <Loader fullscreen label="Unlocking your vault" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (onboardingState && onboardingState.onboardingStep !== "complete") {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
