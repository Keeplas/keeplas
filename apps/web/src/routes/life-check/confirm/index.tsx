import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/life-check/confirm/page";

export const Route = createFileRoute("/life-check/confirm/")({
  component: Screen,
});
