import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/emergency-info/page";

export const Route = createFileRoute("/_dashboard/docs/emergency-info/")({
  component: Screen,
});
