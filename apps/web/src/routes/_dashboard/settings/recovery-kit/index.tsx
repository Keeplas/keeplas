import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/(dashboard)/settings/recovery-kit/page";

export const Route = createFileRoute("/_dashboard/settings/recovery-kit/")({
  component: Screen,
});
