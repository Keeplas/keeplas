import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/categories/page";

export const Route = createFileRoute("/_dashboard/settings/categories/")({
  component: Screen,
});
