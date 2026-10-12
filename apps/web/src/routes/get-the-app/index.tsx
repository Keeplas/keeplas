import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/get-the-app/page";

export const Route = createFileRoute("/get-the-app/")({
  component: Screen,
});
