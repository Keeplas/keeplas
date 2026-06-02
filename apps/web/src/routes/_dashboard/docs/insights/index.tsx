import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/insights/page";

export const Route = createFileRoute("/_dashboard/docs/insights/")({
  component: Screen,
});
