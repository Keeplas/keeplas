import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/security/page";

export const Route = createFileRoute("/security/")({
  head: () => ({
    meta: [
      { title: "Security & Zero-Knowledge — Keeplas" },
      {
        name: "description",
        content:
          "How Keeplas keeps your vault private — authentication, zero-knowledge encryption, device unlock, recovery, and the legally-admissible audit trail.",
      },
    ],
  }),
  component: Screen,
});
