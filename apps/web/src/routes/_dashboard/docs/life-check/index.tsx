import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/life-check/page";

export const Route = createFileRoute("/_dashboard/docs/life-check/")({
  component: Screen,
});
