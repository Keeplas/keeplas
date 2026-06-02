import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/contact/page";

export const Route = createFileRoute("/_dashboard/settings/contact/")({
  component: Screen,
});
