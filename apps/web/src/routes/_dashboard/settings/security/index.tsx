import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/security/page";

export const Route = createFileRoute("/_dashboard/settings/security/")({
  component: Screen,
});
