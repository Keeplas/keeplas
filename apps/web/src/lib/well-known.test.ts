import { describe, expect, it } from "vitest";
import {
  appleAppSiteAssociation,
  assetLinks,
  wellKnownResponse,
} from "./well-known";

const env = {
  APPLE_TEAM_ID: "TEAM123456",
  IOS_BUNDLE_ID: "com.keeplas.app",
  ANDROID_PACKAGE_NAME: "com.keeplas.app",
  ANDROID_SHA256_CERT_FINGERPRINTS: "AA:BB, CC:DD",
};

describe("app association files", () => {
  it("links QR and invitation paths and passkeys to the iOS app", () => {
    expect(appleAppSiteAssociation(env)).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["TEAM123456.com.keeplas.app"],
            components: [
              { "/": "/link" },
              { "/": "/link/*" },
              { "/": "/capture" },
              { "/": "/invite/*" },
            ],
          },
        ],
      },
      webcredentials: { apps: ["TEAM123456.com.keeplas.app"] },
    });
  });

  it("lists every Android signing certificate", () => {
    expect(assetLinks(env)?.[0]).toMatchObject({
      target: { sha256_cert_fingerprints: ["AA:BB", "CC:DD"] },
    });
  });

  it("returns 404 until configured and ignores other paths", async () => {
    expect(wellKnownResponse("/.well-known/assetlinks.json", {})?.status).toBe(
      404,
    );
    expect(wellKnownResponse("/hub", env)).toBeNull();
    const res = wellKnownResponse(
      "/.well-known/apple-app-site-association",
      env,
    );
    expect(res?.headers.get("content-type")).toContain("application/json");
  });
});
