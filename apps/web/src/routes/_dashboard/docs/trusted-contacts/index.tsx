import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/trusted-contacts/page";

export const Route = createFileRoute("/_dashboard/docs/trusted-contacts/")({
  component: Screen,
});
