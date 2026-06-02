import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/terminate/page";

export const Route = createFileRoute("/_dashboard/terminate/")({
  component: Screen,
});
