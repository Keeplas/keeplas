# Ways back into the vault

What the owner can still do after losing something, as the app works today (2026-10-27). Use it to check product copy and as the grid for real-phone tests on Android and iPhone.

## The ways back

| Way back                 | Needs                                                                                                      | Automatic?                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cloud backup, iPhone     | Same Apple account with iCloud Keychain on the new iPhone                                                  | Yes: sealed at every vault opening (D7)                                                                       |
| Cloud backup, Android    | New phone set up by restoring from the Google backup, Keeplas restored in that flow, end-to-end encryption | Partly: Block Store only reaches a phone through a setup restore (see [passkey study](passkey-prf-unlock.md)) |
| Another signed-in device | The old phone (or another phone) still signed in                                                           | No: approve from the old phone (`link-from-device`)                                                           |
| Recovery kit             | The 24 words, typed or scanned from the kit QR code                                                        | No                                                                                                            |
| Trusted contacts         | 2 accepted trust contacts, recovery sealed (automatic since PR #339), 2 approvals, then 72 h               | No: last resort                                                                                               |

Signing in (phone number + WhatsApp code) never opens the vault by itself: it only proves the number. Every way above also needs it, except the support request below.

## What was lost → how to get back

| Lost                                                          | Ways back                                                                                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The phone, new iPhone on the same Apple account               | Cloud backup. Otherwise kit or contacts.                                                                                                                   |
| The phone, new Android on the same Google account             | Cloud backup only if the phone was set up from the Google backup. Otherwise kit or contacts.                                                               |
| Changing platform, old phone in hand                          | Another signed-in device (works between iPhone and Android). Otherwise kit or contacts.                                                                    |
| Changing platform, old phone lost                             | Kit or contacts. The cloud backup never crosses from iCloud to Google or back.                                                                             |
| **The phone and the Google / Apple account**                  | **Kit or contacts.** The cloud backup is gone with the account. This can't be avoided without breaking zero-access: Keeplas alone must never open a vault. |
| The phone number                                              | With the kit: change the number right away (`lost-number/kit`). Without it: support request, checked over 72 h. The vault then opens with any way above.   |
| The kit only                                                  | Nothing lost yet: create a new kit in Settings (the old words stop working).                                                                               |
| Phone, Google / Apple account, kit, and fewer than 2 contacts | **No way back.** By design: nobody, Keeplas included, can open the vault.                                                                                  |

## What this asks of the product

- One way back besides the phone is the minimum (Home shows "covered"). Two independent ones are what protects against losing the Google / Apple account: the cloud backup plus the kit, or the cloud backup plus contacts.
- Copy must never suggest that Keeplas support can open a vault. Support can move an account to a new number; only the owner's ways back open the vault.
- The last row is the honest worst case. Onboarding and the Recovery center should push the owner to a second way back before it happens.

## Real-phone test grid

For each platform (Android, iPhone), with a test account that has a vault:

1. Cloud backup: sign out, sign in again, open with the cloud backup. On Android, also try a phone set up "as new" and confirm the app falls back to the kit and contacts with a clear message.
2. Kit: sign out, open with the 24 words typed, then with the kit QR code (camera and image).
3. Another signed-in device: open on a second phone, approve from the first.
4. Contacts: the 7-step scenario from PR #339 (3 test numbers, `recovery_node:release` to skip the 72 h).
5. Legacy account (created on the web, never opened on mobile): the kit screen explains it is the last time the words are needed, and contacts are only offered once ready.
