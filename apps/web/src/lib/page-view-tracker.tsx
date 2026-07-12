import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useRouterState } from "@tanstack/react-router";
import { api } from "@keeplas/backend/_generated/api";
import { useRequestContext } from "./use-request-context";

/**
 * Emits a `page_view` analytics event on every navigation, consumed by the
 * keeplas-admin console. Mounted once inside the Convex provider tree.
 *
 * Records the matched route TEMPLATE (e.g. "/_dashboard/vault/$itemId"), never
 * the resolved path — so no sensitive identifier leaves the client (see the
 * analytics_events schema note). Reuses the sealed `_audit` envelope for
 * server-attested IP + country; no-ops until that context has loaded. Calls the
 * plain `analytics.track` mutation directly (NOT `useAuditedMutation`): the
 * event is intentionally outside the tamper-evident audit chain and works for
 * logged-out visitors too.
 */
export function PageViewTracker() {
  const track = useMutation(api.analytics.track);
  const ctx = useRequestContext();
  const routeId = useRouterState({
    select: (s) =>
      s.matches[s.matches.length - 1]?.routeId ?? s.location.pathname,
  });
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    if (lastTracked.current === routeId) return;
    lastTracked.current = routeId;
    void track({ eventType: "page_view", route: routeId, _audit: ctx }).catch(
      () => {
        // Analytics is best-effort — never surface a tracking failure to the user.
      },
    );
  }, [ctx, routeId, track]);

  return null;
}
