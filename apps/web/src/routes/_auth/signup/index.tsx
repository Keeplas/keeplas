import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(auth)/signup/page";

export const Route = createFileRoute("/_auth/signup/")({
  component: Screen,
});
