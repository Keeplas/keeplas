import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/roadmap/page";

export const Route = createFileRoute("/_dashboard/settings/roadmap/")({
  component: Screen,
});
