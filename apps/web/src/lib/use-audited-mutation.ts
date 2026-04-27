"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { FunctionReference } from "convex/server";
import { useRequestContext, AuditContext } from "./use-request-context";

type WithoutAudit<T> = Omit<T, "_audit">;

/**
 * Drop-in replacement for `useMutation` that targets a Convex mutation
 * declared via `auditedMutation()`. Injects the sealed `_audit` payload
 * (server-attested IP + country + HMAC) so the caller never has to know it
 * exists.
 *
 * Throws if invoked before the audit context is loaded — legal admissibility
 * of the resulting log entry depends on the seal being present, so failing
 * loud is intentional. Components that mount audited mutations should gate
 * the UI on `useRequestContext() !== null`.
 */
export function useAuditedMutation<
  Mutation extends FunctionReference<"mutation">,
>(
  reference: Mutation
): (
  args?: WithoutAudit<Mutation["_args"]>
) => Promise<Mutation["_returnType"]> {
  const ctx = useRequestContext();
  const fn = useMutation(reference);

  return useCallback(
    async (args) => {
      if (!ctx) {
        throw new Error(
          "Audit context unavailable — refresh the page or check that KEEPLAS_CTX_SECRET is configured."
        );
      }
      return await fn({
        ...(args ?? {}),
        _audit: ctx,
      } as unknown as Mutation["_args"]);
    },
    [fn, ctx]
  );
}

export type { AuditContext };
