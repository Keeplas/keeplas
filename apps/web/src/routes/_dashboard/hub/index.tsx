import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/hub/page";

export const Route = createFileRoute("/_dashboard/hub/")({
  component: Screen,
});
