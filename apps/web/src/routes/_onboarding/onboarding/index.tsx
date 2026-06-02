import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(onboarding)/onboarding/page";

export const Route = createFileRoute("/_onboarding/onboarding/")({
  component: Screen,
});
