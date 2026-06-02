import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/usage/page";

export const Route = createFileRoute("/_dashboard/settings/usage/")({
  component: Screen,
});
