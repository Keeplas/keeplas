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

    // If onboarding is complete, redirect to hub
    if (onboardingState.onboardingStep === "complete") {
      router.push("/hub");
      return;
    }

    // Initialize onboarding if not started
    if (onboardingState.onboardingStep === "auth_complete") {
      initOnboarding();
    }
  }, [onboardingState, router, initOnboarding]);

  if (onboardingState === undefined) {
    return <Loader fullscreen />;
  }

  if (onboardingState === null) {
    return null;
  }

  if (onboardingState.onboardingStep === "complete") {
    return null;
  }

  return (
    <OnboardingFlow initialStep={onboardingState.onboardingStep} />
  );
}
