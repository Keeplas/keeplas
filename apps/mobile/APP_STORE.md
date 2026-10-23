# iOS: App Store Connect & TestFlight

How the Keeplas iOS app gets from this repo to TestFlight and the App Store. Builds and uploads go through EAS; App Store Connect (ASC) handles testers, review and release. General EAS profiles and environment variables: [`README.md`](./README.md).

## Identifiers

| Item                      | Value                          | Where it lives                            |
| ------------------------- | ------------------------------ | ----------------------------------------- |
| Apple Team ID             | `67T9Q44562` (PRINCE CODE LTD) | developer.apple.com → Membership          |
| Bundle ID                 | `com.keeplas.app` (explicit)   | `app.json` → `expo.ios.bundleIdentifier`  |
| SKU                       | `keeplas-ios`                  | ASC → App Information (cannot be changed) |
| ASC App ID (Apple ID)     | `6825985002`                   | ASC → App Information → Apple ID          |
| EAS project               | `keeplas/keeplas`              | `app.json` → `expo.extra.eas.projectId`   |
| Internal TestFlight group | `Team (Expo)`                  | ASC → TestFlight → Internal Testing       |

## One-time setup

Already done for Keeplas. Repeat these steps only for a new Apple account, a new bundle ID, or a self-hosted fork.

### 1. Register the App ID

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App:

- **Description**: `Keeplas`. **Bundle ID**: Explicit, `com.keeplas.app`.
- **Capabilities**: tick only these three. Apple ticks In-App Purchase by default; leave it.

| Capability         | Why                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| App Attest         | Sign-up is mobile-only and proves the genuine app (`src/lib/attestation.ts` → `packages/convex/attestation_node.ts`) |
| Associated Domains | Passkeys (`webcredentials:app.keeplas.com`) and universal links (`applinks:app.keeplas.com`)                         |
| Push Notifications | `expo-notifications` (life checks, alerts)                                                                           |

Face ID, camera, microphone and photos are `Info.plist` permissions (set by the config plugins in `app.json`), not capabilities.

`app.json` must keep the App Attest entitlement (`com.apple.developer.devicecheck.appattest-environment: "production"`). EAS syncs capabilities from the entitlements on every build. Without that line it turns App Attest **off** on the App ID (`Synced capabilities: Disabled: App Attest` in the build log). The server always accepts production attestations, so dev builds still work.

### 2. Create the app in App Store Connect

ASC → Apps → **+** → New App: platform iOS, name `Keeplas`, primary language English, bundle ID `com.keeplas.app`, SKU `keeplas-ios`, user access Full Access. If the bundle ID is not in the list yet, reload the page after step 1.

### 3. Server environment

The web host serves `/.well-known/apple-app-site-association` (`apps/web/src/lib/well-known.ts`) and Convex verifies App Attest. Both need `APPLE_TEAM_ID` and `IOS_BUNDLE_ID`:

1. Set them in Infisical `prod` under **`/keeplas_app`**. Values that exist only in `/keeplas_mobile` are not synced to Vercel or Convex.
2. Push them to Convex: `pnpm sync:convex-env`.
3. Infisical syncs to Vercel automatically, but a variable only applies from the next deployment, so redeploy the web app.
4. Verify that this returns `200` and lists `67T9Q44562.com.keeplas.app`:

   ```bash
   curl -s https://app.keeplas.com/.well-known/apple-app-site-association
   ```

Never set `APP_ATTEST_ALLOW_DEVELOPMENT` on production. It belongs only on the dev deployment (see `.env.example`).

### 4. EAS environment and credentials

- The `production` EAS environment needs the `EXPO_PUBLIC_*` values and `GOOGLE_SERVICES_JSON` (see [`README.md`](./README.md#eas-builds)). Check with `npx eas-cli env:list --environment production`.
- The **first** iOS build is interactive. Log in with the Apple Developer account (2FA) and answer **Yes** to these prompts:
  - generate the distribution certificate;
  - generate the provisioning profile;
  - set up the push key;
  - create an App Store Connect API key.

  EAS stores all of these, so later builds and submits need no Apple login.

- Inspect or rotate the credentials with `npx eas-cli credentials --platform ios`.

## Build and upload to TestFlight

Run this from `apps/mobile`:

```bash
npx eas-cli build --platform ios --profile production --auto-submit
```

- The build runs on EAS servers (about 15–30 min), then uploads to ASC.
- ASC processes the build for another 5–15 min, then sends an email.
- To submit a build that already exists: `npx eas-cli submit --platform ios --profile production --latest`.

Export compliance: `app.json` sets `ITSAppUsesNonExemptEncryption: false`, so ASC no longer asks about it on each build. **Review this before external testing or an App Store release.** Keeplas ships its own cryptography (AES-GCM, ML-KEM, ML-DSA), so "exempt" is probably wrong. A French distribution also needs an ANSSI declaration. Fix the value and the declaration together.

## TestFlight

### Internal testing (no Apple review)

1. ASC → TestFlight → Internal Testing → `Team (Expo)`. Testers must be ASC users (Users and Access) with a role. Up to 100 testers.
2. Add the processed build to the group, or turn on automatic distribution so every new build reaches the group.
3. On the iPhone: install the **TestFlight** app, accept the email invitation, install Keeplas.

### External testing (Beta App Review)

1. Fix the export compliance value first (see above).
2. ASC → TestFlight → **+** next to External Testing → create a group, then add testers by email or enable a public link.
3. Fill in Test Information: what to test, a feedback email, and a demo account with notes, since sign-up requires a real device.
4. The first build of each version goes through Beta App Review, which usually takes about a day. Later builds of the same version are often approved straight away.

### Good to know

- Install or reinstall the app **after** the AASA file is live. iOS fetches it at install time, so passkeys and universal links stay broken on an install that predates the fix. Delete the app and reinstall it.
- A TestFlight build expires after 90 days.
- TestFlight builds use the App Attest **production** environment, so they work against the prod Convex deployment.

## Ship an update

There is no OTA update channel (`expo-updates` is not installed). Every change, JS included, ships as a new native build.

1. **Backend first.** Deploy Convex with `pnpm deploy:convex` before the app that calls new functions. Older app versions keep running against the same backend, so keep functions backward-compatible until they are gone from users' phones.
2. **Version.**
   - **Build number**: EAS manages it (`appVersionSource: remote`, `autoIncrement` on `production`). Never set `ios.buildNumber` by hand.
   - **Marketing version**: `expo.version` in `app.json`, shown as "Version" in ASC. Several builds can share a version while it is in TestFlight. Once a version is released on the App Store, bump `expo.version` (e.g. `0.1.0` → `0.2.0`) before the next upload, or ASC rejects the build.
3. **Build and submit.** Run the [build command](#build-and-upload-to-testflight). Internal testers get the build once ASC has processed it.
4. **Release.** When the build is validated, follow [Release to the App Store](#release-to-the-app-store).

## Release to the App Store

1. ASC → the app → iOS App → **+** (new version), or open the version that is waiting ("Prepare for Submission").
2. Fill in the listing:
   - Screenshots: the 6.9" iPhone size is required. `supportsTablet: false`, so no iPad screenshots.
   - Description, keywords, support URL, privacy policy URL.
   - "What's New" (from the second version on).
3. App Information and App Privacy:
   - age rating and category;
   - the data collection questionnaire. Vault content is end-to-end encrypted, but phone number and device data are still collected.
4. **Build**: select the TestFlight build to ship.
5. **App Review Information**: give the reviewer a demo account and short notes on the sign-in flow (code, PIN). Without these, review is usually rejected for an app gated by sign-in.
6. Release option: manual, automatic, or phased (7 days). Then **Add for Review** → **Submit**.

## Troubleshooting

| Symptom                                              | Cause / fix                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| AASA URL returns `404`                               | `APPLE_TEAM_ID` or `IOS_BUNDLE_ID` is empty in Infisical `/keeplas_app`, or Vercel was not redeployed |
| Passkeys / universal links fail after the AASA fix   | The app was installed before the fix: delete it and reinstall                                         |
| Sign-up fails at attestation (`environment`)         | A development build against a deployment without `APP_ATTEST_ALLOW_DEVELOPMENT=true` (dev only)       |
| Sign-up fails at attestation on a TestFlight build   | App Attest is disabled on the App ID: check that the entitlement is still in `app.json`, rebuild      |
| Convex error `APPLE_TEAM_ID` missing                 | Run `pnpm sync:convex-env` after setting it in Infisical `/keeplas_app`                               |
| ASC rejects the upload: version already released     | Bump `expo.version` in `app.json`                                                                     |
| `eas submit` asks which ASC app to use / fails in CI | Add `"ios": { "ascAppId": "6825985002" }` under `submit.production` in `eas.json`                     |
| No push notifications on iOS                         | Push key missing: `npx eas-cli credentials --platform ios` → Push Notifications                       |
