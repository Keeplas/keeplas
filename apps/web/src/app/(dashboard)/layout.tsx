"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@keeplas/ui";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
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

  // Restore Master Key from encrypted bundle on dashboard load
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (onboardingState && onboardingState.onboardingStep !== "complete") {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 px-6 py-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
