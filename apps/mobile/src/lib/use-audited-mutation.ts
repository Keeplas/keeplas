import { useCallback } from "react";
import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

import { createAuditContextSource, fetchAuditContext } from "./audit-context";
import { env } from "./env";

/** One app-wide cache: the seal is per network, not per screen. */
export const auditContext = createAuditContextSource(() =>
  fetchAuditContext(env.appUrl),
);

type WithoutAudit<T> = Omit<T, "_audit">;

/**
 * Mobile twin of apps/web/src/lib/use-audited-mutation.ts: calls a Convex
 * mutation declared with `auditedMutation()` (or taking `_audit`), injecting
 * the sealed context fetched from the web app. Fails loudly when the context
 * cannot be obtained: an audited write without a seal is refused server-side.
 */
export function useAuditedMutation<
  Mutation extends FunctionReference<"mutation">,
>(
  reference: Mutation,
): (
  args?: WithoutAudit<Mutation["_args"]>,
) => Promise<Mutation["_returnType"]> {
  const mutate = useMutation(reference);
  return useCallback(
    async (args) =>
      mutate({
        ...(args ?? {}),
        _audit: await auditContext.get(),
      } as unknown as Mutation["_args"]),
    [mutate],
  );
}
