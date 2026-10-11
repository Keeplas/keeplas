import { useCallback } from "react";
import { useAction } from "convex/react";
import type { FunctionReference } from "convex/server";

import { auditContext } from "./use-audited-mutation";

type WithoutAudit<T> = Omit<T, "_audit">;

export function useAuditedAction<Action extends FunctionReference<"action">>(
  reference: Action,
) {
  const run = useAction(reference);
  return useCallback(
    async (args?: WithoutAudit<Action["_args"]>) =>
      run({
        ...(args ?? {}),
        _audit: await auditContext.get(),
      } as unknown as Action["_args"]),
    [run],
  );
}
