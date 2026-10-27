# App Store & Google Play review

Everything about getting Keeplas through store review:

- what is done and what is left;
- what the stores check;
- how reviewers get in, and how to prepare their accounts;
- what to fill in App Store Connect (ASC) and the Play Console;
- how support handles deletion requests made on the website.

Building and uploading: [`APP_STORE.md`](./APP_STORE.md) (iOS) and [`README.md`](./README.md) (Android).

## Status

As of 27 October 2026.

**Done**

- **Review system** ([#327](https://github.com/Keeplas/keeplas/pull/327)), live on prod Convex (`energetic-pony-179`):
  - the review code works for sign-in and sign-up on the review numbers;
  - `pnpm review:status` and `pnpm review:reset`;
  - `scheduleForPhone`, for deletion requests made on the website.
- **Prod config:** `REVIEW_PHONES` (the six [review numbers](#review-numbers)) and `REVIEW_CODE` are set in Infisical `prod` → `/keeplas_app` and on prod Convex. `pnpm review:status` says `REVIEW_CODE: set`.
- **No dev bypass on prod:** `DEV_TEST_PHONES`, `APP_ATTEST_ALLOW_DEVELOPMENT` and `ATTESTATION_SIMULATOR_BYPASS` are not set. The kill switches `NOTIFICATIONS_PAUSED` and `LIFE_CHECK_PAUSED` are off, so invitations go out and the Life check runs.
- **Encryption:** `app.json` declares the app's own encryption. The export compliance answers and the algorithm list are in [`APP_STORE.md`](./APP_STORE.md#export-compliance).
- **France (ANSSI):** the cryptology declaration was filed on 27 October 2026 and accepted (dossier 34982065). Attach the filing receipt in App Store Connect when it asks for the French declaration; it is kept outside the repo.
- **Website:** the deletion page shows the in-app steps, drawn from the app's own screens, and ends with a form that asks for the account's phone number ([keeplas-website#21](https://github.com/Keeplas/keeplas-website/pull/21), [#22](https://github.com/Keeplas/keeplas-website/pull/22)).
- **[Demo accounts](#demo-accounts)**, seeded with `pnpm review:seed` on 27 October 2026: the owner, two accepted contacts and six items. The command opens each account again like a new phone (review code, then the stored 24 words): every item and file decrypts, and `pnpm review:status` says **Ready for review**.

**Left to do**

- [ ] Record the video of the multi-day flows and put its link in the review notes.
- [ ] US export documentation: confirm the route with counsel, either the BIS self-classification report or the open-source notification.
- [ ] Upload a new iOS build: the encryption declaration only applies to builds made after it. It must also include the UK review numbers fix.
- [ ] Android: upload the launch AAB (it must include the UK review numbers fix), then create the `keeplas_lifetime` product in the Play Console. Play refuses the product until an AAB with billing is on a track.
- [ ] Fill in ASC and the Play Console: review notes, App Privacy, Data safety, deletion URL ([checklist](#before-each-submission)).

## What the stores check

Both stores can reject a version. A rejection cites the rule: fix the problem and resubmit, or appeal.

| Check                               | Rule                                                                                                         | Keeplas                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewers can sign in               | Apple 2.1; Play **App access**                                                                               | Review numbers and code, with notes to paste (below)                                                                                                          |
| The app works without another app   | Apple 4.2.3(i): "Your app should work on its own without requiring installation of another app to function." | Users get their codes on WhatsApp, but reviewers don't need it. If Apple still cites this rule, the fix is an SMS fallback for codes, which isn't built.      |
| Encryption is declared              | Apple export compliance; France (ANSSI)                                                                      | `ITSAppUsesNonExemptEncryption: true`; answers and filings in [`APP_STORE.md`](./APP_STORE.md#export-compliance)                                              |
| Paid features use in-app purchase   | Apple 3.1.1                                                                                                  | Lifetime is the in-app product `keeplas_lifetime` (RevenueCat), with Restore. The iOS app shows no web price and no link to pay elsewhere.                    |
| Users can delete their account      | Apple 5.1.1(v); Play also asks for a web link                                                                | Settings → Delete my account; on the web, `https://www.keeplas.com/delete-account`                                                                            |
| Privacy is disclosed                | Apple 5.1.1(i) and App Privacy; Play Data safety                                                             | The app links the privacy policy at sign-up and in Settings; add its URL to both listings. Proposed answers: [Store privacy answers](#store-privacy-answers). |
| Contacts access is declared         | Play Data safety                                                                                             | On Android the app asks for `READ_CONTACTS`, but only reads the contact the user picks. Declare it as Contacts.                                               |
| Testing before production (Android) | Play: personal developer accounts created after 13 Nov 2023                                                  | A closed test with at least 12 testers for 14 days in a row. An organization account is exempt.                                                               |
| Target API (Android)                | Play: Android 16 (API 36) since 31 Aug 2026                                                                  | React Native 0.86 (Expo SDK 57) targets API 36                                                                                                                |

Not a problem:

- Death and inheritance are accepted subjects on both stores.
- Sign in with Apple (4.8) is only required when an app offers a third-party login, and Keeplas has none.
- A phone number used as the login is accepted.

## How reviewers sign in

Keeplas has no email and password. An account is a phone number verified with a code sent on WhatsApp, then a passkey on the device. Reviewers can't receive those WhatsApp codes, so:

- Numbers listed in `REVIEW_PHONES` accept the secret 6-digit `REVIEW_CODE` instead of a WhatsApp code, for sign-in and for sign-up (`packages/convex/phone_auth.ts`). No WhatsApp message is sent for them.
- Nothing else is bypassed. Sign-up still needs the App Attest / Play Integrity attestation of the genuine app. A new device still needs the 24-word recovery kit to open the vault.
- The usual limits apply: 3 code requests per hour and 5 attempts per code. `pnpm review:reset` refuses any number outside `REVIEW_PHONES`.

Both stores accept this:

- Apple: "If your app requires an authentication code in addition to or instead of login credentials, include it in the Notes field in advance."
- Google: flag one-time passwords under **Any other instructions** in the App access section.

## Review numbers

Use numbers nobody can own, so no message ever reaches a real person. In North America, 555-0100 to 555-0199 are reserved for fiction and never assigned. In the UK, Ofcom keeps 07700 900000 to 900999 for drama. The app's phone check accepts both (`toE164` in `apps/mobile/src/lib/phone.ts` lets the UK range through, since libphonenumber rejects it).

| Number          | Role            | Account                                                      |
| --------------- | --------------- | ------------------------------------------------------------ |
| +1 202 555 0101 | Demo owner      | Seeded vault, recovery kit, 2 accepted contacts, Free plan   |
| +1 202 555 0102 | Demo contact 1  | Accepts the owner's invitation                               |
| +1 202 555 0103 | Demo contact 2  | Accepts the owner's invitation                               |
| +1 202 555 0104 | Sign-up test    | No account: reviewers create one; reset it after each review |
| +44 7700 900101 | UK sign-up test | Same, for a reviewer who tries a UK number                   |
| +44 7700 900102 | UK sign-up test | Same, spare                                                  |

WhatsApp messages to these numbers fail quietly. Push notifications reach the phones signed in to the account, such as a reviewer's.

## Setup

Done on prod on 26 October 2026. Steps 1 to 3 also rotate the code. A new deployment needs all five.

1. **Pick the code**: 6 random digits.

   ```bash
   node -e "console.log(require('crypto').randomInt(1e6).toString().padStart(6, '0'))"
   ```

2. **Store the values** in Infisical `prod` → `/keeplas_app`:
   - `REVIEW_PHONES=+12025550101,+12025550102,+12025550103,+12025550104,+447700900101,+447700900102`
   - `REVIEW_CODE=<the 6 digits>`

   Infisical also copies them to Vercel. The web app doesn't read them, so Vercel needs no redeploy.

3. **Push them to the prod Convex deployment.** The prod env sync skips empty keys and never unsets them.

   ```bash
   pnpm with-env --env=prod -- sh -c 'npx convex env set --prod REVIEW_PHONES "$REVIEW_PHONES" && npx convex env set --prod REVIEW_CODE "$REVIEW_CODE"'
   ```

4. **Deploy the backend** that accepts review sign-ups (`pnpm deploy:convex`), if the current prod deploy predates it.

5. **Check**: `pnpm review:status` lists the six numbers and says `REVIEW_CODE: set`.

## Demo accounts

`pnpm review:seed` ([`scripts/review-seed.ts`](./scripts/review-seed.ts)) creates the owner and the two contacts on prod; it last ran on 27 October 2026.

- **It runs the app's own code:**
  - vault keys (`crypto/vault-keys.ts`);
  - items (`features/capture/seal.ts` and the outbox);
  - contact key checks (`crypto/contact-keys.ts`).
- **No phone needed:** the sign-up attestation comes from the internal `attestation:grantSignup`, run with your Convex login.
- **Proof:** it ends by opening each account again like a new phone.
- **No devices:** the accounts have none yet, so the first reviewer's phone becomes the first one.

| Account                     | Number          | 24 words (Infisical `prod` → `/keeplas_mobile`) |
| --------------------------- | --------------- | ----------------------------------------------- |
| Demo Owner                  | +1 202 555 0101 | `REVIEW_DEMO_KIT`                               |
| Alex Demo (owner's contact) | +1 202 555 0102 | `REVIEW_CONTACT_1_KIT`                          |
| Sam Demo (owner's contact)  | +1 202 555 0103 | `REVIEW_CONTACT_2_KIT`                          |

The owner's vault holds no real personal data:

| Item                     | Category  | File                  | After a confirmed death |
| ------------------------ | --------- | --------------------- | ----------------------- |
| Summer at the lake       | Family    | Photo (JPEG)          | Alex                    |
| A tune for the kids      | Family    | Audio (m4a)           | Alex                    |
| Where the house keys are | Family    | (note)                | Alex                    |
| Home insurance policy    | Paperwork | PDF stamped SAMPLE    | Alex and Sam            |
| Insurance contacts       | Paperwork | (note)                | Alex and Sam            |
| Email account            | Accounts  | (note, made-up login) | Alex and Sam            |

- **Settings:**
  - Free plan, so reviewers can try the Lifetime purchase in the sandbox;
  - Life check quarterly, with travel mode on until 26 November 2026;
  - cloud backup turned off, so reviewers' phones don't turn it on and each new reviewer goes straight to the recovery kit.
- **Contacts:**
  - invited by phone only, so no message reached anyone;
  - they accepted, and their keys are pinned on the owner's side.
- **Never create another kit on the owner account.** A new kit replaces the old one, and the words in the review notes stop working.

The files come from `scripts/review-seed/`:

- the photo is the app's landscape illustration;
- the PDF is a made-up certificate;
- the audio is a public-domain melody, synthesized for this, with no recorded or licensed voice.

To seed again, for example after a reviewer changed the demo vault:

1. `pnpm review:reset <number>` on each of the three numbers. They are free once `pnpm review:status` lists them with no account.
2. `pnpm review:seed`. Like `pnpm deploy:convex`, it needs `infisical login` and `npx convex login`.
3. The 24 words are new: paste the new `REVIEW_DEMO_KIT` into the review notes.

## Every submission

1. `pnpm review:status` → **Ready for review**.
   - If a reviewer used a sign-up number last time, free it first: `pnpm review:reset +12025550104` (or the UK one).
   - The owner's travel mode pauses the Life check, so no check-in or escalation runs during the review. It lasts 30 days: after 26 November 2026, sign in to the demo account and turn it on again (Settings → Life check).
2. Paste the notes below into ASC and the Play Console, with the current code and words from Infisical.
3. Each new sign-in to the demo owner raises a new-device alert on the phones already signed in to it, such as an earlier reviewer's.
   - If you sign in to the demo account yourself during a review, never answer "It wasn't me": that revokes the reviewer's session.
   - Never rotate the demo account's keys.
4. After the review, run `pnpm review:reset <number>` on each sign-up number a reviewer created an account on.
5. Rotate `REVIEW_CODE`: it sits in the review notes, and with the attestation it can create accounts on the listed numbers. Change it in Infisical and on Convex ([setup](#setup) steps 1 to 3); the next submission's notes use the new one.

`pnpm review:status` and `pnpm review:reset` run on prod through `pnpm with-env --env=prod` ([`scripts/review-accounts.mjs`](../../scripts/review-accounts.mjs)). `reset` asks you to type the number again; `--yes` skips that.

### App Store Connect: App Review Information

- **Sign-in required**: on.
- **User name**: `+12025550101`.
- **Password**: the review code.
- **Notes**:

```text
Keeplas has no email and password: an account is a phone number verified with a code, normally sent on WhatsApp, then a passkey on the device. The numbers below accept a fixed code instead, without WhatsApp.

SIGN IN TO THE DEMO ACCOUNT
1. Tap "I already have an account".
2. Choose United States and enter (202) 555-0101, then tap "Verify with WhatsApp".
3. Enter the code <REVIEW_CODE>, then tap "Confirm number".
4. This device has no vault key yet: choose "Use recovery kit", paste the 24 words below, then tap "Open my vault". If the app first offers to restore from iCloud or Google, tap "Other ways back in", then "Use recovery kit".
   <24 WORDS>
5. The vault opens on Home. If the app asks to turn on security alerts, either answer works.

TRY SIGN-UP
Tap "Get started" and use (202) 555-0104, or United Kingdom 07700 900101, with the same code <REVIEW_CODE>. Real users receive their code on WhatsApp.

WHAT TO TRY
- Add an item: scan a document, take a photo, record a voice note or write a note. Items are encrypted on the device before upload.
- Contacts and sharing: the demo account has two trusted contacts (People tab). Each item shows who receives it after a confirmed death: Family items go to Alex, the others to both.
- In-app purchase: Settings > Upgrade to Lifetime (non-consumable "keeplas_lifetime"). The demo account is on the Free plan.
- Account deletion: Settings > Delete my account (erased 7 days later, can be cancelled).

WHAT TAKES DAYS
The Life check (a periodic "are you OK?" check), succession (two contacts confirm a death, then a 72-hour grace period) and recovery through contacts (a 72-hour protection window) run over days, so they can't be completed during review. The demo account's Life check is paused. Video of these flows: <VIDEO_URL>
```

- **Attachment**: optional, the same video.

### Play Console: App content → App access

- **All or some functionality in my app is restricted**.
- **Instruction name**: "Demo account (phone number and code)".
- **Username**: `+12025550101`.
- **Password**: the review code.
- **Any other instructions**: the same notes as above.

## Store privacy answers

These are proposed answers, read from the code (`packages/convex/schema.ts` and the mobile SDKs). Check them against any change before each submission.

Vault content (items, notes, files, voice notes) is end-to-end encrypted: Keeplas can't read it.

- **Google** says data only the sender and recipient can read "does not need to be disclosed".
- **Apple** defines "collect" as sending data off the device in a way that lets you access it, which Keeplas can't do for vault content.

| Data (Apple · Google)                                | Why it leaves the device                                                                                      | Linked to the user |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------ |
| Phone Number · Personal info → Phone number          | Account identity, codes and notifications (WhatsApp via Infobip)                                              | Yes                |
| Name · Personal info → Name                          | Profile name shown to your contacts                                                                           | Yes                |
| Email Address · Personal info → Email address        | Optional, plus the email addresses of contacts you invite                                                     | Yes                |
| Contacts · Contacts                                  | The name, phone and email of each trusted contact you add (only the contact you pick, never the address book) | Yes                |
| Photos or Videos · Photos and videos → Photos        | Optional profile photo (not end-to-end encrypted)                                                             | Yes                |
| Other Data Types · Personal info → Other info        | Date of birth, if the user adds it in My account                                                              | Yes                |
| Coarse Location · Location → Approximate location    | Country derived from the IP address, kept with the IP in the security log                                     | Yes                |
| Customer Support · Messages → Other in-app messages  | Support requests: name, reply-to contact, message                                                             | Yes                |
| User ID · Personal info → User IDs                   | Account ID, also given to RevenueCat for purchases                                                            | Yes                |
| Device ID · Device or other IDs                      | Device registry, push tokens (Expo, APNs, FCM)                                                                | Yes                |
| Purchase History · Financial info → Purchase history | Lifetime purchase (RevenueCat)                                                                                | Yes                |
| Product Interaction · App activity → Other actions   | Tamper-evident security log of account actions                                                                | Yes                |

- **Purposes**: App Functionality only: no advertising, no analytics SDK, no tracking. Apple tracking: **No**.
- **Google: shared with third parties**: None. Infobip, Expo, RevenueCat and Resend are service providers acting for Keeplas.
- **Google: encrypted in transit**: Yes.
- **Google: users can request deletion**: Yes.
  - In the app: Settings → Delete my account.
  - On the web: `https://www.keeplas.com/delete-account` (French: `/fr/delete-account`). Paste this URL in the Data safety form's delete-account field.

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

- [ ] `pnpm review:status` says **Ready for review**.
- [ ] Notes pasted with the current code and words, in ASC and in the Play Console App access section.
- [ ] Export compliance answered for the build (see [`APP_STORE.md`](./APP_STORE.md#export-compliance)).
- [ ] App Privacy (ASC) and Data safety (Play) match the table above.
- [ ] The privacy policy URL is in both listings and opens from Settings in the app.
- [ ] The account-deletion URL is in the Play Data safety form.
- [ ] `keeplas_lifetime` is attached to the version (ASC), with a real review screenshot.
- [ ] Video of the multi-day flows, linked in the notes.
- [ ] Android: if the Play developer account is a personal one created after 13 Nov 2023, a closed test ran with at least 12 testers opted in for 14 days in a row before production access.

Your own testers (TestFlight, Play closed and internal tracks) need none of this: they sign up with their real number and WhatsApp, like any user.

## Where it lives

| What                                                                       | Where                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The review code in place of the WhatsApp code                              | `packages/convex/phone_auth.ts` (`fixedCode`)                                                                                                                                                                                              |
| Readiness check (never returns the code) and reset (refuses other numbers) | `packages/convex/store_review.ts`                                                                                                                                                                                                          |
| `pnpm review:status` and `pnpm review:reset`                               | [`scripts/review-accounts.mjs`](../../scripts/review-accounts.mjs)                                                                                                                                                                         |
| Demo accounts (`pnpm review:seed`) and their files                         | [`apps/mobile/scripts/review-seed.ts`](./scripts/review-seed.ts), `apps/mobile/scripts/review-seed/`                                                                                                                                       |
| Deletion of an account after a confirmed web request                       | `packages/convex/account_deletion.ts` (`scheduleForPhone`)                                                                                                                                                                                 |
| Tests                                                                      | `packages/convex/__tests__/`: `store_review.test.ts`, `phone_auth.test.ts`, `account_deletion.test.ts`                                                                                                                                     |
| Env vars                                                                   | [`.env.example`](../../.env.example) (`REVIEW_PHONES`, `REVIEW_CODE`)                                                                                                                                                                      |
| Encryption declaration                                                     | `apps/mobile/app.json` (`ITSAppUsesNonExemptEncryption`)                                                                                                                                                                                   |
| Website deletion page                                                      | keeplas-website: `apps/web/src/pages/[...lang]/delete-account.astro`, app screens in `apps/web/src/components/delete-account/`, text in `apps/web/src/dictionaries/en.json` and `fr.json`, form handler `apps/web/src/lib/contact/send.ts` |
