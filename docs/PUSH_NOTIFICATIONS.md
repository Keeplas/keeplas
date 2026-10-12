# Push notifications — setup & remaining work

Native push for the phone app (`apps/mobile`) goes through the **Expo push
service**, which forwards to APNs (iOS) and FCM (Android). There is no browser
Web Push: the native app replaces it.

The code is done (PR #111). What remains is account setup and a device test —
tick each box as you go.

## How it works

1. After unlock, the app registers the phone (`devices.register`), asks for
   notification permission, then stores its Expo push token with
   `devices.setPushToken` (`apps/mobile/src/lib/use-push-notifications.ts`).
2. The backend sends through `sendExpoPush` (`packages/convex/dispatch.ts`) to
   the active phones returned by `activePushTokens` (`packages/convex/devices.ts`).
3. Tapping a notification opens `data.url`, a phone route — also when the tap
   launched the app.
4. Tokens Expo reports as `DeviceNotRegistered` are cleared, from the send
   tickets right away and from the receipts 15 minutes later
   (`checkExpoPushReceipts`).

| Alert                     | Recipient     | Opens on the phone |
| ------------------------- | ------------- | ------------------ |
| New device linked         | Owner         | `/devices`         |
| Recovery started          | Owner         | `/recovery`        |
| Recovery help needed      | Trust contact | `/recovery`        |
| Life Check check-in       | Owner         | `/life-check`      |
| 72h grace-cancel window   | Owner         | `/life-check`      |
| Confirm owner unreachable | Trust contact | `/people`          |
| Vault released            | Recipient     | `/people`          |

Every alert also goes out by email and WhatsApp; push is best-effort.

## Already done

- [x] Expo project `@keeplas/keeplas` (organization `keeplas`), linked in
      `apps/mobile/app.json` (`owner`, `extra.eas.projectId`).
- [x] `expo-notifications` plugin configured (adds the iOS push entitlement).
- [x] Backend sending, deep links, dead-token cleanup — covered by
      `packages/convex/__tests__/expo_push.test.ts`.
- [x] Web Push removed (no VAPID keys anywhere — nothing to clean in
      Infisical or Convex).

## Remaining work

### 1. Android — Firebase (free, can be done now)

No Play Console account is needed to receive push; it is only needed to
publish the app.

- [ ] Create a Firebase project and add an Android app with package
      `com.keeplas.app`.
- [ ] Download `google-services.json`, add it to `apps/mobile/`, and set
      `"googleServicesFile": "./google-services.json"` under `expo.android`
      in `app.json`.
- [ ] In Firebase → Project settings → Service accounts, generate a private
      key (FCM HTTP v1) and upload it:
      `cd apps/mobile && npx eas-cli credentials -p android`
      → _Google Service Account_ → _FCM V1_.
- [ ] Never commit the service-account key; `google-services.json` holds no
      secret and can be committed.

### 2. iOS — Apple Developer Program (99 USD / year)

iOS cannot receive push without a paid membership, not even on a dev build.

- [ ] Enroll the Keeplas organization in the Apple Developer Program (needs a
      D-U-N-S number for an organization account — allow a few days).
- [ ] Create the push key and upload it — EAS can do both:
      `cd apps/mobile && npx eas-cli credentials -p ios` → _Push
      Notifications_ → generate a new APNs key.
- [ ] Bundle identifier stays `com.keeplas.app`.

### 3. Secure sending — `EXPO_ACCESS_TOKEN`

Sends work without it, but anyone holding a token could then push to that
phone. Order matters: the token must be live **before** enabling the setting,
otherwise Expo rejects every send.

- [ ] Create a robot user access token:
      https://expo.dev/accounts/keeplas/settings/access-tokens
- [ ] Add it to Infisical (`/keeplas_app`), environments `dev` and `prod`:
      `infisical secrets set EXPO_ACCESS_TOKEN=<token> --env=dev --path=/keeplas_app --domain=https://app.infisical.com`
- [ ] Push it to Convex (`pnpm sync:convex-env`) for dev and prod.
- [ ] Only then enable **Enhanced Push Security** in the Expo project
      settings.

### 4. Test on real devices

Expo Go does not support push; use a development build.

- [ ] Android: `pnpm --filter @keeplas/mobile android` on a device (or an
      emulator with Google Play services).
- [ ] iOS: `pnpm --filter @keeplas/mobile ios --device` on a physical iPhone
      (the simulator cannot receive remote push).
- [ ] Accept the permission prompt, then check the `devices` row has a
      `pushToken` (Convex dashboard).
- [ ] Trigger an alert (link a new browser → "New device") and check: the
      notification shows, the tap opens `/devices`, also when the app was
      fully closed.
- [ ] Send a test from https://expo.dev/notifications with the token if
      needed to isolate app vs backend issues.
- [ ] Uninstall the app, trigger an alert, and check the token is cleared
      (immediately or ~15 minutes later).

### 5. Follow-ups (not blocking push)

- [ ] Mobile screen for a trust contact to **confirm the owner is
      unreachable** (`access_requests.markUserUnreachable`) — today only the
      web has it, so that notification opens the People tab.
- [ ] `eas.json` with build profiles once builds move to EAS Build
      (`npx eas-cli build:configure`).
- [ ] Production: deploy the backend with `pnpm deploy:convex` (drops the two
      `push_subscriptions` indexes — within the deploy guard limit).
