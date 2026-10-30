# App Store & Google Play review

Everything about getting Keeplas through store review:

- what is done and what is left;
- what the stores check;
- how reviewers get in, and how to prepare their accounts;
- what to fill in App Store Connect (ASC) and the Play Console;
- how support handles deletion requests made on the website.

Building and uploading: [`APP_STORE.md`](./APP_STORE.md) (iOS) and [`README.md`](./README.md) (Android).

## Status

As of 29 October 2026.

**Done**

- **Review system** ([#327](https://github.com/Keeplas/keeplas/pull/327)), live on prod Convex (`energetic-pony-179`):
  - the review code works for sign-in and sign-up on the review numbers;
  - `pnpm review:status` and `pnpm review:reset`;
  - `scheduleForPhone`, for deletion requests made on the website.
- **Prod config:** `REVIEW_PHONES` (the five [review numbers](#review-numbers)) and `REVIEW_CODE` are set in Infisical `prod` → `/keeplas_app` and on prod Convex. `pnpm review:status` says `REVIEW_CODE: set`.
- **No dev bypass on prod:** `DEV_TEST_PHONES`, `APP_ATTEST_ALLOW_DEVELOPMENT` and `ATTESTATION_SIMULATOR_BYPASS` are not set. The kill switches `NOTIFICATIONS_PAUSED` and `LIFE_CHECK_PAUSED` are off, so invitations go out and the Life check runs.
- **Encryption:** `app.json` declares the app's own encryption. The export compliance answers and the algorithm list are in [`APP_STORE.md`](./APP_STORE.md#export-compliance).
- **France (ANSSI):** the declaration of the cryptology means was filed and accepted on 27 October 2026 (dossier 34982065 on demarche.numerique.gouv.fr). Its attestation is the document ASC asks for when the app is available in France. Keep the PDF out of this public repo: it holds personal details.
- **Website:** the deletion page shows the in-app steps, drawn from the app's own screens, and ends with a form that asks for the account's phone number ([keeplas-website#21](https://github.com/Keeplas/keeplas-website/pull/21), [#22](https://github.com/Keeplas/keeplas-website/pull/22)). The server-rendered routes, the lost-phone guide and the reviewed privacy policy and terms are live (#25 to #29, merged on 27 October 2026): `/privacy`, `/terms`, `/support`, `/delete-account` and `/lost-phone` (and their `/fr` versions) answer 200, and an unknown path answers 404.
- **Store review audit (29 October 2026):** every screen, button, permission, store rule and URL was checked. The app fixes are in this branch; what is left is in the list below.
- **[Demo accounts](#demo-accounts)**, seeded with `pnpm review:seed` on 27 October 2026: the owner and two accepted contacts, all on UK numbers and all opened with the same 24 words. The owner's vault holds six items, each contact's two. The command opens each account again like a new phone (review code, then the stored 24 words): every item and file decrypts, and `pnpm review:status` says **Ready for review**.

**Left to do**

- [ ] Record the video of the multi-day flows and put its link in the review notes.
- [ ] Record the Play [foreground service video](#play-console-app-content-declarations) (vault export, about 30 seconds).
- [ ] US export documentation: confirm the route with counsel, either the BIS self-classification report or the open-source notification.
- [ ] Upload a new iOS build, version 1.0.0: the encryption declaration only applies to builds made after it. It must include the UK review numbers fix and the store review audit fixes.
- [ ] Android: upload the launch AAB (it must include the same fixes), then create the `keeplas_lifetime` product in the Play Console. Play refuses the product until an AAB with billing is on a track.
- [ ] Deploy the backend of the store review audit fixes (`pnpm deploy:convex`) before the new builds reach reviewers: error messages, review-number limits and the review tooling depend on it.
- [ ] Capture the six store screenshots on a real phone, in English and French, and render them ([`store-screenshots/`](./store-screenshots/)). The old set showed Figma mockups with screens the app doesn't have (Apple 2.3.3).
- [ ] Fix the store descriptions in AFFiNE before pasting them: sharing is chosen per item, not per category. EN "• For each item, choose who receives it."; FR "• Pour chaque élément, choisissez qui le recevra."
- [ ] Fill in ASC and the Play Console: review notes, App Privacy, Data safety, deletion URL, Play App content declarations ([checklist](#before-each-submission)).
- [ ] ASC → Pricing and Availability: clear "Make this app available" for Apple silicon Macs, and check Apple Vision Pro availability. Sign-up can't pass App Attest on a Mac.
- [ ] Choose the countries on purpose, in ASC and in Play → Production → Countries/regions (both are set to all today). Untick China mainland (no ICP filing, and WhatsApp, the only code channel, is blocked there), and any market where WhatsApp codes can't be delivered (Russia), until an SMS fallback exists. Record the choice in [`APP_STORE.md`](./APP_STORE.md#release-to-the-app-store).
- [ ] Apple: Digital Services Act trader status (ASC → Business → Digital Services Act → trader): PRINC CODE SARLU LTD, 20 Wenlock Road, London N1 7GU, support@keeplas.com, with a current Companies House document (company 14930093). Without a verified status the app isn't offered in the EU, France included, and verification can take weeks.
- [ ] Google Play: declare the trader status (Play Console → Account details → About you → Trader), then confirm it for `com.keeplas.app` in App content with the terms URL `https://www.keeplas.com/terms`. Required from November 2026 for EEA and UK users; the D-U-N-S number and contact details become public on the listing from 1 March 2027.
- [ ] Age: record the decision for the US state (Texas, Utah, Louisiana) and Brazil age-assurance rules, with counsel. The app is 18+ by its terms, but sign-up has no age check, so an 18+ age check (Declared Age Range on iOS, Play Age Signals) may be required in those regions.
- [ ] Test the TestFlight build on an iPad mini and an 11" or 13" iPad: reviewers often use one, and an iPhone app runs there in a 375 × 667 or 390 × 844 window ([iPad pass](./APP_STORE.md#ipad-pass)).
- [ ] Replace the `keeplas_lifetime` review screenshot in ASC: it is still the blank placeholder RevenueCat uploaded. Take it on a phone: Settings → Upgrade, with the sheet open.
- [ ] Website ([keeplas-website](https://github.com/Keeplas/keeplas-website)):
  - remove the struck-through $199 on `/pricing` and the home page unless Lifetime was sold at that price: Apple 2.3.1(a) forbids a false reference price, and reviewers reach the site from Settings → Privacy policy;
  - the `canonical`, `hreflang`, `og:url` and JSON-LD URLs point to `http://localhost:3000` on every page: the website's prod `NEXT_PUBLIC_APP_URL` (Infisical, synced to Vercel) holds that value. Set it to `https://www.keeplas.com` and redeploy the website.
- [ ] Record the date the `migrations:purgeErasedAccountsSecurityLogs` backfill ran on prod, or run it.

## What the stores check

Both stores can reject a version. A rejection cites the rule: fix the problem and resubmit, or appeal.

| Check                               | Rule                                                                                                         | Keeplas                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reviewers can sign in               | Apple 2.1; Play **App access**                                                                               | Review numbers and code, with notes to paste (below)                                                                                                                                                                                                                           |
| The app works without another app   | Apple 4.2.3(i): "Your app should work on its own without requiring installation of another app to function." | Codes are sent only on WhatsApp, and the sign-in screens say so ("Verify with WhatsApp"). Reviewers don't need WhatsApp: the review numbers take the review code. If Apple cites this rule, the fix is an SMS fallback for codes, which isn't built.                           |
| Encryption is declared              | Apple export compliance; France (ANSSI)                                                                      | `ITSAppUsesNonExemptEncryption: true`; ANSSI declaration accepted; answers in [`APP_STORE.md`](./APP_STORE.md#export-compliance)                                                                                                                                               |
| Paid features use in-app purchase   | Apple 3.1.1                                                                                                  | Lifetime is the in-app product `keeplas_lifetime` (RevenueCat), with Restore. The iOS app shows no web price and no link to pay elsewhere.                                                                                                                                     |
| Users can delete their account      | Apple 5.1.1(v); Play also asks for a web link                                                                | Settings → Delete my account; on the web, `https://www.keeplas.com/delete-account`                                                                                                                                                                                             |
| Privacy is disclosed                | Apple 5.1.1(i) and App Privacy; Play Data safety                                                             | The app links the privacy policy at sign-up and in Settings; add its URL to both listings. Proposed answers: [Store privacy answers](#store-privacy-answers).                                                                                                                  |
| Contacts access is minimal          | Play permissions policy and Data safety                                                                      | No contacts permission on either platform. iOS's picker hands over the picked contact; on Android the user picks one phone number in the contacts app (`modules/contact-picker`) and `app.json` blocks `READ_CONTACTS`. The contacts users add are still declared as Contacts. |
| Permissions are asked in context    | Apple 5.1.1(iv); Play permissions policy                                                                     | Camera, microphone and notifications are asked by the system dialog when the feature needs them, with no custom "Not now / Allow" pre-prompt. Photos come through the system picker, which needs no permission. A denied permission leaves the rest of the app usable.         |
| Screenshots show the real app       | Apple 2.3.3; Play metadata policy                                                                            | Captured on a phone from the shipped build ([`store-screenshots/`](./store-screenshots/)), not Figma mockups.                                                                                                                                                                  |
| Foreground service is declared      | Play: foreground service permissions (apps targeting Android 14+)                                            | The vault export runs a `dataSync` foreground service: declare it in App content, with a video ([below](#play-console-app-content-declarations)).                                                                                                                              |
| Testing before production (Android) | Play: personal developer accounts created after 13 Nov 2023                                                  | Not required: the developer account belongs to the organization PRINC CODE SARLU LTD.                                                                                                                                                                                          |
| Target API (Android)                | Play: Android 16 (API 36) since 31 Aug 2026                                                                  | React Native 0.86 (Expo SDK 57) targets API 36                                                                                                                                                                                                                                 |

Not a problem:

- Death and inheritance are accepted subjects on both stores.
- Sign in with Apple (4.8) is only required when an app offers a third-party login, and Keeplas has none.
- A phone number used as the login is accepted.

## How reviewers sign in

Keeplas has no email and password. An account is a phone number verified with a code sent on WhatsApp, then a passkey on the device. Reviewers can't receive those WhatsApp codes, so:

- Numbers listed in `REVIEW_PHONES` accept the secret 6-digit `REVIEW_CODE` instead of a WhatsApp code, for sign-in and for sign-up (`packages/convex/phone_auth.ts`). No WhatsApp message is sent for them.
- Nothing else is bypassed. Sign-up still needs the App Attest / Play Integrity attestation of the genuine app. A new device still needs the 24-word recovery kit to open the vault.
- Limits: 5 attempts per code, and at most 15 wrong codes per hour for a review number. Review numbers can request codes without the usual 3-per-hour cap, since no WhatsApp message is sent. `pnpm review:clear` and `pnpm review:reset` refuse any number outside `REVIEW_PHONES`.

Both stores accept this:

- Apple: "If your app requires an authentication code in addition to or instead of login credentials, include it in the Notes field in advance."
- Google: flag one-time passwords under **Any other instructions** in the App access section.

## Review numbers

All the review numbers are British, from the range Ofcom keeps for drama (07700 900000 to 900999): nobody can own them, so no message ever reaches a real person. The app's phone check accepts them (`toE164` in `apps/mobile/src/lib/phone.ts` lets the range through, since libphonenumber rejects it).

| Number          | Role           | Account                                                       |
| --------------- | -------------- | ------------------------------------------------------------- |
| +44 7700 900101 | Demo owner     | Seeded vault, recovery kit, 2 accepted contacts, Free plan    |
| +44 7700 900102 | Demo contact 1 | Seeded vault, recovery kit; accepted the owner's invitation   |
| +44 7700 900103 | Demo contact 2 | Seeded vault, recovery kit; accepted the owner's invitation   |
| +44 7700 900104 | Sign-up test   | Apple's: no account, reviewers create one; reset after review |
| +44 7700 900105 | Sign-up test   | Google's: same                                                |

Each store gets its own sign-up number, so a reviewer never lands on the other store's account ("Sign in with this number", then "Lost access to your vault?"). The demo owner is shared: the notes ask reviewers to leave it as it is and to try the irreversible actions (purchase, deletion, new recovery kit) on the account they create.

WhatsApp messages to these numbers fail quietly. Push notifications reach the phones signed in to the account, such as a reviewer's.

## Setup

Done on prod on 26 October 2026. Steps 1 to 3 also rotate the code. A new deployment needs all five.

1. **Pick the code**: 6 random digits.

   ```bash
   node -e "console.log(require('crypto').randomInt(1e6).toString().padStart(6, '0'))"
   ```

2. **Store the values** in Infisical `prod` → `/keeplas_app`:
   - `REVIEW_PHONES=+447700900101,+447700900102,+447700900103,+447700900104,+447700900105`
   - `REVIEW_CODE=<the 6 digits>`

   Infisical also copies them to Vercel. The web app doesn't read them, so Vercel needs no redeploy.

3. **Push them to the prod Convex deployment.** The prod env sync skips empty keys and never unsets them.

   ```bash
   pnpm with-env --env=prod -- sh -c 'npx convex env set --prod REVIEW_PHONES "$REVIEW_PHONES" && npx convex env set --prod REVIEW_CODE "$REVIEW_CODE"'
   ```

4. **Deploy the backend** that accepts review sign-ups (`pnpm deploy:convex`), if the current prod deploy predates it.

5. **Check**: `pnpm review:status` lists the five numbers and says `REVIEW_CODE: set`.

## Demo accounts

`pnpm review:seed` ([`scripts/review-seed.ts`](./scripts/review-seed.ts)) creates the owner and the two contacts on prod; it last ran on 27 October 2026.

- **It runs the app's own code:**
  - vault keys (`crypto/vault-keys.ts`);
  - items (`features/capture/seal.ts` and the outbox);
  - contact key checks (`crypto/contact-keys.ts`).
- **No phone needed:** the sign-up attestation comes from the internal `attestation:grantSignup`, run with your Convex login.
- **Proof:** it ends by opening each account again like a new phone.
- **No devices:** the accounts have none yet, so the first reviewer's phone becomes the first one.

| Account                     | Number          |
| --------------------------- | --------------- |
| Demo Owner                  | +44 7700 900101 |
| Alex Demo (owner's contact) | +44 7700 900102 |
| Sam Demo (owner's contact)  | +44 7700 900103 |

- **One set of 24 words for all three**: `REVIEW_KIT` in Infisical `prod` → `/keeplas_mobile`. A new seed keeps it, so the review notes stay valid. Each vault still has its own salt and MasterKey.

The owner's vault holds no real personal data:

| Item                     | Category  | File                  | After a confirmed death |
| ------------------------ | --------- | --------------------- | ----------------------- |
| Summer at the lake       | Family    | Photo (JPEG)          | Alex                    |
| A tune for the kids      | Family    | Audio (m4a)           | Alex                    |
| Where the house keys are | Family    | (note)                | Alex                    |
| Home insurance policy    | Paperwork | PDF stamped SAMPLE    | Alex and Sam            |
| Insurance contacts       | Paperwork | (note)                | Alex and Sam            |
| Email account            | Accounts  | (note, made-up login) | Alex and Sam            |

The contacts have vaults of their own, shared with nobody (they have no trusted contacts):

| Account | Item                    | Category | File            |
| ------- | ----------------------- | -------- | --------------- |
| Alex    | Holiday photo           | Other    | Photo (JPEG)    |
| Alex    | Bank account            | Accounts | (note, made up) |
| Sam     | Birthday message        | Other    | Audio (m4a)     |
| Sam     | Streaming subscriptions | Accounts | (note, made up) |

- **Settings:**
  - Free plan, so reviewers can try the Lifetime purchase in the sandbox;
  - Life check quarterly, with travel mode on until 26 November 2026;
  - cloud backup turned off, so reviewers' phones don't turn it on and each new reviewer goes straight to the recovery kit.
- **Contacts:**
  - invited by phone only, so no message reached anyone;
  - they accepted, and their keys are pinned on the owner's side.
- **Never create another kit on a demo account.** A new kit replaces that account's words, and the ones in the review notes stop opening it.

The files come from `scripts/review-seed/`:

- the photo is the app's landscape illustration;
- the PDF is a made-up certificate;
- the audio is a public-domain melody, synthesized for this, with no recorded or licensed voice.

To seed again, for example after a reviewer changed the demo vault:

1. `pnpm review:reset <number>` on each of the three numbers. They are free once `pnpm review:status` lists them with no account.
2. `pnpm review:seed`. Like `pnpm deploy:convex`, it needs `infisical login` and `npx convex login`.
3. The 24 words stay the same. For new ones, delete `REVIEW_KIT` in Infisical before seeding, then paste the new words into the review notes.

## Every submission

1. `pnpm review:status` → **Ready for review**.
   - It also checks that no earlier reviewer changed the demo accounts: the 24 words still open them, no device alert is pending, no key rotation is flagged, cloud backup is off, the owner is still on the Free plan, no deletion is scheduled and the language is English. Each problem names its fix. Pending device alerts, cloud backup and language: `pnpm review:clear <number>` (only the `REVIEW_PHONES` numbers). A new kit, a key rotation, a purchase or a deletion: re-seed ([above](#demo-accounts)).
   - If a reviewer used a sign-up number last time, free it first: `pnpm review:reset +447700900104` (or `+447700900105`).
   - The owner's travel mode pauses the Life check, so no check-in or escalation runs during the review. It lasts 30 days: after 26 November 2026, sign in to the demo account and turn it on again (Settings → Life check).
2. Paste the notes below into ASC and the Play Console, with the current code and words from Infisical, and each store's own sign-up number.
3. Each new sign-in to the demo owner raises a new-device alert on the phones already signed in to it, such as an earlier reviewer's. The notes tell reviewers to tap "It was me".
   - If you sign in to the demo account yourself during a review, never answer "It wasn't me": that revokes the reviewer's session.
   - Never rotate the demo account's keys.
4. When Apple and Google review at the same time, run `pnpm review:status` again after the first review ends.
5. After the review, run `pnpm review:reset <number>` on each sign-up number a reviewer created an account on.
6. Keep `REVIEW_CODE` while the app is live on Google Play: Play's App access must stay valid between submissions, and Google reviews again at any time (policy checks, declarations). Rotate it only if it may have leaked: change it in Infisical and on Convex ([setup](#setup) steps 1 to 3), then in the same step update the ASC notes and Play Console → App content → App access.

`pnpm review:status`, `pnpm review:clear` and `pnpm review:reset` run on prod through `pnpm with-env --env=prod` ([`scripts/review-accounts.mjs`](../../scripts/review-accounts.mjs), run with `tsx`). `status` also reads `REVIEW_KIT` from Infisical `prod` → `/keeplas_mobile` to check that the 24 words still open the demo accounts; it never prints them or the code. `reset` asks you to type the number again; `--yes` skips that. They need the backend of 29 October 2026 or later on prod: before that, `clear` doesn't exist and `status` wrongly reports the kit as not opening.

### App Store Connect: App Review Information

- **Sign-in required**: on.
- **User name**: `+447700900101`.
- **Password**: the review code.
- **Notes**:

```text
Keeplas has no email and password: an account is a phone number verified with a code, normally sent on WhatsApp, then a passkey on the device. The numbers below accept a fixed code instead, without WhatsApp.

The device needs a screen lock (passcode or PIN): Keeplas keeps the vault key behind it.

SIGN IN TO THE DEMO ACCOUNT
1. Tap "I already have an account".
2. Choose United Kingdom (search "United Kingdom" or "UK") and enter 07700 900101, or type the full number +447700900101. Then tap "Verify with WhatsApp".
3. Enter the code <REVIEW_CODE>, then tap "Confirm number".
4. This device has no vault key yet: choose "Use recovery kit", paste the 24 words below, then tap "Open my vault". If the app first offers to restore a backup, tap "Other options", then "Other ways back in", then "Use recovery kit".
   <24 WORDS>
5. The vault opens on Home. If the system asks to allow notifications, either answer works. If a "New device detected" screen appears, it is another reviewer's phone: tap "It was me".

Other reviewers use this demo account too. Please leave it as it is: don't buy Lifetime, delete it, create a new recovery kit, turn cloud backup on or use "Lost your number?" on it. Try those on the account you create below.

TRY SIGN-UP
Sign out first (Settings > Sign out). Tap "Get started" and use United Kingdom <SIGN-UP NUMBER> with the same code <REVIEW_CODE>. Real users receive their code on WhatsApp.
Sign-up checks that the app is genuine (App Attest on iPhone and iPad, Play Integrity on Android): it needs a real device, not a simulator or an emulator, with the app installed from the store. Creating the passkey needs iCloud Keychain turned on (iPhone, iPad), or a Google account (Android).

WHAT TO TRY
- Add an item: scan a document, take a photo, record a voice note or write a note. Items are encrypted on the device before upload.
- Contacts and sharing: the demo account has two trusted contacts (People tab). Each item shows who receives it after a confirmed death: Family items go to Alex, the others to both.
- The contacts' side: Alex (07700 900102) and Sam (07700 900103) sign in with steps 1 to 5, the same code and the same 24 words. As Alex, open Vault > Shared with me: Demo Owner's vault is listed and stays locked until a confirmed death (two contacts confirm, then 72 hours). Alex's own People tab is empty: Alex hasn't chosen contacts.
- In-app purchase, on the account you created: Settings > Upgrade to Lifetime (non-consumable "keeplas_lifetime"). New accounts are on the Free plan.
- Account deletion, on the account you created: Settings > Delete my account (erased 7 days later, can be cancelled).

WHAT TAKES DAYS
The Life check (a periodic "are you OK?" check), succession (two contacts confirm a death, then a 72-hour grace period) and recovery through contacts (a 72-hour protection window) run over days, so they can't be completed during review. The demo account's Life check is paused. Video of these flows: <VIDEO_URL>
```

- **Attachment**: optional, the same video.

### Play Console: App content → App access

- **All or some functionality in my app is restricted**.
- **Instruction name**: "Demo account (phone number and code)".
- **Username**: `+447700900101`.
- **Password**: the review code.
- **Any other instructions**: the same notes as above, with `07700 900105` as the sign-up number (ASC gets `07700 900104`).

### Play Console: App content declarations

Play blocks the release until each form is answered. Re-check the answers after any SDK change: a new SDK can add a permission (for example `AD_ID`).

- **Foreground service permissions**: declare `dataSync`, use case "Local processing: import or export".
  - Description: "The user starts a vault export in Settings → Export my data. The app downloads, decrypts and zips their files on the phone and shows a progress notification. If the export is interrupted, it stops and the user starts it again."
  - Video, about 30 seconds, unlisted: Settings → Export my data → Export → leave the app → the progress notification → the archive is ready.
- **Ads**: the app contains no ads.
- **Advertising ID**: No. The merged manifest has no `com.google.android.gms.permission.AD_ID`.
- **Content rating** (IARC): category All other app types; every content question No; users interact or exchange content: **Yes** (items, photos, voice notes and messages go to trusted contacts the user invites, nothing public); shares current location: No; digital purchases: **Yes**; unrestricted internet: No. Expected result: Everyone / PEGI 3, with "Users interact" and "In-app purchases".
- **Target audience**: 18 and over only, so the Families policy doesn't apply. The terms require 18+; the app checks it only when the user enters a date of birth (see the age item in [Left to do](#status)).
- **Trader status**: Trader (account level), then confirmed for the app, with the terms URL `https://www.keeplas.com/terms`.
- **News app**: No. **Government app**: No. **Financial features**: None. **Health apps**: None.
- **Data safety** and the delete-account URL: [Store privacy answers](#store-privacy-answers).

## Store privacy answers

These are proposed answers, read from the code (`packages/convex/schema.ts` and the mobile SDKs). Check them against any change before each submission.

Vault content (items, notes, files, voice notes) is end-to-end encrypted: Keeplas can't read it.

- **Google** says data only the sender and recipient can read "does not need to be disclosed".
- **Apple** defines "collect" as sending data off the device in a way that lets you access it, which Keeplas can't do for vault content.

| Data (Apple · Google)                                | Why it leaves the device                                                                                      | Required | Google purposes                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| Phone Number · Personal info → Phone number          | Account identity, codes and notifications (WhatsApp, run by Meta, via Infobip)                                | Yes      | App functionality, Account management, Developer communications |
| Name · Personal info → Name                          | Profile name shown to your contacts                                                                           | Yes      | App functionality, Account management                           |
| Email Address · Personal info → Email address        | Optional, plus the email addresses of contacts you invite                                                     | No       | App functionality, Account management                           |
| Contacts · Contacts                                  | The name, phone and email of each trusted contact you add (only the contact you pick, never the address book) | No       | App functionality                                               |
| Photos or Videos · Photos and videos → Photos        | Optional profile photo (not end-to-end encrypted)                                                             | No       | App functionality, Account management                           |
| Other Data Types · Personal info → Other info        | Date of birth and country of residence, when the user gives them (My account)                                 | No       | App functionality, Account management                           |
| Coarse Location · Location → Approximate location    | Country and city derived from the IP address, kept with the IP in the security log and the device list        | Yes      | App functionality, Fraud prevention, security, and compliance   |
| Customer Support · Messages → Other in-app messages  | Support requests: name, reply-to contact, message                                                             | No       | App functionality                                               |
| User ID · Personal info → User IDs                   | Account ID, also given to RevenueCat for purchases                                                            | Yes      | App functionality, Account management                           |
| Device ID · Device or other IDs                      | Device registry, push tokens (Expo, APNs, FCM)                                                                | Yes      | App functionality, Fraud prevention, security, and compliance   |
| Purchase History · Financial info → Purchase history | Lifetime purchase (RevenueCat)                                                                                | No       | App functionality, Analytics                                    |
| Product Interaction · App activity → Other actions   | Tamper-evident security log of account actions                                                                | Yes      | App functionality, Fraud prevention, security, and compliance   |

Every row is linked to the user.

- **Apple purposes**: App Functionality for every row, plus Analytics for Purchase History (RevenueCat's own guidance, for its purchase charts). No advertising, no analytics SDK, no tracking. Apple tracking: **No**.
- **Google purposes**: the column above. The privacy policy (§3) names the same uses: account management, security alerts, and fraud and abuse prevention (security log, code limits, sign-up attestation).
- **Google: shared with third parties**: None. Infobip, WhatsApp (Meta), Expo, RevenueCat and Resend are service providers acting for Keeplas.
- **Google: encrypted in transit**: Yes.
- **Google: users can request deletion**: Yes.
  - In the app: Settings → Delete my account.
  - On the web: `https://www.keeplas.com/delete-account` (French: `/fr/delete-account`). Paste this URL in the Data safety form's delete-account field.

## App Store accessibility

ASC → App Accessibility (Accessibility Nutrition Labels, voluntary for now). Apple asks that users can complete the app's common tasks (first launch, sign-in, purchase, settings) with each feature you claim.

| Feature                           | Claim                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Dark Interface                    | Yes: light and dark themes follow the system, or Settings → Appearance.                      |
| Differentiate Without Color Alone | Yes, after a check on a phone: errors have text, chips have labels, selections have a shape. |
| Reduced Motion                    | Yes, after a check with Reduce Motion on: the ambient animations stop.                       |
| VoiceOver, Voice Control          | Not yet: claim them only after a full pass with VoiceOver on a phone.                        |
| Larger Text                       | Not yet: some fixed-height fields don't grow at the largest sizes.                           |
| Sufficient Contrast               | Not yet: status chips, placeholders and checkbox rings are below Apple's ratios.             |
| Captions, Audio Descriptions      | Not applicable: the app has no media of its own.                                             |

## Account deletion requests from the web

The website page `https://www.keeplas.com/delete-account` (keeplas-website repo) shows the in-app steps with the app screens. At the end, people who can't open the app send the support form; it reaches the support inbox by email with the subject "Delete my Keeplas account" ("Supprimer mon compte Keeplas" in French).

1. **Confirm the request.** The form asks for the account's phone number. Message that number on WhatsApp and wait for a reply from it. If someone writes to support@keeplas.com instead, ask them for the account's phone number first.
2. **Schedule the deletion:**

   ```bash
   pnpm with-env --env=prod -- npx convex run --prod account_deletion:scheduleForPhone '{"phoneNumber":"+33600000000"}'
   ```

   This works like the in-app request: the account is erased 7 days later, and the owner is notified on every channel and can cancel from the app.

Payment records stay after deletion. The security log (with its IP addresses and countries) is kept for 30 days after the account is erased, then deleted (`account_deletion.purgeSecurityLog`). The website page must say the same.

## Before each submission

- [ ] The backend the build calls is deployed on prod (`pnpm deploy:convex`).
- [ ] `pnpm review:status` says **Ready for review**.
- [ ] Notes pasted with the current code and words, in ASC (sign-up number 07700 900104) and in the Play Console App access section (07700 900105).
- [ ] Export compliance answered for the build (see [`APP_STORE.md`](./APP_STORE.md#export-compliance)).
- [ ] App Privacy (ASC) and Data safety (Play) match the table above.
- [ ] The privacy policy URL is in both listings and opens from Settings in the app.
- [ ] The account-deletion URL is in the Play Data safety form.
- [ ] Play App content declarations answered, including the foreground service video ([above](#play-console-app-content-declarations)).
- [ ] Screenshots captured from the build being submitted, and descriptions that match it (sharing is per item).
- [ ] The build's version (`expo.version` in `app.json`) matches the version in ASC.
- [ ] ASC: not offered on Apple silicon Macs.
- [ ] `keeplas_lifetime` is attached to the version (ASC), with a real review screenshot.
- [ ] Video of the multi-day flows, linked in the notes.
- [ ] ASC → Business: Paid Apps Agreement Active, tax forms (W-8BEN-E) and bank account Active, no agreement waiting for the Account Holder. On the TestFlight build, Settings → Upgrade shows the price. A pending agreement already broke the purchase once (RevenueCat "code 23").
- [ ] Trader status verified: Apple (DSA) and Google Play.
- [ ] ASC → App Accessibility: claim only what the app supports ([below](#app-store-accessibility)).

Your own testers (TestFlight, Play closed and internal tracks) need none of this: they sign up with their real number and WhatsApp, like any user.

## Where it lives

| What                                                                       | Where                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The review code in place of the WhatsApp code                              | `packages/convex/phone_auth.ts` (`fixedCode`)                                                                                                                                                                                              |
| Readiness check (never returns the code) and reset (refuses other numbers) | `packages/convex/store_review.ts`                                                                                                                                                                                                          |
| `pnpm review:status`, `pnpm review:clear` and `pnpm review:reset`          | [`scripts/review-accounts.mjs`](../../scripts/review-accounts.mjs), demo numbers and kit check in [`scripts/review-demo.ts`](./scripts/review-demo.ts)                                                                                     |
| Demo accounts (`pnpm review:seed`) and their files                         | [`apps/mobile/scripts/review-seed.ts`](./scripts/review-seed.ts), `apps/mobile/scripts/review-seed/`                                                                                                                                       |
| Deletion of an account after a confirmed web request                       | `packages/convex/account_deletion.ts` (`scheduleForPhone`)                                                                                                                                                                                 |
| Tests                                                                      | `packages/convex/__tests__/`: `store_review.test.ts`, `phone_auth.test.ts`, `account_deletion.test.ts`                                                                                                                                     |
| Env vars                                                                   | [`.env.example`](../../.env.example) (`REVIEW_PHONES`, `REVIEW_CODE`)                                                                                                                                                                      |
| Encryption declaration                                                     | `apps/mobile/app.json` (`ITSAppUsesNonExemptEncryption`)                                                                                                                                                                                   |
| Contact picker without a contacts permission                               | `apps/mobile/src/features/people/pick-contact.ts` (iOS) and `pick-contact.android.ts`, native side in `apps/mobile/modules/contact-picker/`                                                                                                |
| Website deletion page                                                      | keeplas-website: `apps/web/src/pages/[...lang]/delete-account.astro`, app screens in `apps/web/src/components/delete-account/`, text in `apps/web/src/dictionaries/en.json` and `fr.json`, form handler `apps/web/src/lib/contact/send.ts` |
