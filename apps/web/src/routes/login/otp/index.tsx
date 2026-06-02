import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/login/otp/page";

export const Route = createFileRoute("/login/otp/")({
  component: Screen,
});
