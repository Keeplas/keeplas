import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/letters/page";

export const Route = createFileRoute("/_dashboard/docs/letters/")({
  component: Screen,
});
