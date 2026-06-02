import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/shared-with-me/[contactId]/memorial/page";

export const Route = createFileRoute(
  "/_dashboard/shared-with-me/$contactId/memorial/",
)({
  component: Screen,
});
