import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/vault/new/page";

export const Route = createFileRoute("/_dashboard/vault/new/")({
  component: Screen,
});
