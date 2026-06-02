import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/vault/page";

export const Route = createFileRoute("/_dashboard/vault/")({
  component: Screen,
});
