import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/recovery/page";

export const Route = createFileRoute("/_dashboard/settings/recovery/")({
  component: Screen,
});
