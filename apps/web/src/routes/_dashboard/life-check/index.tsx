import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/life-check/page";

export const Route = createFileRoute("/_dashboard/life-check/")({
  component: Screen,
});
