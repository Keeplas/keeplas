import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/subscription/page";

export const Route = createFileRoute("/_dashboard/settings/subscription/")({
  component: Screen,
});
