import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/preferences/page";

export const Route = createFileRoute("/_dashboard/settings/preferences/")({
  component: Screen,
});
