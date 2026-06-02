import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/page";

export const Route = createFileRoute("/_dashboard/settings/")({
  component: Screen,
});
