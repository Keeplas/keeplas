# iOS: App Store Connect & TestFlight

How the Keeplas iOS app gets from this repo to TestFlight and the App Store. iOS builds run with Xcode on a Mac and upload straight to App Store Connect (ASC), not through EAS Build (the free plan caps iOS builds per month). ASC handles testers, review and release. Android builds and the EAS environment variables: [`README.md`](./README.md).

## Identifiers

| Item                      | Value                                                 | Where it lives                            |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| Apple Team ID             | `67T9Q44562` (PRINC CODE SARLU LTD, company 14930093) | developer.apple.com → Membership          |
| Bundle ID                 | `com.keeplas.app` (explicit)                          | `app.json` → `expo.ios.bundleIdentifier`  |
| SKU                       | `keeplas-ios`                                         | ASC → App Information (cannot be changed) |
| ASC App ID (Apple ID)     | `6825985002`                                          | ASC → App Information → Apple ID          |
| EAS project               | `keeplas/keeplas`                                     | `app.json` → `expo.extra.eas.projectId`   |
| Internal TestFlight group | `Team (Expo)`                                         | ASC → TestFlight → Internal Testing       |

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

Face ID, camera, microphone, photos and contacts are `Info.plist` permissions, not capabilities. Their texts live in `locales/en.json` and `locales/fr.json` (`app.config.ts` puts the English ones in `Info.plist`, and `app.json` `locales` builds the French `InfoPlist.strings`).

`app.json` must keep the App Attest entitlement (`com.apple.developer.devicecheck.appattest-environment: "production"`). Automatic signing syncs capabilities from the entitlements on every build. Without that line App Attest was turned **off** on the App ID (`Synced capabilities: Disabled: App Attest` in the EAS build log). The server always accepts production attestations, so dev builds still work.

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

### 4. Build environment and credentials

- The `EXPO_PUBLIC_*` production values live in the EAS `production` environment (see [`README.md`](./README.md#eas-builds)). The release script pulls them with `eas env:pull`, which does not use the EAS build quota. Check with `npx eas-cli env:list --environment production`.
- The App Store Connect API key lives in Infisical `prod` → `/keeplas_mobile` (`ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, `ASC_API_KEY_P8`). Xcode uses it to fetch the cloud-managed distribution certificate and the provisioning profile, and to upload the build. No Apple login, no certificate in the keychain.
- The Mac needs Xcode, CocoaPods, `infisical login` and `npx eas-cli login`.
- The APNs push key stays on EAS (Expo push service): `npx eas-cli credentials --platform ios`.

## Build and upload to TestFlight

Run this from the repo root, on the commit to ship:

```bash
pnpm --filter @keeplas/mobile release:ios
```

- `scripts/release-ios.sh` regenerates `ios/` (`expo prebuild --clean`), archives a Release build with Xcode into `ios/build/Keeplas.xcarchive`, then uploads it to ASC.
- Xcode picks the next free build number at upload (`manageAppVersionAndBuildNumber`).
- ASC processes the build for another 5–15 min, then sends an email.
- To retry only the upload: open the archive in Xcode (Window → Organizer) → **Distribute App** → App Store Connect.

Export compliance: `app.json` declares non-exempt encryption, so ASC asks the encryption questions on each build until it has an export compliance code. See [Export compliance](#export-compliance).

## Export compliance

Keeplas encrypts data itself with standard algorithms, on top of the TLS that iOS provides, so it is not exempt: `app.json` sets `ITSAppUsesNonExemptEncryption: true`. Each new build shows "Missing Compliance" in ASC until the encryption questions are answered. Two things to know before answering:

- **United States (EAR).** Answer that the app uses standard encryption algorithms instead of, or in addition to, the operating system's. Mass-market encryption items usually need a self-classification report to BIS; publicly available open-source encryption code can follow a different route. Confirm which one applies with counsel, then upload the documentation ASC asks for.
- **France (ANSSI).** Apple names "Secure Storage" among the encryption uses France controls. Distributing in France needs a declaration of the cryptology means to ANSSI, whose acknowledgment ASC asks for. Filed and accepted on 27 October 2026 (dossier 34982065 on demarche.numerique.gouv.fr): answer that the app is available in France and upload the attestation PDF. The founders keep it; it isn't in this public repo.

Once ASC approves the documentation, it gives an export compliance code. Add it to `app.json` as `ITSEncryptionExportComplianceCode` (in `expo.ios.infoPlist`), so later builds skip the questions.

Technical annex for these declarations (in `packages/crypto/`, used by the web and mobile apps, unless noted):

| Function                                                  | Algorithm                          | Standard        | Where                       |
| --------------------------------------------------------- | ---------------------------------- | --------------- | --------------------------- |
| Item, file and key-bundle encryption                      | AES-256-GCM                        | NIST SP 800-38D | `src/aes/`                  |
| Wrapping item keys to each recipient                      | ML-KEM-768                         | FIPS 203        | `src/kem/`                  |
| Signing public keys (identity, key authenticity)          | ML-DSA-65                          | FIPS 204        | `src/sig/`                  |
| Key derivation from the 24-word phrase and the device PIN | Argon2id                           | RFC 9106        | `src/kdf/`, `src/recovery/` |
| Social-recovery envelope key                              | HKDF with SHA-256                  | RFC 5869        | `src/social/`               |
| Splitting the recovery secret between contacts (2 of n)   | Shamir secret sharing over GF(256) | —               | `src/shamir/`               |
| Hashing                                                   | SHA-256                            | FIPS 180-4      | throughout                  |

Bundled in the mobile app, besides `packages/crypto/`:

- **OpenSSL 3.6** (open source, through `react-native-quick-crypto`): the native implementation of AES-GCM, SHA-256, HKDF, Argon2id, ML-KEM-768 and ML-DSA-65 on the phone (`src/crypto/install.ts`).
- **SQLCipher 4** (open source, through `op-sqlite`): encrypts the local outbox database with AES-256-CBC, HMAC-SHA512 and PBKDF2-HMAC-SHA512; its key stays in the Keychain or Keystore (`src/lib/secure-db.ts`).
- The OS Keychain / Keystore and the OS TLS stack.

Check that the ANSSI dossier and the US notification name these two open-source libraries.

The purpose is confidentiality of the data users store and share with the people they choose. Keeplas holds no key that decrypts it on its own.

## TestFlight

### Internal testing (no Apple review)

1. ASC → TestFlight → Internal Testing → `Team (Expo)`. Testers must be ASC users (Users and Access) with a role. Up to 100 testers.
2. Add the processed build to the group, or turn on automatic distribution so every new build reaches the group.
3. On the iPhone: install the **TestFlight** app, accept the email invitation, install Keeplas.

### External testing (Beta App Review)

1. Answer export compliance for the build first (see [Export compliance](#export-compliance)).
2. ASC → TestFlight → **+** next to External Testing → create a group, then add testers by email or enable a public link.
3. Fill in Test Information: what to test, a feedback email, and the demo account with its notes from [`APP_REVIEW.md`](./APP_REVIEW.md).
4. The first build of each version goes through Beta App Review, which usually takes about a day. Later builds of the same version are often approved straight away.

### Good to know

- Install or reinstall the app **after** the AASA file is live. iOS fetches it at install time, so passkeys and universal links stay broken on an install that predates the fix. Delete the app and reinstall it.
- A TestFlight build expires after 90 days.
- TestFlight builds use the App Attest **production** environment, so they work against the prod Convex deployment.

## Ship an update

There is no OTA update channel (`expo-updates` is not installed). Every change, JS included, ships as a new native build.

1. **Backend first.** Deploy Convex with `pnpm deploy:convex` before the app that calls new functions. Older app versions keep running against the same backend, so keep functions backward-compatible until they are gone from users' phones.
2. **Version.**
   - **Build number**: Xcode sets it at upload. Never set `ios.buildNumber` by hand. The EAS remote counter no longer moves for iOS: before an iOS build on EAS again, raise it above the latest ASC build with `npx eas-cli build:version:set --platform ios`.
   - **Marketing version**: `expo.version` in `app.json`, shown as "Version" in ASC. Several builds can share a version while it is in TestFlight. Once a version is released on the App Store, bump `expo.version` (e.g. `1.0.0` → `1.0.1`) before the next upload. The first App Store version is `1.0.0`, or ASC rejects the build.
3. **Build and submit.** Run the [build command](#build-and-upload-to-testflight). Internal testers get the build once ASC has processed it.
4. **Release.** When the build is validated, follow [Release to the App Store](#release-to-the-app-store).

## Release to the App Store

1. ASC → the app → iOS App → **+** (new version), or open the version that is waiting ("Prepare for Submission").
2. Fill in the listing:
   - Screenshots: the 6.9" iPhone size is required. `supportsTablet: false`, so no iPad screenshots. Capture them on a phone from the build being submitted, then frame them (and the Google Play set) with [`store-screenshots/render.sh`](store-screenshots/render.sh). Apple rejects screenshots that don't show the app in use (2.3.3).
   - Description, keywords, support URL, privacy policy URL.
   - "What's New" (from the second version on).
3. App Information and App Privacy:
   - age rating and category;
   - the data collection questionnaire. Vault content is end-to-end encrypted, but phone number and device data are still collected.
4. **Build**: select the TestFlight build to ship.
5. **In-App Purchases**: add `keeplas_lifetime` to the version. Apple requires the first in-app purchase to ship with an app version. Before that, replace its review screenshot, a blank placeholder uploaded by RevenueCat, with the Settings screen showing the Upgrade to Lifetime card.
6. **App Review Information**: sign-in details, notes and the video link from [`APP_REVIEW.md`](./APP_REVIEW.md). Run `pnpm review:status` first. Without a working demo account, review is usually rejected for an app gated by sign-in.
7. **Pricing and Availability**:
   - under "iPhone and iPad Apps on Apple Silicon Mac", clear "Make this app available", and check the Apple Vision Pro availability on the same page. Sign-up can't pass App Attest on a Mac;
   - countries: untick China mainland (no ICP filing; WhatsApp is blocked) and any market where WhatsApp codes can't be delivered, until an SMS fallback exists.
   - **Business → Digital Services Act**: trader status verified, or the app isn't offered in the EU.
8. Release option: manual, automatic, or phased (7 days). Then **Add for Review** → **Submit**.

## iPad pass

`supportsTablet` is false, but reviewers often run the iPhone app on an iPad: an iPad mini shows it in a 375 × 667 window (iPhone SE size), a 13" iPad Pro in 390 × 844. Before submitting, on a real iPad mini and an 11" or 13" iPad (iPadOS 26), with the TestFlight build:

1. Portrait, software keyboard: Welcome → Get started → name and review number → "Verify with WhatsApp" is visible above the keyboard → code → passkey → vault → PIN step (the boxes are visible) → Contacts → Skip → Done. Then Settings → Delete my account (the field and the red button stay above the keyboard), and Add → Note and Add → Document.
2. With a hardware keyboard: Return on the phone field submits, the code submits itself, paste the 24 words → Open my vault, and the buttons pinned above the keyboard don't float or hide behind the shortcuts bar.
3. Windowed apps: the window controls don't cover the back arrow or the EN/FR switch.
4. iPad held in landscape: scan a page (Auto and Manual), take a photo and a video, scan a QR code. Previews and saved files are upright. The flash button may do nothing on iPads without a flash.

Note the window size seen on each model here.

## Troubleshooting

| Symptom                                            | Cause / fix                                                                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| AASA URL returns `404`                             | `APPLE_TEAM_ID` or `IOS_BUNDLE_ID` is empty in Infisical `/keeplas_app`, or Vercel was not redeployed                                          |
| Passkeys / universal links fail after the AASA fix | The app was installed before the fix: delete it and reinstall                                                                                  |
| Sign-up fails at attestation (`environment`)       | A development build against a deployment without `APP_ATTEST_ALLOW_DEVELOPMENT=true` (dev only)                                                |
| Sign-up fails at attestation on a TestFlight build | App Attest is disabled on the App ID: check that the entitlement is still in `app.json`, rebuild                                               |
| Convex error `APPLE_TEAM_ID` missing               | Run `pnpm sync:convex-env` after setting it in Infisical `/keeplas_app`                                                                        |
| ASC rejects the upload: version already released   | Bump `expo.version` in `app.json`                                                                                                              |
| Archive fails: `Your team has no devices`          | Automatic signing needs one registered iPhone: plug it into the Mac (unlocked, trusted) once, or add its UDID in developer.apple.com → Devices |
| No push notifications on iOS                       | Push key missing: `npx eas-cli credentials --platform ios` → Push Notifications                                                                |
