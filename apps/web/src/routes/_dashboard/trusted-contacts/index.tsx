import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/trusted-contacts/page";

export const Route = createFileRoute("/_dashboard/trusted-contacts/")({
  component: Screen,
});
