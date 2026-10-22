import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/link/page";

export const Route = createFileRoute("/capture/")({
  component: Screen,
});
