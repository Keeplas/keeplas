import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/recovery/page";

export const Route = createFileRoute("/_dashboard/docs/recovery/")({
  component: Screen,
});
