"use client";

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { OnboardingFlow } from "./onboarding-flow";

export default function OnboardingPage() {
  const router = useRouter();
  const onboardingState = useQuery(api.onboarding.getOnboardingState);
  const initOnboarding = useMutation(api.onboarding.initOnboarding);

  useEffect(() => {
    if (onboardingState === undefined || onboardingState === null) return;

    // If onboarding is complete, redirect to dashboard
    if (onboardingState.onboardingStep === "complete") {
      router.push("/dashboard");
      return;
    }

    // Initialize onboarding if not started
    if (onboardingState.onboardingStep === "auth_complete") {
      initOnboarding();
    }
  }, [onboardingState, router, initOnboarding]);

  if (onboardingState === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (onboardingState === null) {
    return null;
  }

  if (onboardingState.onboardingStep === "complete") {
    return null;
  }

  return <OnboardingFlow initialStep={onboardingState.onboardingStep} />;
}
