/**
 * Sealed audit envelope every audited Convex mutation carries as `_audit`
 * (server-attested IP + country + HMAC). The web app seals one per request
 * at `GET /api/context`; native clients have no cookie, so they fetch it and
 * keep it in memory.
 */
export interface AuditContext {
  ip: string;
  country: string;
  ts: number;
  sig: string;
}

/** Refetch well before Convex's 24 h limit, and when the network changed. */
export const AUDIT_CONTEXT_REFRESH_MS = 60 * 60 * 1000;

export interface AuditContextSource {
  get: () => Promise<AuditContext>;
  clear: () => void;
}

/**
 * Memoise the context for an hour (measured on the device clock from when it
 * was fetched, so a skewed clock cannot keep a stale seal) and share one
 * in-flight request between concurrent callers.
 */
export function createAuditContextSource(
  fetchContext: () => Promise<AuditContext>,
  now: () => number = Date.now,
): AuditContextSource {
  let cached: { value: AuditContext; fetchedAt: number } | null = null;
  let inflight: Promise<AuditContext> | null = null;

  return {
    get() {
      if (cached && now() - cached.fetchedAt < AUDIT_CONTEXT_REFRESH_MS) {
        return Promise.resolve(cached.value);
      }
      inflight ??= fetchContext()
        .then((value) => {
          cached = { value, fetchedAt: now() };
          return value;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    clear() {
      cached = null;
    },
  };
}

function isAuditContext(value: unknown): value is AuditContext {
  const v = value as AuditContext;
  return (
    typeof v?.ip === "string" &&
    typeof v.country === "string" &&
    typeof v.ts === "number" &&
    typeof v.sig === "string"
  );
}

/** `GET {appUrl}/api/context` → sealed context, or throws. */
export async function fetchAuditContext(appUrl: string): Promise<AuditContext> {
  const res = await fetch(`${appUrl}/api/context`, {
    headers: { Accept: "application/json" },
  });
  if (res.status !== 200) {
    throw new Error(`Audit context unavailable (${res.status})`);
  }
  const body: unknown = await res.json();
  if (!isAuditContext(body)) throw new Error("Malformed audit context");
  return body;
}
