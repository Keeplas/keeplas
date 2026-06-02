import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/shared-with-me/page";

export const Route = createFileRoute("/_dashboard/shared-with-me/")({
  component: Screen,
});
