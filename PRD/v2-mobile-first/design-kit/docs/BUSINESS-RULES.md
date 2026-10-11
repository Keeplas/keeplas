# Business rules shown in the mockups

## Platforms and sign-up

- Sign-up happens only in the mobile app (iOS / Android). The web app has no sign-up form.
- On desktop, a visitor without an account is invited to download the app: store badges and a QR code that opens the right store.
- A computer is only connected by scanning a QR code from the phone app; later visits on a trusted browser use a passkey.
- Invitations opened on a computer also lead to the app: contacts and beneficiaries sign up on their phone.
- Setup, the 24-word kit and every recovery path run on the phone; the web Recovery center only shows status.

## Language

- English is the app's default language, on mobile and web, including on first launch.
- French is offered through the language selector; the choice is saved on the account and the device.
- Any key missing in French falls back to English.

## Identity

- The account is identified by a phone number verified with a WhatsApp code. No email is required.
- The number is used to find the account. It is never enough to unlock the vault.
- WhatsApp is only used for notifications: no vault content goes through it.

## Authentication

- Sign-in with a device-bound passkey (Face ID or fingerprint), no password.
- Optional 6-digit Keeplas code, asked after biometrics when enabled.
- On the web: the first sign-in is always a QR link from the phone (expires after about 2 minutes); later sign-ins on a trusted browser use a passkey. No password, no phrase entry on the web.

## Vault and encryption

- The vault is created and encrypted on the device. Keeplas cannot read its content.
- Each captured item is encrypted before leaving the device, then uploaded and marked Protected.
- Categories: Documents, Accounts, Instructions, Other, plus the Encrypted inbox (items to sort).

## Setup

- Required (3): verify the number, create a passkey, create the vault.
- Optional (2): add trust contacts, export a 24-word recovery kit.
- Without contacts or a kit, losing every device and passkey can lock the user out for good: say it clearly.

## Trust contacts and beneficiaries

- Up to 3 trust contacts; 2 confirmations are enough.
- Trust contact: helps recover access and confirms a death. Cannot read files.
- Beneficiary: receives the content assigned to them, now or later.
- The two roles are independent and can be combined. Replacing a contact renews protection.

## Access recovery

- 3 methods: another signed-in device, trust contacts, recovery kit.
- Through contacts: 2 approvals + a 48 h protection window starting at the request.
- A 4-digit code is compared by phone or video call between the owner and each contact.
- The owner can cancel during the window. At the end: new passkey, protection renewed, data still encrypted.

## Succession

- 2 trust contacts confirm the death, then a 72 h grace period applies.
- Only assigned content is released, folder by folder.
- Sharing timing per folder: now, or after verification and waiting period.

## Life check

- Periodic check with a single action and no snooze.
- A missed answer never triggers sharing on its own. Keeplas checks again later before any other step.

## Sharing

- Scope: this folder only. The recipient sees nothing else in the vault.
- View permission: view and download.
- Revoking prevents future access, but copies already saved cannot be removed.

## Devices

- Linking a browser requires Face ID on the phone.
- Every device is notified of each new link or sign-in.
- New device alert: It was me / It wasn't me. Any device can be revoked.
- Optional encrypted backups: Keeplas, iCloud, Google.
