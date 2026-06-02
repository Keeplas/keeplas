import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/vault/[itemId]/page";

export const Route = createFileRoute("/_dashboard/vault/$itemId/")({
  component: Screen,
});
