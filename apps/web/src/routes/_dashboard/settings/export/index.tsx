import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/export/page";

export const Route = createFileRoute("/_dashboard/settings/export/")({
  component: Screen,
});
