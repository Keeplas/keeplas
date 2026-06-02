import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/login/otp/recovery/page";

export const Route = createFileRoute("/login/otp/recovery/")({
  component: Screen,
});
