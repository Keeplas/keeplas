import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/app/connect/page";

// Not under `_auth`: the flow signs in midway and must not be redirected, and
// the unlock gate sends signed-in users here to re-link a browser.
export const Route = createFileRoute("/connect/")({
  component: Screen,
});
