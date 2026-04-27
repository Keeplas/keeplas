import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "__keeplas_ctx";

/**
 * Hand the sealed audit context cookie back to the React tree. The cookie
 * itself is HttpOnly (browser JS can't read it), so this thin proxy is the
 * only path the client has to learn its own server-attested IP and country.
 *
 * Returns 204 (no content) when the cookie is missing — typically because
 * `KEEPLAS_CTX_SECRET` is not configured locally — so callers can degrade
 * gracefully instead of bombing on every render.
 */
export function GET(request: NextRequest): NextResponse {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
