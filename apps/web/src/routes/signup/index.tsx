import { createFileRoute, redirect } from "@tanstack/react-router";

// Sign-up is mobile-only (D-01): legacy /signup links go to the smart download link.
export const Route = createFileRoute("/signup/")({
  beforeLoad: () => {
    throw redirect({ to: "/download" });
  },
});
