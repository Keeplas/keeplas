import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/docs/vault/page";

export const Route = createFileRoute("/_dashboard/docs/vault/")({
  component: Screen,
});
