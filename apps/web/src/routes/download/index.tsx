import { createFileRoute, redirect } from "@tanstack/react-router";
import { STORE_URLS, storeUrlForUserAgent } from "@/lib/app-stores";

// Smart link behind the D-01 QR code: the phone's store, else D-01.
export const Route = createFileRoute("/download/")({
  beforeLoad: () => {
    const storeUrl = storeUrlForUserAgent(navigator.userAgent, STORE_URLS);
    if (storeUrl) throw redirect({ href: storeUrl });
    throw redirect({ to: "/get-the-app" });
  },
});
