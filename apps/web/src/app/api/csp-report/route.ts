import { NextRequest, NextResponse } from "next/server";

/**
 * Collector for Content-Security-Policy violation reports.
 *
 * The CSP `report-to csp-endpoint` directive (modern Reporting API, sent as
 * `application/reports+json`) and the legacy `report-uri` directive (sent as
 * `application/csp-report`) both POST here. We log violations server-side so
 * an injection attempt or a broken third-party surfaces in the logs instead
 * of failing silently. No user data is involved — reports describe the
 * blocked resource, not page content.
 *
 * Always answers 204 so the browser never retries a failed report.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    // `report-to` batches an array of reports; `report-uri` sends one object.
    const reports = Array.isArray(body) ? body : [body];
    for (const report of reports) {
      console.warn("[csp-violation]", JSON.stringify(report));
    }
  } catch {
    // Malformed / empty body — nothing to log, still ack.
  }
  return new NextResponse(null, { status: 204 });
}
