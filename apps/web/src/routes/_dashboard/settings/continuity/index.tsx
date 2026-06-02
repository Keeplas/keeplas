import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/continuity/page";

export const Route = createFileRoute("/_dashboard/settings/continuity/")({
  component: Screen,
});
