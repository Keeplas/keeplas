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
npx eas-cli env:set --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY --value appl_<key>
npx eas-cli env:set --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY --value goog_<key>
```

## In-app purchase (RevenueCat)

Lifetime is sold in the app through App Store / Google Play billing via RevenueCat (`src/features/billing/purchases.ts`); it is the only place Lifetime is sold (the web app has no checkout). The RevenueCat app user id is the Convex user id, which is how the webhook finds the buyer.

1. App Store Connect and Play Console: create the **non-consumable** Lifetime product `keeplas_lifetime` at $99 (Play: one-time product).
2. RevenueCat: add the App Store app (`com.keeplas.app`, App Store Connect in-app purchase key) and the Play app (`com.keeplas.app`, Play service-account JSON), import both products.
3. RevenueCat → Entitlements: create `lifetime` (must equal `LIFETIME_ENTITLEMENT_ID` in `packages/convex/lib/plans.ts`) and attach both products.
4. RevenueCat → Offerings: in the **current** offering, add a package of type **Lifetime** containing both products.
5. RevenueCat → Integrations → Webhooks: URL `https://<deployment>.convex.site/webhooks/revenuecat`, Authorization header `Bearer <REVENUECAT_WEBHOOK_SECRET>`, then `pnpm sync:convex-env`. Sandbox purchases (TestFlight, App Review) unlock the plan but are recorded at $0. Keeplas runs one webhook per deployment: dev (sandbox events only) and prod (all events); a deployment ignores buyers it doesn't know.
6. Set the `appl_…` / `goog_…` public SDK keys as shown above. `react-native-purchases` is a native module: rebuild the dev client after pulling.

Before the store products exist, debug builds can buy from the RevenueCat **Test Store**: set its `test_…` key as `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` in the `development` EAS environment only (`npx eas-cli env:set --environment development --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_TEST_API_KEY --value test_<key>`). It is read only when `__DEV__`, since the SDK crashes a release build that carries it.

### Before launch

As of 2026-10-24, RevenueCat, both webhooks and the App Store product are set up. Still open:

1. **Google Play product.** `keeplas_lifetime` does not exist on Google Play yet. The Play Console only allows one-time products once an AAB with the `com.android.vending.BILLING` permission (added by `react-native-purchases`) is on a track, and versionCode 5, the only one on a track so far, predates it. At launch:
   1. Upload the production AAB (see [Play Store](#play-store)).
   2. Create the one-time product `keeplas_lifetime`: **Buy** purchase option kept backwards compatible, multi-quantity off, $99 with prices converted for every country, en-US and fr-FR name and description ("10 GB of encrypted storage and every Keeplas feature, forever. One-time purchase."). Do it in the Play Console, or from RevenueCat once its service account (`revenuecat@keeplas-eb259.iam.gserviceaccount.com`) actually gets "Manage store presence" through the API.
   3. Check that RevenueCat shows the product with a price. The Android product is already in the `lifetime` entitlement and the current offering.
   4. Only then roll Android out to production. Without the product, release builds show the upgrade card without a price and the purchase fails.
2. **Play Console payments**: before the first sale, add the bank account (Payments profile → How you get paid) and enroll in the 15% service fee (Manage account → Account group).
3. **App Store**: submit `keeplas_lifetime` with the app version and replace its placeholder review screenshot ([Release to the App Store](./APP_STORE.md#release-to-the-app-store)), and settle export compliance ([`APP_STORE.md`](./APP_STORE.md#build-and-upload-to-testflight)).

## Push notifications

The Convex backend sends through the Expo push service (`packages/convex/dispatch.ts`); the app registers its Expo push token on the device row (`src/lib/use-push-notifications.ts`). Expo relays to FCM (Android) and APNs (iOS), which need credentials:

**Android (FCM)**

1. Firebase console: add an Android app with package `com.keeplas.app` to a Firebase project, download `google-services.json`.
2. Upload it as an EAS file variable in every environment:
   `npx eas-cli env:set --environment development --environment preview --environment production --visibility secret --type file --name GOOGLE_SERVICES_JSON --value ./google-services.json`
   For local builds, put the file at `apps/mobile/google-services.json` (gitignored). Its content is kept in Infisical as `ANDROID_GOOGLE_SERVICES_JSON` (restore command in the root `.env.example`).
3. Firebase → Project settings → Service accounts → generate a private key, then `npx eas-cli credentials --platform android` → Google Service Account → "Manage your Google Service Account Key for Push Notifications (FCM V1)" → upload it. Keep the key in Infisical prod under `/keeplas_mobile` (`keeplas_firebase_adminsdk`), never in `/keeplas_app`: that folder syncs to Vercel, and the sync does not delete removed secrets.

**iOS (APNs)**: `npx eas-cli credentials --platform ios` creates the push key once the Apple Developer account is active.

**Expo access token**: enable "Enhanced Push Security" in the Expo project, create an access token and set `EXPO_ACCESS_TOKEN` on the Convex deployment (`pnpm sync:convex-env`).

## Play Store

1. Create the app in the Play Console (`com.keeplas.app`). The first AAB must be uploaded by hand: `eas build --profile production`, then upload the `.aab` to the internal track.
2. Play Console → Setup → API access: create a service account with release permissions, then add its key with `npx eas-cli credentials --platform android` (used by `eas submit`).
3. Play Console → App integrity: copy the SHA-256 of the **app signing** key and the **upload** key into `ANDROID_SHA256_CERT_FINGERPRINTS` (web host, assetlinks.json), and add the matching `android:apk-key-hash:` origin to `WEBAUTHN_ORIGIN` (native passkeys).
4. Play Console → App integrity: link the Google Cloud project `keeplas-eb259` (`EXPO_PUBLIC_GCP_PROJECT_NUMBER`). Its `play-integrity` service account (no IAM role; manage with prince@prince-code.com, which owns the project) signs the Convex calls; its key is `GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT` in Infisical prod `/keeplas_mobile`, set on Convex with `npx convex env set` (not in `/keeplas_app`, which syncs to Vercel).

## App Store

App Store Connect setup, TestFlight, updates and release: [`APP_STORE.md`](./APP_STORE.md).
