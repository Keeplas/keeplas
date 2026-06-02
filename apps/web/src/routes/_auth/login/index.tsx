import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(auth)/login/page";

export const Route = createFileRoute("/_auth/login/")({
  component: Screen,
});
