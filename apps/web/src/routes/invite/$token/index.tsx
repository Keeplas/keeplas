import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/invite/[token]/page";

export const Route = createFileRoute("/invite/$token/")({
  component: Screen,
});
