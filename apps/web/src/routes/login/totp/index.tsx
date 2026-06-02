import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/login/totp/page";

export const Route = createFileRoute("/login/totp/")({
  component: Screen,
});
