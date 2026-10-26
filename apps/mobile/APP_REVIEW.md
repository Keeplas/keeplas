# App Store & Google Play review

How store reviewers get into Keeplas, how to prepare their accounts, and what to fill in App Store Connect (ASC) and the Play Console before a submission. Building and uploading: [`APP_STORE.md`](./APP_STORE.md) (iOS) and [`README.md`](./README.md) (Android).

## How reviewers sign in

Keeplas has no email and password. An account is a phone number verified with a code sent on WhatsApp, then a passkey on the device. Reviewers can't receive those WhatsApp codes, so:

- Numbers listed in `REVIEW_PHONES` accept the secret 6-digit `REVIEW_CODE` instead of a WhatsApp code, for sign-in and for sign-up (`packages/convex/phone_auth.ts`). No WhatsApp message is sent for them.
- Nothing else is bypassed. Sign-up still needs the App Attest / Play Integrity attestation of the genuine app. A new device still needs the 24-word recovery kit to open the vault. The passkey is created on the reviewer's device.
- The usual limits apply: 3 code requests per hour and 5 attempts per code. `pnpm review:reset` refuses any number outside `REVIEW_PHONES`.

Both stores accept this:

- Apple: "If your app requires an authentication code in addition to or instead of login credentials, include it in the Notes field in advance."
- Google: flag one-time passwords under **Any other instructions** in the App access section.

## Review numbers

Use numbers nobody can own, so no message ever reaches a real person. In North America, 555-0100 to 555-0199 are reserved for fiction and never assigned, and the app's phone check accepts them. The UK drama range (+44 7700 900xxx) does **not** pass the app's phone check.

| Number          | Role           | Account                                                      |
| --------------- | -------------- | ------------------------------------------------------------ |
| +1 202 555 0101 | Demo owner     | Seeded vault, recovery kit, 2 accepted contacts, Free plan   |
| +1 202 555 0102 | Demo contact 1 | Accepts the owner's invitation                               |
| +1 202 555 0103 | Demo contact 2 | Accepts the owner's invitation                               |
| +1 202 555 0104 | Sign-up test   | No account: reviewers create one; reset it after each review |

WhatsApp messages to these numbers fail quietly. Push notifications still reach the device you seed the accounts on.

## One-time setup

1. **Pick the code**: 6 random digits.

   ```bash
   node -e "console.log(require('crypto').randomInt(1e6).toString().padStart(6, '0'))"
   ```

2. **Store the values** in Infisical `prod` → `/keeplas_app`:
   - `REVIEW_PHONES=+12025550101,+12025550102,+12025550103,+12025550104`
   - `REVIEW_CODE=<the 6 digits>`

3. **Push them to the prod Convex deployment.** The prod env sync skips empty keys and never unsets them.

   ```bash
   pnpm with-env --env=prod -- sh -c 'npx convex env set --prod REVIEW_PHONES "$REVIEW_PHONES" && npx convex env set --prod REVIEW_CODE "$REVIEW_CODE"'
   ```

4. **Deploy the backend** that accepts review sign-ups (`pnpm deploy:convex`), if the current prod deploy predates it.

5. **Check**: `pnpm review:status` lists the four numbers and says `REVIEW_CODE: set`.

## Seed the demo accounts

Use a real iPhone or Android phone with the production app (a TestFlight or internal-track build). App Attest and Play Integrity reject simulators on prod.

1. **Owner.**
   1. Tap **Get started**, then enter **+1 202 555 0101** and the review code.
   2. Name the account "Demo Owner" and finish setup (passkey; skip the Keeplas code).
2. **Recovery kit.** Settings → Privacy and security → Recovery kit → **Create my kit**. Store the 24 words in Infisical `prod` → `/keeplas_mobile` as `REVIEW_DEMO_KIT`.
   - Never create another kit on this account: a new kit replaces the old one, and the words in the review notes stop working.
3. **Content.** Add 6 to 8 items with no real personal data:
   - a scanned document (any page stamped SAMPLE);
   - a photo;
   - a voice note;
   - a note ("Where the house keys are", "Insurance contacts");
   - an account entry with a made-up login.

   Sort them into two folders, for example "Family" and "Paperwork".

4. **Contacts.** Add two contacts:
   - Contact 1: name "Alex Demo", phone **+1 202 555 0102**.
   - Contact 2: name "Sam Demo", phone **+1 202 555 0103**.
   - Give each one an email address you read, such as a team alias. The invitation link arrives by email, since WhatsApp can't reach these numbers.
5. **Accept the invitations.**
   1. Sign out.
   2. Open the invitation email on the phone and sign up as the contact with the review code.
   3. Accept the invitation.

   Repeat for the second contact, then sign back in as the owner.

6. **Sharing.**
   - Share "Family" with Alex now.
   - Share "Paperwork" with both contacts for after a confirmed death.
7. **Life check.** Settings → Life check: set it to **quarterly**.
8. **Plan.** Stay on **Free**, so reviewers can try the Lifetime purchase in the sandbox.
9. **Check.** `pnpm review:status` ends with **Ready for review**.

## Every submission

1. `pnpm review:status` → **Ready for review**.
   - If a reviewer used the sign-up number last time, free it first: `pnpm review:reset +12025550104`.
   - On the owner account, turn on travel mode (Settings → Life check). It pauses the Life check for 30 days, so no check-in or escalation runs during the review.
2. Paste the notes below into ASC and the Play Console, with the current code and words from Infisical.
3. While a review runs, sign-ins to the demo owner trigger a new-device alert on your phone.
   - Never answer "It wasn't me": that revokes the reviewer's session.
   - Never rotate the demo account's keys.
4. After the review, run `pnpm review:reset +12025550104` if a reviewer created an account on it.
5. Rotate `REVIEW_CODE`: it sits in the review notes, and with the attestation it can create accounts on the listed numbers. Change it in Infisical and on Convex (setup step 3); the next submission's notes use the new one.

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
4. This device has no vault key yet: choose "Use recovery kit", paste the 24 words below, then tap "Open my vault".
   <24 WORDS>
5. Create the passkey when asked (Face ID or the device passcode). If asked to add a Keeplas code, skip it or choose any 4 digits.

TRY SIGN-UP
Tap "Get started" and use (202) 555-0104 with the same code <REVIEW_CODE>. Real users receive their code on WhatsApp.

WHAT TO TRY
- Add an item: scan a document, take a photo, record a voice note or write a note. Items are encrypted on the device before upload.
- Contacts and sharing: the demo account has two trusted contacts and folders shared with them.
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
| Other Data Types · Personal info → Other info        | Date of birth and country of residence asked at sign-up                                                       | Yes                |
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
  - On the web: `https://app.keeplas.com/delete-account`. Paste this URL in the Data safety form's delete-account field.

## Account deletion requests from the web

The public page `https://app.keeplas.com/delete-account` explains in-app deletion. It also files an `account_deletion` support ticket for people who no longer have the app; the ticket lands in the support inbox.

1. **Confirm the request.** The page asks for the account's phone number. Message that number on WhatsApp and wait for a reply from it; if the ticket came without a number, ask for it first.
2. **Schedule the deletion:**

   ```bash
   pnpm with-env --env=prod -- npx convex run --prod account_deletion:scheduleForPhone '{"phoneNumber":"+33600000000"}'
   ```

   This works like the in-app request: the account is erased 7 days later, and the owner is notified on every channel and can cancel from the app.

Payment records and the security log stay after deletion. The page says so.

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
