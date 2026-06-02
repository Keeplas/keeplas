import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/login/recovery/page";

export const Route = createFileRoute("/login/recovery/")({
  component: Screen,
});
