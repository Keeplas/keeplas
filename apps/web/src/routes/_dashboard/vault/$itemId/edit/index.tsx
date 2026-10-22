import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/vault/[itemId]/edit/page";

export const Route = createFileRoute("/_dashboard/vault/$itemId/edit/")({
  component: Screen,
});
