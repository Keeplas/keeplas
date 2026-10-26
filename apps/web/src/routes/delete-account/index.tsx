import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/delete-account/page";

export const Route = createFileRoute("/delete-account/")({
  head: () => ({
    meta: [
      { title: "Delete your account | Keeplas" },
      {
        name: "description",
        content:
          "How to delete your Keeplas account and its data, in the app or by request if you no longer have the app.",
      },
    ],
  }),
  component: Screen,
});
