import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/login/totp/recovery/page";

export const Route = createFileRoute("/login/totp/recovery/")({
  component: Screen,
});
