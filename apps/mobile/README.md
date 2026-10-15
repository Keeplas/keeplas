# Keeplas mobile (Expo)

Product context and phases: [`PRD/v2-mobile-first/README.md`](../../PRD/v2-mobile-first/README.md).

## Run locally

```bash
pnpm link:env                          # apps/mobile/.env.local → root .env.local
pnpm --filter @keeplas/mobile ios      # or android (needs Xcode / Android Studio)
```

## EAS builds

Profiles live in `eas.json`. App versions are managed by EAS (`appVersionSource: remote`); `production` bumps the build number on every build.

| Profile       | Use                                            | Android output |
| ------------- | ---------------------------------------------- | -------------- |
| `development` | Dev client (`expo-dev-client`) on real devices | APK, internal  |
| `preview`     | Testers, store-like build                      | APK, internal  |
| `production`  | Stores                                         | AAB            |

```bash
npx eas-cli build --profile development --platform android
npx eas-cli build --profile production --platform android
npx eas-cli submit --profile production --platform android   # Play internal track, draft
```

EAS builds do not read `.env.local`. Each EAS environment (`development`, `preview`, `production`) needs the public values from the root `.env.example`, or the app stops at launch:

```bash
npx eas-cli env:set --environment production --visibility plaintext --name EXPO_PUBLIC_CONVEX_URL --value https://<deployment>.convex.cloud
npx eas-cli env:set --environment production --visibility plaintext --name EXPO_PUBLIC_APP_URL --value https://app.keeplas.com
npx eas-cli env:set --environment production --visibility plaintext --name EXPO_PUBLIC_GCP_PROJECT_NUMBER --value <number>
```

## Push notifications

The Convex backend sends through the Expo push service (`packages/convex/dispatch.ts`); the app registers its Expo push token on the device row (`src/lib/use-push-notifications.ts`). Expo relays to FCM (Android) and APNs (iOS), which need credentials:

**Android (FCM)**

1. Firebase console: add an Android app with package `com.keeplas.app` to a Firebase project, download `google-services.json`.
2. Upload it as an EAS file variable in every environment:
   `npx eas-cli env:set --environment development --environment preview --environment production --visibility secret --type file --name GOOGLE_SERVICES_JSON --value ./google-services.json`
   For local builds, put the file at `apps/mobile/google-services.json` (gitignored). Its content is kept in Infisical as `ANDROID_GOOGLE_SERVICES_JSON` (restore command in the root `.env.example`).
3. Firebase → Project settings → Service accounts → generate a private key, then `npx eas-cli credentials --platform android` → Google Service Account → "Manage your Google Service Account Key for Push Notifications (FCM V1)" → upload it.

**iOS (APNs)**: `npx eas-cli credentials --platform ios` creates the push key once the Apple Developer account is active.

**Expo access token**: enable "Enhanced Push Security" in the Expo project, create an access token and set `EXPO_ACCESS_TOKEN` on the Convex deployment (`pnpm sync:convex-env`).

## Play Store

1. Create the app in the Play Console (`com.keeplas.app`). The first AAB must be uploaded by hand: `eas build --profile production`, then upload the `.aab` to the internal track.
2. Play Console → Setup → API access: create a service account with release permissions, then add its key with `npx eas-cli credentials --platform android` (used by `eas submit`).
3. Play Console → App integrity: copy the SHA-256 of the **app signing** key and the **upload** key into `ANDROID_SHA256_CERT_FINGERPRINTS` (web host, assetlinks.json), and add the matching `android:apk-key-hash:` origin to `WEBAUTHN_ORIGIN` (native passkeys).
4. Link the Play Integrity API to the Google Cloud project (`EXPO_PUBLIC_GCP_PROJECT_NUMBER`, `GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT`).
