/**
 * `POST /api/csp-report` (used only by src/start.ts): logs CSP violations so
 * an injection attempt shows up. The endpoint is anonymous by design
 * (browsers send reports without credentials), so it bounds what one caller
 * can make it write: a small body, a few reports per request, a per-minute
 * line budget, and only the fields worth reading (no query strings, which may
 * carry invite or Life Check tokens).
 */

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const MAX_LINES_PER_WINDOW = 60;
const WINDOW_MS = 60_000;

// Per server instance: enough to spot a broken page, too little to flood logs.
let windowStartedAt = 0;
let linesInWindow = 0;

function takeLogBudget(): boolean {
  const now = Date.now();
  if (now - windowStartedAt >= WINDOW_MS) {
    windowStartedAt = now;
    linesInWindow = 0;
  }
  if (linesInWindow >= MAX_LINES_PER_WINDOW) return false;
  linesInWindow++;
  return true;
}

/** The body as text, or null past MAX_BODY_BYTES (declared or streamed). */
async function readCappedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return null;
  }
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Blob(chunks as BlobPart[]).text();
}

function text(value: unknown, max = 100): string | undefined {
  return typeof value === "string" && value ? value.slice(0, max) : undefined;
}

/** Origin of a URL (`data:` / `blob:` for opaque ones), or the CSP keyword. */
function originOf(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value);
    return url.origin === "null" ? url.protocol : url.origin;
  } catch {
    return value.slice(0, 40); // "inline", "eval", …
  }
}

function pathOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return new URL(value).pathname.slice(0, 200);
  } catch {
    return undefined;
  }
}

/** Both the legacy `report-uri` shape and Reporting API entries. */
function summarize(report: unknown): Record<string, string | undefined> | null {
  if (typeof report !== "object" || report === null) return null;
  const outer = report as Record<string, unknown>;
  const body = outer["csp-report"] ?? outer.body ?? outer;
  if (typeof body !== "object" || body === null) return null;
  const r = body as Record<string, unknown>;
  return {
    directive: text(
      r["effective-directive"] ??
        r.effectiveDirective ??
        r["violated-directive"],
    ),
    blocked: originOf(r["blocked-uri"] ?? r.blockedURL),
    document: pathOf(r["document-uri"] ?? r.documentURL),
    disposition: text(r.disposition),
  };
}

export async function handleCspReport(request: Request): Promise<Response> {
  const ack = new Response(null, { status: 204 });
  const raw = await readCappedBody(request);
  if (!raw) return ack;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return ack; // Malformed: nothing to log, still ack.
  }
  const reports = (Array.isArray(body) ? body : [body]).slice(
    0,
    MAX_REPORTS_PER_REQUEST,
  );
  for (const report of reports) {
    const summary = summarize(report);
    if (!summary || !takeLogBudget()) continue;
    console.warn("[csp-violation]", JSON.stringify(summary));
  }
  return ack;
}
