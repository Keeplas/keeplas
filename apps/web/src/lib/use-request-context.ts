"use client";

import { useEffect, useState } from "react";

/**
 * Sealed audit envelope mirrored from the `__keeplas_ctx` cookie. The
 * signature is computed by the Next.js middleware; the client treats the
 * payload as opaque and forwards it to Convex mutations as `_audit`.
 */
export interface AuditContext {
  ip: string;
  country: string;
  ts: number;
  sig: string;
}

let cached: AuditContext | null = null;
let inflight: Promise<AuditContext | null> | null = null;

async function fetchAuditContext(): Promise<AuditContext | null> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/context", { credentials: "same-origin" });
      if (res.status !== 200) return null;
      const data = (await res.json()) as AuditContext;
      cached = data;
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Read the server-attested audit context. Returns `null` until the first
 * fetch resolves (or if the middleware did not issue one — typically a dev
 * environment without `KEEPLAS_CTX_SECRET`).
 */
export function useRequestContext(): AuditContext | null {
  const [ctx, setCtx] = useState<AuditContext | null>(cached);

  useEffect(() => {
    if (ctx) return;
    let alive = true;
    fetchAuditContext().then((next) => {
      if (alive && next) setCtx(next);
    });
    return () => {
      alive = false;
    };
  }, [ctx]);

  return ctx;
}
