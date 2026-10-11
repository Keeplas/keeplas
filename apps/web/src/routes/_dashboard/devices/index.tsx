import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/devices/page";

export const Route = createFileRoute("/_dashboard/devices/")({
  component: Screen,
});
