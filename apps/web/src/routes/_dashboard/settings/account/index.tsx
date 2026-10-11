import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/account/page";

export const Route = createFileRoute("/_dashboard/settings/account/")({
  component: Screen,
});
