import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

/**
 * The CSP nonce the security middleware (src/start.ts) drew for this
 * response. The router stamps it on the scripts it emits, and only those: the
 * CSP allow-lists nothing else. Undefined in the browser, where the router
 * reads it back from the `csp-nonce` meta tag it rendered.
 */
function requestCspNonce(): string | undefined {
  try {
    return (getGlobalStartContext() as { cspNonce?: string } | undefined)
      ?.cspNonce;
  } catch {
    // Created outside a request (no start context): no nonce to apply.
    return undefined;
  }
}

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    ssr: { nonce: requestCspNonce() },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
