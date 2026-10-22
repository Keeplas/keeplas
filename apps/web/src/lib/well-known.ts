/**
 * App association files served by the web host so that QR links (`/link`,
 * `/capture`) and invitations (`/invite/*`) open the Keeplas app, and the
 * app's native passkeys share the web relying party. Values come from env;
 * a file is not served (null) until its env is set.
 */

const APP_PATHS = ["/link", "/link/*", "/capture", "/invite/*"];

type Env = Record<string, string | undefined>;

/** iOS: Universal Links + webcredentials (passkeys). */
export function appleAppSiteAssociation(env: Env): object | null {
  const { APPLE_TEAM_ID, IOS_BUNDLE_ID } = env;
  if (!APPLE_TEAM_ID || !IOS_BUNDLE_ID) return null;
  const appId = `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`;
  return {
    applinks: {
      details: [
        { appIDs: [appId], components: APP_PATHS.map((p) => ({ "/": p })) },
      ],
    },
    webcredentials: { apps: [appId] },
  };
}

/** Android: App Links + credential sharing (passkeys). */
export function assetLinks(env: Env): object[] | null {
  const pkg = env.ANDROID_PACKAGE_NAME;
  const fingerprints = (env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  if (!pkg || fingerprints.length === 0) return null;
  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

/** Response for a `/.well-known/*` path, or null when not one of ours. */
export function wellKnownResponse(pathname: string, env: Env): Response | null {
  const body =
    pathname === "/.well-known/apple-app-site-association"
      ? appleAppSiteAssociation(env)
      : pathname === "/.well-known/assetlinks.json"
        ? assetLinks(env)
        : undefined;
  if (body === undefined) return null;
  if (body === null) return new Response(null, { status: 404 });
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
