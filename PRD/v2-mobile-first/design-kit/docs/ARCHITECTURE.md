# Keeplas architecture review

Source: `github.com/Keeplas/keeplas` at commit 512f03d · 2026-09-24. Written in English like the app and the codebase.

## Summary

Keeplas runs on Convex with client-side post-quantum cryptography, per-item keys, a two-stage life check, scoped release and a hash-chained audit log. Keep Convex. Use SQLite for local/self-hosted development and on the mobile app; use Convex Cloud or Convex on Postgres in production.

## Stack (as built)

- **Web**: TanStack Start (Vite) + React 19 in SPA mode, Tailwind v4, shadcn/Radix, Tiptap 3, lucide-react. i18n en/fr with English as default. Request middleware in apps/web/src/start.ts (CSP, sealed audit cookie).
- **Backend**: Convex ^1.35 in packages/convex: about 13,000 lines, 28 tables, crons, scheduler, actions. Runs on Convex Cloud or self-hosted with CONVEX_MODE=selfhosted.
- **Auth**: Convex Auth: Password with always-on email OTP (Resend), passwordless phone-otp over WhatsApp (Infobip), WebAuthn passkeys (@simplewebauthn), TOTP, step-up gate requireFullAuth. Target: sign-up only from the mobile app; the web signs in by QR, then passkey (F8).
- **Crypto**: @noble/post-quantum (ML-KEM-768, ML-DSA-65), hash-wasm Argon2id, WebCrypto AES-256-GCM, Shamir over GF(256), BIP39. CODEOWNERS: founders only. Invariants checked by pnpm check:zk.
- **Messaging**: Infobip WhatsApp (OTP, life check, invitations), Resend email, Web Push with VAPID.
- **Billing**: Stripe one-time checkout: Free (100 MB) and Lifetime (10 GB).
- **Quality**: Turborepo + pnpm, Vitest (crypto and Convex tests), CI lint/typecheck/test/audit, CodeQL, CLA, guarded prod deploy (pnpm deploy:convex).
- **Mobile**: Not started. The designs are mobile-first: an Expo app is needed (see Fix plan).

## Convex and SQLite

| Environment       | Choice                                              | Why                                                                                                                                                                                       | Status  |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Local development | Convex self-hosted, SQLite                          | One file, zero setup, works offline. docker-compose already in the repo.                                                                                                                  | Built   |
| Preview / staging | Convex Cloud dev deployment                         | Same behaviour as prod, disposable.                                                                                                                                                       | Built   |
| Production        | Convex Cloud, or self-hosted on Postgres            | SQLite keeps everything in one file on one disk. Losing it loses every key envelope and shard: not acceptable for Keeplas. Postgres (managed, with backups and replicas) if self-hosting. | Partial |
| Mobile device     | SQLite encrypted with SQLCipher (op-sqlite)         | Local cache of ciphertext, offline capture outbox, search index. Values stay encrypted by @keeplas/crypto; SQLCipher adds a second layer.                                                 | Planned |
| Backups           | npx convex export on a schedule + storage snapshots | Export contains only ciphertext and public keys, so it is safe to store off-site. Test restores quarterly.                                                                                | Planned |

## What Convex sees

### Visible to Convex today

- Email and/or phone number, name, language, timezone
- Birthday and country of residence (legal info for succession)
- Item category, file names, MIME types, exact file sizes (F4)
- Trusted contacts' names, emails, phones, roles
- Item access level, status, triggers, recipients
- Life-check activity timestamps and channel attempts
- IP and country in audit logs (HMAC-verified)

### Encrypted on the client

- Item content, title (after backfill), links, attachments
- MasterKey (under RootKey), ML-KEM and ML-DSA secret keys (under MasterKey)
- Per-item DEKs (ML-KEM to owner and to each recipient)
- Shamir shares 1 to 3 (ML-KEM to each contact)
- Recovery submissions between contacts

### Never sent

- The 24-word phrase
- The RootKey and raw MasterKey
- Device unlock PIN
- Raw Shamir shares (except share 0, kept in plaintext on the device: F2)

## Algorithms

| Purpose             | Primitive                                        | Use                                                                                                                                       | Status  |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Content encryption  | AES-256-GCM (WebCrypto)                          | Per-item DEK encrypts content, title, links and attachments. encryptStream for large files.                                               | Built   |
| Root key derivation | Argon2id (hash-wasm)                             | 24 words + per-user public salt → RootKey. Slow on purpose against brute force. Also used for the salted phrase verifier.                 | Built   |
| Key encapsulation   | ML-KEM-768 (FIPS 203) + AES-256-GCM              | Wraps DEKs and Shamir shares to a person. Post-quantum; replaced RSA-OAEP. Envelope {v, alg, kem, iv, ct}.                                | Built   |
| Identity signatures | ML-DSA-65 (FIPS 204)                             | Each user signs their ML-KEM public key. Owners verify and pin the fingerprint before wrapping (TOFU), so Convex cannot substitute a key. | Built   |
| Threshold sharing   | Shamir over GF(256)                              | split(MasterKey, 4, threshold 2 or 3). See F1 and F2 for the problems with what is split and where share 0 lives.                         | Fix     |
| Device unlock       | WebAuthn PRF, PIN, hardware key                  | Each method wraps the RootKey locally in IndexedDB. 24 words required on first login per device.                                          | Built   |
| Audit integrity     | HMAC-SHA-256 context + hash chain                | Edge signs IP/country with KEEPLAS_CTX_SECRET; Convex re-verifies, then appends to the hash-chained audit_logs.                           | Built   |
| Owner recovery      | Shamir (separate Recovery Secret) + KMS gate key | Proposed construction for the 48 h recovery in the designs. Uses the same ML-KEM/AES-GCM primitives.                                      | Planned |

## Proposed owner-recovery construction

```
RS = random; split 2-of-3, ML-KEM to each trust contact
G  = random; under KMS, released by Convex after 48 h
K  = HKDF-SHA-256(RS || G, 'keeplas/social-envelope/v1')
socialEnvelope = AES-256-GCM(K, MasterKey)
```

## 0. Desktop visitor without an account: get the app [Planned]

Sign-up is mobile-only. A computer never creates an account: it sends the visitor to the app store, then waits to be linked by QR once the account exists on the phone.
Screens: W04-1, M08-1, M01-1, W04-2

1. user → web: Opens keeplas.com on a computer. W04-1 with two paths: 'Link with my phone' and 'New to Keeplas? Get the app'.
2. Show 'Get the app' screen. Store badges + a QR code to a smart link that opens the App Store or Google Play depending on the phone. No form, no phone field.
3. user → store: Scans QR, installs Keeplas. Optional deep link keeps a 'link this computer' intent for after sign-up.
4. app → cx: App Attest / Play Integrity token. Proves the request comes from the genuine app on a real device. Verified in a 'use node' action (attestation.verify).
5. app → cx: phone_auth OTP, intent signup. Accepted only with a valid attestation. Web clients can only request intent 'signin'.
6. Onboarding + key generation (workflow 1). 24 words, RootKey, MasterKey, ML-KEM / ML-DSA keys, all on the phone.
7. user → web: Back on the computer: Link with my phone. W04-2 shows the QR code.

> Then workflow 8: QR scan, approval, login token, MasterKey envelope
> Invitation links opened on a computer show the same screen: accept on your phone

## 1. Sign-up (mobile app only) and onboarding [Partial]

Target: sign-up exists only in the iOS / Android app, with the phone number. The steps below are built in the repo today, but on the web app and with an extra email + password option (F8). Moving them to the mobile app keeps the same Convex functions and crypto.
Screens: M08-1, M01-1, M01-2, M01-3, M01-4, M01-6

1. user → web: Phone number (or email + password). Phone path only, as in the designs. The email + password sign-up in the repo should be removed.
2. web → cx: phone_auth.requestPhoneAuthOtp. intent 'signup'. Target: rejected unless the request carries a valid App Attest (iOS) / Play Integrity (Android) token, so only the real app can create accounts. Codes hashed in phone_auth_codes.
3. cx → wa: 6-digit OTP template. Sent through Infobip.
4. web → cx: signIn('phone-otp', code). ConvexCredentials provider 'phone-otp' creates the user keyed by E.164 phone; authProviders = ['phone'].
   **Onboarding steps: legal_info → recovery_phrase → verification → key_generation**
5. web → cx: users.completeLegalInfo. Birthday (age ≥ 18) and country (inheritance jurisdiction), stored in plaintext by design.
6. Generate 24 words (BIP39). Shown once; the user re-types 3 words.
7. RootKey = Argon2id(phrase, salt). hash-wasm Argon2id. The phrase never leaves the browser.
8. MasterKey + ML-KEM + ML-DSA keys. MasterKey is AES-256. Secret keys are wrapped under it; the ML-KEM public key is signed with ML-DSA.
9. web → cx: storeKeyBundle + setPublicKey. encryptedKeyBundle = AES-GCM(RootKey, MasterKey); recoveryPhraseHash = salted Argon2id verifier. Welcome email and WhatsApp are scheduled.
10. split(MasterKey, 4, threshold). Share 0 goes to localStorage in plaintext (F2). Shares 1 to 3 wait for trust contacts.

> Convex holds ciphertext, public keys, a phrase verifier, legal info

## 2. Sign in on a new device with the 24 words [Partial]

Built today on the web. In the target design the 24 words are typed only in the mobile app (a new phone, or recovery); a computer is always linked by QR (workflow 8).
Screens: M08-6, M02-1

1. web → cx: Sign in (phone OTP, or password + email OTP). Authentication only. A password can be reset with the 24 words; it never decrypts anything.
2. web → cx: Step-up: login OTP / TOTP. requireFullAuth protects sensitive queries and mutations.
3. cx → web: encryptedKeyBundle + phraseSalt. Ciphertext plus the public Argon2id salt.
4. user → web: Types the 24 words. Required on the first login of each device. The designs replace this with QR linking (workflow 8, F6).
5. RootKey → open bundle → MasterKey. A wrong phrase fails the AES-GCM tag check.
6. web → idb: Enroll PIN / WebAuthn PRF / key. apps/web/src/lib/device-unlock/: each method stores its own wrap of the RootKey.

> Next sessions: PIN or biometrics unwrap the RootKey locally; idle auto-lock. The MasterKey stays extractable (needed for Shamir and rotation); idle lock and CSP are the mitigations.

## 3. Add an item with attachments [Built]

One key per item, wrapped for the owner and for each recipient. This is what makes scoped release possible.
Screens: M07-1, M07-2, M07-3, M07-4, M07-5

1. Random per-item DEK (AES-256). Sharing and release then hand over exactly one item.
2. Encrypt content, title, links. encryptedTitle replaced the plaintext title; a client backfill migrates old rows. Category stays plaintext (F4).
3. Wrap DEK to owner ML-KEM key. ownerWrappedDek. The owner reads it with their ML-KEM secret key, itself under the MasterKey.
4. Verify recipients' ML-DSA signature + pin. TOFU: if a contact's key changed or the signature fails, wrapping is blocked. Unverifiable contacts go to pendingRecipients and are rewrapped later.
5. Wrap DEK per recipient. vault_item_recipient_keys: one row per (item, contact). Recipients come from explicit choice, groups or the default group.
6. web → cx: vault_items.createItem (audited). auditedMutation verifies the HMAC request context and appends to the hash-chained audit log.
7. web → cx: generateUploadUrl. Short-lived Convex storage URL.
8. web → st: Upload AES-GCM file. encryptStream for large files; storage only sees ciphertext.
9. web → cx: addItemFiles (name, type, size, iv). File name, MIME type and exact size are plaintext today (F4).

## 4. Trust contacts and shard distribution [Built]

Up to 3 trust contacts each receive one Shamir share of the MasterKey, wrapped with their own ML-KEM key. Recipient-only contacts receive items but no share.
Screens: M06-1, M06-2, M06-3, M06-5

1. own → cx: inviteContact (email / WhatsApp). Roles: family, friend, lawyer, doctor, other; type trust or recipient_only.
2. con → cx: acceptInvitation + publish keys. The contact needs a Keeplas account to own a key pair.
3. cx → own: Contact pk + ML-DSA signature
4. Verify signature, pin fingerprint. pinContactIdentity; a later key change blocks wrapping until re-pinned.
5. split(MasterKey, 4, 2|3). Every distribution re-splits with a new polynomial and invalidates old shares. Refused below 2 contacts.
6. own → cx: storeEncryptedShard × up to 3. trusted_contacts.encryptedShard. Keeplas holds no share.
7. con → cx: /shared-with-me: unwrap + cache. Raw share cached in IndexedDB; lastVerifiedAt stamped. Re-derivable on any device from the contact's own 24 words.

> Weekly cron nudges contacts whose verification is stale. runAvailabilityReconfirm; the owner is told to replace unresponsive contacts.

## 5. Life check, confirmation, grace and release [Built]

Two stages before anything is released: the owner's own check-in (15 days), then confirmation by trust contacts (7 days), then a 72-hour grace the owner can cancel. Recipients get only their items.
Screens: M02-5, M02-6, W05-3, M03-3, M03-2, M08-2

1. Hourly: inactive ≥ threshold → cycle. life_check_evaluator cron. Weekly / monthly / quarterly = 7 / 30 / 90 days of inactivity. Travel mode and env kill switches pause it.
2. cx → own: Check-in: push, email, WhatsApp. Channels in the owner's order; reminders at J+3, J+7, J+10 via the Convex scheduler.

> Stage 1: 15 days; any activity or one tap validates. Login, navigation, a WhatsApp reply or the email link count as activity.

3. cx → c1: Stage 2: confirm unreachable?. enterConfirmationStage. Default threshold 2 contacts, window 7 days.
4. c1 → cx: markUserUnreachable. Audited mutation by a trust contact.
5. c2 → cx: markUserUnreachable. Quorum when contactsInitiated ≥ confirmationThreshold.
6. cx → own: Emergency access: 72 h to cancel. Owner alerted on every channel.

> Grace: cancelEmergencyAccess resets everything. If quorum is not reached in 7 days, the default fallback 'abort' releases nothing ('release_anyway' exists: F5).

7. fanOutRelease per recipient. releaseAfterConfirmation. 'private' items are excluded. Time-based items are released by an hourly cron.
8. ben → cx: memorial: my wrapped DEKs. getReleasedVaultForMe returns only items wrapped to this recipient.
9. Unwrap with own key, read. use-memorial-crypto.ts: no master-key reconstruction needed. This is the correct, scoped path.

## 6. Post-mortem master-key reconstruction (to remove) [Fix]

Exists today next to the scoped release. Contacts cross-wrap their shares to each other and any of them can rebuild the owner's MasterKey. See F1.

> After quorum + 72 h grace

1. c1 → cx: getRecoveryPeers. Other trust contacts and their public keys.
2. Unwrap own share; wrap to each peer. The raw share never reaches Convex.
3. c1 → cx: submitRecoveryShards. Rows in recovery_shard_submissions, one per (submitter, recipient).
4. c2 → cx: submitRecoveryShards
5. cx → c1: getRecoveryShardsForMe. Envelopes addressed to the caller.
6. reconstruct() → owner MasterKey. 'Reconstruct' button in shared-vault-card.tsx.

> F1: this key opens every item of the owner. rotation.ts treats the key as leaked if the owner comes back. Remove this path (Fix plan, step 1).

## 7. Owner recovery with trust contacts (designs M02) [Planned]

Proposed to close F3 with the repo's primitives. Contacts hold shares of a Recovery Secret (not the MasterKey). Convex holds a gate key under KMS and releases it only after the 48-hour window. Neither side can open anything alone.
Screens: M08-6, M02-1, M02-2, M02-3, M02-4, W04-5

1. new → cx: Phone OTP + new ML-KEM device key. Identification only: a phone code alone never unlocks the vault.
2. new → cx: recovery.start (48 h window). recovery_requests row; windowEndsAt = now + 48 h; a scheduled function is registered.
3. cx → old: Alert: recovery started. Cancel?. Push, WhatsApp, email. Cancelling destroys the request and its gate key.
4. cx → c1: Alex needs help. Neutral message, no vault content.
5. cx → c2: Alex needs help

> Code = 6 digits from hash(requestId, device pk). Each app computes the code locally. If Convex swapped the device key, codes differ. Designs show 4 digits; 6 is safer.

6. Call, compare code, tick box. Approve stays disabled until the box is ticked (M02-3).
7. c1 → cx: Share → device pk + ML-DSA sig. The contact's app unwraps its Recovery Secret share with its own ML-KEM key and re-wraps it to the new device key, signed with ML-DSA. The contact never sees the MasterKey.
8. c2 → cx: Same for Contact B. '1 of 2 approvals' on M02-2.

> Scheduler: release after 48 h unless cancelled. Convex scheduler; the '36 h left' bar.

9. cx → new: 2 shares + gate key G. A 'use node' action decrypts G with KMS and wraps it to the new device key, only if 2 valid signed approvals exist and nothing was cancelled.
10. RS = reconstruct; K = HKDF(RS ‖ G). On the new device only.
11. Open social envelope → MasterKey. socialEnvelope = AES-256-GCM(K, MasterKey), created at setup and after each rotation.
12. new → cx: Rotate RS + G; new 24 words. Fresh RS shares and G; the user is offered a new phrase. 'Protection renewed automatically' (M02-4).

## 8. Web sign-in by QR: key generation, authentication and key delivery [Planned]

How a new browser gets two things from the phone without a password or the 24 words: an authenticated Convex session, and the vault's secret key (MasterKey). The browser generates its own keys first; the phone encrypts the secret to them; Convex only relays ciphertext and a one-time login token.
Screens: W04-1, W04-2, M03-4, M03-5, M03-6, M08-4

**Browser: generate keys**

1. Ephemeral ML-KEM-768 keypair (eph). @noble/post-quantum, in memory only. Lives for this pairing (2 minutes) and is then erased.
2. Device wrap key DWK (non-extractable). WebCrypto AES-256-GCM key created with extractable: false and stored as a CryptoKey in IndexedDB. Scripts can use it but can never read its bytes, so an XSS cannot exfiltrate it.
3. web → cx: pairing.create(eph pk, user agent). Creates a pairing_sessions row (status waiting, expiresAt = now + 2 min) and returns sessionId. Rate-limited per IP.
4. QR = sessionId + SHA-256(eph pk) + origin. Countdown 01:42 on W04-2. The 16-byte hash binds the QR to the browser's key, so Convex cannot substitute its own key.
   **Phone: approve and send the secret**
5. app → cx: Scan → pairing.get(sessionId). Returns eph pk, user agent and approximate city. Requires the phone's full-auth session.
6. Check hash(eph pk) = QR hash. A mismatch aborts the pairing and raises a security alert.
7. Face ID / PRF → unlock MasterKey. Step-up biometrics: a locked phone cannot approve. M03-5 warns: approve only if this is your computer.
8. Envelope = ML-KEM(eph pk) + AES-GCM. Encapsulate to eph pk, HKDF the shared secret, then AES-256-GCM encrypt {MasterKey, userId, bundleVersion, issuedAt} with AAD = sessionId ‖ origin.
9. Sign envelope (ML-DSA identity key). Proves the envelope comes from a device holding the owner's identity key.
10. app → cx: pairing.approve(envelope, signature). Convex stores the envelope, creates a one-time login token (stores only its SHA-256 hash) and sets status approved.
    **Browser: authenticate, then receive the key**
11. cx → web: Live query: approved + login token. Convex reactive query, no polling. The token is single-use and valid 60 seconds.
12. web → cx: signIn('pairing', token). New ConvexCredentials provider 'pairing' consumes the token and opens a Convex Auth session for the same user. This is the web authentication: no password, no OTP.
13. cx → web: Envelope + signature (once). Served once to that authenticated session, then deleted (status consumed).
14. Verify signature; decapsulate → MasterKey. Signature checked against the user's identityPublicKey, then eph sk opens the envelope.
15. Trust this browser? wrap with DWK. Checked: MasterKey wrapped by DWK and kept in IndexedDB for next time. Unchecked: memory only, gone when the tab closes. eph sk is erased either way.
16. web → cx: devices.register + offer passkey. devices row (kind web, label, trusted). The browser then offers to create a passkey with PRF for later sign-ins (workflow 9).
17. cx → dev: Alert: new browser linked. Push + WhatsApp: 'Chrome on macOS, Paris'. Matches M03-6 ('your other devices have been notified') and M08-4.

## 9. Returning to the web app (passkey + PRF) [Partial]

Later visits on a trusted browser: one biometric gesture both signs in (WebAuthn) and unlocks the vault key (PRF). Passkey sign-in and PRF unlock exist in the repo; the DWK path comes with workflow 8.
Screens: W04-1, M08-6

1. user → web: Continue with passkey. W04-1.
2. web → cx: webauthn.startAuthentication. Challenge stored in webauthn_challenges with a short expiry.
3. credentials.get + PRF extension. One biometric gesture returns the assertion and a 32-byte PRF output derived from the passkey and a fixed salt.
4. web → cx: Verify assertion → session. consumeAuthenticationChallenge + recordSuccessfulAuthentication; a Convex Auth session is issued.
5. web → cx: Step-up when required. requireFullAuth (login OTP / TOTP) guards sensitive functions. Whether a passkey counts as full auth is a decision to take.
6. web → idb: Read this device's wrapped key. apps/web/src/lib/device-unlock/webauthn-prf.ts (built) or the DWK entry (planned).
7. HKDF(PRF) or DWK → unwrap. Built today for the RootKey. The MasterKey then comes from the bundle as in workflow 2.

> Idle auto-lock clears keys in memory; sign-out deletes the IndexedDB entries

## 10. Back up the vault key to iCloud or Google [Planned]

Optional, off by default. Two halves again: a random Cloud Backup Key (CBK) lives in the user's iCloud Keychain or Google Block Store, and the envelope it opens lives in Convex. Apple or Google alone, or Keeplas alone, cannot open anything.
Screens: M07-6, M08-3

**Turn on the toggle (M07-6)**

1. Random Cloud Backup Key CBK (256-bit). From the OS CSPRNG, on the phone.
2. cloudEnvelope = AES-GCM(CBK, RootKey). Wrapping the RootKey (not the MasterKey) keeps the backup valid after a master-key rotation. AAD = userId ‖ 'keeplas/cloud-backup/v1'.
3. app → os: Store CBK as a synced secret. iOS: Keychain item with kSecAttrSynchronizable, synced end-to-end by iCloud Keychain. Android: Block Store with shouldBackupToCloud, end-to-end encrypted when the device has a screen lock. Needs a small native module (expo-secure-store cannot sync).
4. app → cx: cloudBackup.save(envelope, provider). cloud_backup_envelopes row. Useless without CBK.
5. cx → dev: Alert: cloud backup turned on. Audit event + notification on every device.
   **Optional: encrypted copy of the data**
6. Pack ciphertext items + files. The same ciphertext Convex holds, in one archive with a manifest.
7. app → os: Save to iCloud Drive / Google Drive app folder. Lets the user restore even if Keeplas is unreachable. Unreadable without the RootKey.

> Turning the toggle off deletes CBK in the cloud and the envelope in Convex

## 11. Restore from iCloud or Google on a new phone [Planned]

The fastest recovery when the phone is lost but the Apple or Google account is not.
Screens: M02-1, M02-4

1. user → app: Same Apple / Google account; install Keeplas. The OS restores synced Keychain / Block Store items with the account and device passcode.
2. app → cx: Phone OTP sign-in. Identifies the account. Alone it unlocks nothing.
3. app → os: Read CBK. Present only on devices signed in to the same Apple ID / Google account.
4. app → cx: cloudBackup.get. Rate-limited and audited.
5. cx → dev: Alert: vault restored from iCloud backup. Every other device and WhatsApp. The owner can revoke the new device if it was not them.
6. Open envelope → RootKey → MasterKey. Then as in workflow 2.
7. Create passkey + device unlock. New devices row; recovery health refreshed.

> Risk: whoever controls the Apple / Google account and a device passcode can restore. Explain it on M07-6.

## 12. Recover with the 24-word kit [Built]

Works today: the 24 words are the root secret, so any device can rebuild the keys from them. Target: only in the mobile app; the web never asks for the phrase.
Screens: M02-1, M01-6

1. app → cx: Phone OTP (or email + password) sign-in. Authentication only.
2. cx → app: encryptedKeyBundle + phraseSalt. Ciphertext and a public salt.
3. user → app: Types the 24 words. parse-recovery-phrase.ts normalises spacing and case; the BIP39 checksum catches typos.
4. RootKey = Argon2id(words, salt). hash-wasm in the browser; a native Argon2id on mobile (Hermes has no WebAssembly).
5. Open bundle → MasterKey. Wrong words fail the AES-GCM tag.
6. cx → dev: Alert: phrase used on a new device. Not sent today: add it, like every other recovery path.

## 13. Recover from another signed-in device [Planned]

If one device is still signed in, it simply hands the key to the new one. Same protocol as workflow 8, with the new phone in the browser's role.
Screens: M02-1

1. Ephemeral ML-KEM keypair + QR or code. On a phone, the QR is shown on the new device and scanned by the old one (or a 6-digit code is typed).
2. new → cx: pairing.create
3. old → cx: pairing.get + check key hash
4. Biometrics; seal MasterKey; sign
5. old → cx: pairing.approve
6. cx → new: Login token, then envelope. Same one-time token and single-read envelope as workflow 8.
7. Open → MasterKey; enrol device unlock

## State machine: Life-check cycle (life_check_cycles.status) [Built]

| From                  | Event                                         | To                    | Notes                           |
| --------------------- | --------------------------------------------- | --------------------- | ------------------------------- |
| running               | owner activity or tap                         | validated             | next cycle scheduled            |
| running               | 15 days without answer (reminders J+3, 7, 10) | awaiting_confirmation | enterConfirmationStage          |
| awaiting_confirmation | quorum of contacts (default 2)                | triggered             | 72 h grace, then release        |
| awaiting_confirmation | 7 days, no quorum, fallback 'abort'           | cancelled             | nothing released                |
| awaiting_confirmation | 7 days, no quorum, fallback 'release_anyway'  | triggered             | F5: remove                      |
| any                   | owner cancels / travel mode / config off      | cancelled             | scheduled escalations cancelled |

## State machine: Access request (access_requests.status) [Built]

| From     | Event                                                       | To                    | Notes                           |
| -------- | ----------------------------------------------------------- | --------------------- | ------------------------------- |
| pending  | quorum + grace elapsed (Mode A) or owner approves (Mode B1) | approved              | per-recipient sections          |
| pending  | owner denies                                                | denied                |                                 |
| pending  | autoResponseAt reached                                      | auto_denied / expired |                                 |
| approved | owner revokes after return                                  | revoked               | revokeReleasedAccess + rotation |

## State machine: Owner recovery request (proposed) [Planned]

| From       | Event                                 | To         | Notes                          |
| ---------- | ------------------------------------- | ---------- | ------------------------------ |
| pending    | first signed approval with valid code | approved_1 |                                |
| approved_1 | second distinct contact               | approved_2 |                                |
| approved_2 | 48 h elapsed, not cancelled           | released   | gate key wrapped to new device |
| released   | new device rotates RS and G           | rotated    | terminal                       |
| any        | owner cancels from any device         | cancelled  | gate key destroyed             |
| pending    | 7 days without 2 approvals            | expired    |                                |

## State machine: Pairing session (proposed) [Planned]

| From               | Event                                            | To       | Notes                                    |
| ------------------ | ------------------------------------------------ | -------- | ---------------------------------------- |
| waiting            | phone approves with a valid key hash             | approved | envelope + token hash stored             |
| approved           | browser redeems the token and reads the envelope | consumed | envelope deleted                         |
| waiting / approved | 2 minutes elapsed                                | expired  | row purged                               |
| waiting            | phone rejects                                    | rejected | security alert if the hash did not match |

## State machine: Cloud backup (proposed) [Planned]

| From | Event                                 | To       | Notes                    |
| ---- | ------------------------------------- | -------- | ------------------------ |
| off  | toggle on, CBK saved, envelope stored | on       |                          |
| on   | toggle off                            | off      | CBK and envelope deleted |
| on   | restored on a new phone               | restored | alerts sent; stays on    |

## Database tables

### Identity and auth

- `users`: Profile, auth providers, key bundle, public keys, legal info, plan (mixed)
- `passkey_credentials`: WebAuthn credentials (public)
- `webauthn_challenges`: Pending challenges (plain)
- `totp_secrets`: TOTP enrollment (plain)
- `auth_session_totp / auth_session_login_otp`: Step-up state per session (plain)
- `login_otp_codes, phone_auth_codes, phone_verification_codes, email_*_codes`: One-time codes (plain)
- `ip_rate_limits`: Throttling (plain)

### Vault

- `vaults`: One per user; counters (plain)
- `vault_items`: Encrypted content/title/links, ownerWrappedDek, category, access level, triggers (mixed)
- `vault_item_files`: Attachment storage id, iv, name, MIME type, size (mixed)
- `vault_item_recipient_keys`: DEK wrapped per (item, contact) (cipher)
- `recipient_groups`: Named groups of contacts (plain)

### People and release

- `trusted_contacts`: Invitation, role, type, keys, pinned fingerprint, encryptedShard (mixed)
- `access_requests`: Release and emergency requests, quorum, grace (plain)
- `recovery_shard_submissions`: Cross-wrapped shares between contacts (F1: to remove) (cipher)

### Life check

- `life_check_configs`: Frequency, channels, travel mode, release policy (plain)
- `life_check_cycles`: Cycle state and channel attempts (plain)
- `push_subscriptions`: Web Push endpoints (plain)

### Operations

- `audit_logs`: Hash-chained, immutable (plain)
- `notifications`: In-app notifications (plain)
- `support_tickets`: Support (plain)
- `analytics_events`: Page views (no vault data) (plain)
- `payments`: Stripe sessions (plain)

## API (existing)

- **Auth**: phone_auth.requestPhoneAuthOtp · webauthn.start/finishRegistration · webauthn.startAuthentication · login_otp.* · totp.* · phone_verification.requestVerification/verifyCode
- **Onboarding and keys**: onboarding.getOnboardingState · advanceOnboardingStep · storeRecoveryPhraseHash · storeKeyBundle · users.setPublicKey · users.completeLegalInfo
- **Vault**: vault_items.createItem · updateItem · deleteItem · getItems · getItem · getCategoryCounts · generateUploadUrl · addItemFiles · removeItemFile · addRecipientKeys · getItemsNeedingRewrap · backfillItemTitle
- **Contacts and groups**: trusted_contacts.inviteContact · acceptInvitation · declineInvitation · revokeContact · storeEncryptedShard · confirmShardVerified · pinContactIdentity · repinContactIdentity · getDistributionTargets · recipient_groups.*
- **Life check**: life_check.saveConfig · toggleTravelMode · validateCycle · postponeCycle · getActiveCycle · saveReleasePolicy · validateFromWhatsApp · confirmFromEmailToken; internal: evaluateAllConfigs · enterConfirmationStage · resolveConfirmationWindow · releaseAfterConfirmation
- **Release**: access_requests.markUserUnreachable · cancelEmergencyAccess · revokeReleasedAccess · memorial.getReleasedVaultForMe · getReleasedItemForMe · getMemorialItemFiles · release.getReleasePreview
- **To remove (F1)**: access_requests.getRecoveryPeers · submitRecoveryShards · getRecoveryShardsForMe · getRecoverySubmissionCount
- **Rotation**: rotation.rotateKeyMaterial · finalizeRotation · getRotatableItems · getItemRecipients
- **Other**: notifications.* · push_subscriptions.* · hub.getHubData · billing.createCheckoutSession · support.* · analytics

## API (planned)

- `attestation.verify` (internalAction ('use node')): Checks an App Attest (iOS) / Play Integrity (Android) token before a sign-up OTP is sent
- `phone_auth.requestPhoneAuthOtp (change)` (mutation): intent 'signup' refused without a verified attestation; web clients can only use intent 'signin'
- `Password provider (change)` (auth.ts): signUp flow disabled; existing email accounts keep signing in until migrated
- `recovery.start` (mutation): New device opens a request; schedules release at +48 h
- `recovery.getStatus` (query): Approvals, time left (live)
- `recovery.approve / reject` (mutation): Contact posts wrapped share + ML-DSA signature
- `recovery.cancel` (mutation): Any owner device; destroys G
- `recovery.release` (internalAction ('use node')): KMS-decrypts G, wraps to the device key
- `recovery.rotate` (mutation): New RS shares, envelope, G
- `devices.list / revoke / notMe` (query / mutation): Designs W04-6, M08-4
- `pairing.create / get / approve / reject` (mutation / query): QR handoff (W8, W13)
- `auth provider 'pairing'` (ConvexCredentials): Consumes the one-time login token
- `pairing.readEnvelope` (mutation): Single read of the MasterKey envelope by the new session
- `devices.register / list / revoke / notMe` (mutation / query): Designs W04-6, M07-6, M08-4
- `cloudBackup.save / get / disable` (mutation): W10, W11

## Findings

### F1 · Contacts rebuild the owner's whole MasterKey after a release (Critical)

After quorum and the 72 h grace, any trust contact can press 'Reconstruct' and get the owner's MasterKey in memory. Cryptographically, that key opens the owner's ML-KEM secret key and therefore every item, including 'private' items and items meant for other people. The current API does not serve those ciphertexts to contacts, so the protection rests on server access control, not on encryption: exactly what zero-access is meant to avoid. rotation.ts already treats the key as 'leaked'. This contradicts the screen 'Cannot read your files' and the strategy rule 'no broad master-key grant'.

Where: `apps/web/src/app/(dashboard)/shared-with-me/use-recovery-flow.ts`, `shared-vault-card.tsx`, `packages/convex/access_requests.ts (submitRecoveryShards, getRecoveryShardsForMe)`

Fix: Remove master-key reconstruction from the succession path. The memorial path already releases only the items wrapped to each recipient (use-memorial-crypto.ts), so nothing is lost. Keep Shamir only for owner recovery (workflow 7), on a separate secret.

### F2 · Share 0 is stored in plaintext in localStorage (Critical)

split() creates 4 shares; share 0 is written to localStorage on the owner's device. With threshold 2, share 0 plus one contact's share rebuilds the MasterKey. Someone with that browser profile, or an XSS bug, plus a single cooperating contact defeats the 2-person rule.

Where: `onboarding/steps/key-generation-step.tsx:135`, `apps/web/src/lib/use-distribute-shards.ts`, `apps/web/src/lib/storage-keys.ts (deviceShard)`

Fix: Split into 3 shares for the 3 contact slots only, re-distribute for every existing user, then delete the localStorage key. The owner never needs a share: they have the 24 words and device unlock.

### F3 · No owner recovery (High)

Recovery only exists after a death confirmation. An owner who loses the 24 words and every unlocked device is locked out, although the designs (M02-1 to M02-4, W04-5) promise recovery through trust contacts within 48 h.

Where: `(missing) packages/convex/recovery.ts`, `(missing) designs M02-1 → M02-4`

Fix: Implement workflow 7: Recovery Secret split among contacts + server gate key released after 48 h + code comparison.

### F4 · Sensitive metadata in plaintext (High)

vault_items.category, vault_item_files.name / mimeType / size, and legacy vault_items.title. A file named 'Will_2026.pdf' in category 'financial_asset' already says a lot.

Where: `packages/convex/schema.ts (vault_items, vault_item_files)`

Fix: Add an encryptedMeta field (same DEK envelope), backfill client-side like titles, then drop the plaintext columns. Pad sizes to buckets. Category counts for the dashboard can be computed on the client.

### F5 · 'release_anyway' fallback (Medium)

life_check_configs.fallbackBehavior can be 'release_anyway': if contacts don't confirm, items are released on silence. The strategy says a failed life check alone must never cause disclosure.

Where: `packages/convex/life_check.ts (resolveConfirmationWindow, saveReleasePolicy)`, `schema.ts`

Fix: Remove the option, or allow it only with explicit owner consent, a long delay and repeated warnings.

### F6 · 24 words required on every new device (Medium)

Each new browser asks for the phrase. The designs make the kit optional and link computers from the phone by QR (W04-2, M03-4 to M03-6).

Where: `apps/web/src/lib/master-key-store.ts`, `device-unlock/`

Fix: Implement workflow 8 (QR pairing) and remove phrase entry from the web entirely. The phrase becomes a backup used only in the mobile app.

### F8 · Sign-up still exists on the web (High)

Product rule: sign-up is mobile-only and a computer is only linked by QR. The repo has a web sign-up (email + password and phone), a web onboarding that generates the keys in the browser, and a web invitation page where contacts create their account.

Where: `apps/web/src/routes/_auth/signup/index.tsx`, `apps/web/src/app/(auth)/signup/`, `apps/web/src/app/(onboarding)/onboarding/onboarding-flow.tsx`, `apps/web/src/app/invite/[token]/page.tsx`, `packages/convex/auth.ts (Password signUp, phone-otp intent 'signup')`

Fix: Web: remove the sign-up and onboarding routes, show the 'Get the app' screen to visitors without an account, and send invitation links to the app (deep link / store). Convex: disable Password sign-up, and accept phone-otp intent 'signup' only with a verified App Attest / Play Integrity token (workflow 0). Keep the onboarding code for the Expo app.

### F7 · Docs and product copy drift (Low)

PRD and older notes say Shamir 3-of-5 and Noir/Barretenberg; code has 4 shares (3 contacts), threshold 2 or 3, and no ZK proofs. Pricing says '5 emergency contacts' but only 3 can hold shards.

Where: `PRD/*.md`, `README.md (Pricing)`

Fix: Align the PRD with the code; say 'up to 5 recipients, 3 of them recovery contacts'.

## Acceptance criteria

| Criterion                                        | Status  | Comment                                                                             |
| ------------------------------------------------ | ------- | ----------------------------------------------------------------------------------- |
| Promise understandable without crypto terms      | Partial | New designs do it; current web copy is more technical ('shards', 'quorum').         |
| First item without choosing a vault structure    | Partial | A category is chosen at creation. Designs propose an encrypted inbox.               |
| Accounts can only be created from the mobile app | Missing | Web sign-up exists (F8). Needs App Attest / Play Integrity on sign-up.              |
| Operators cannot decrypt from backend data alone | Met     | Content yes. Metadata leaks remain (F4).                                            |
| Password reset cannot bypass encryption          | Met     | Password is pure auth; MasterKey is under the phrase-derived RootKey.               |
| Recovery and succession are independent          | Missing | One Shamir secret (the MasterKey) serves the only path; no owner recovery (F1, F3). |
| One contact cannot recover alone                 | Partial | True between contacts, broken by share 0 (F2).                                      |
| A missed life check never causes disclosure      | Partial | Default 'abort' is right; 'release_anyway' breaks it (F5).                          |
| Beneficiaries cannot reach unassigned items      | Partial | Memorial path is scoped; master-key reconstruction is not (F1).                     |
| Security actions logged without secrets          | Met     | auditedMutation + HMAC context + hash chain.                                        |
| Classification can be disabled                   | n/a     | No AI classification yet.                                                           |
| iCloud / Google backups hold only ciphertext     | Missing | No cloud backup feature.                                                            |
| Several beneficiaries for one document           | Met     | One wrapped DEK per (item, contact).                                                |

## Fix plan

### Step 1: Stop the leaks (F2 then F1)

- Split into 3 contact shares, migrate users, delete keeplas_device_shard
- Remove 'Reconstruct' and the post-mortem shard submission path; keep memorial
- Remove or gate 'release_anyway' (F5)

### Step 2: Owner recovery (F3)

- @keeplas/crypto: recovery/social.ts (HKDF, social envelope, 6-digit code)
- Convex: recovery.ts + tables recovery_requests, recovery_approvals, gate_keys; 'use node' action calling KMS
- UI: screens M02-1 to M02-4 and W04-5

### Step 3: Mobile-only sign-up and QR linking (F6, F8)

- Convex: pairing.ts + pairing_sessions (2 min TTL), auth provider 'pairing'
- Convex: App Attest / Play Integrity check on phone-otp sign-up; disable Password sign-up
- Web: remove sign-up, onboarding and phrase entry; add the 'Get the app' screen; invite links open the app
- Web: QR screen W04-2; phone flow M03-4 to M03-6; alert every device (M08-4)

### Step 4: Metadata (F4)

- encryptedMeta on items and files, client backfill, drop plaintext columns
- Size buckets

### Step 5: Mobile app (Designs)

- apps/mobile with Expo, sharing @keeplas/crypto; sign-up and onboarding move here (F8)
- Hermes has no WebAssembly and no WebCrypto: use react-native-quick-crypto for AES-GCM and a native Argon2id; @noble libraries are pure JS and work as is
- Local SQLite (SQLCipher) for cache and offline outbox
- Passkeys via react-native-passkey; biometric unlock with expo-secure-store / Keychain

### Step 6: Design system (Product)

- Pick one: repo 'Digital Curator' (Manrope, #041632) or the new designs (serif + navy)
- Then regenerate tokens in @keeplas/ui

## Recovery methods

| Method                   | Needs                                         | Convex releases                   | Delay     | Alerts                          | Status  | Workflow |
| ------------------------ | --------------------------------------------- | --------------------------------- | --------- | ------------------------------- | ------- | -------- |
| Another signed-in device | That device, unlocked with biometrics         | Envelope sealed by the old device | Immediate | All devices                     | Planned | W13      |
| 24-word kit              | The 24 words                                  | Key bundle (ciphertext)           | Immediate | To add                          | Built   | W12      |
| iCloud / Google backup   | Same Apple / Google account + device passcode | Cloud envelope                    | Immediate | All devices, WhatsApp           | Planned | W11      |
| Trust contacts           | 2 of 3 contacts approve + code check by call  | Gate key G after 48 h             | 48 h      | All devices, WhatsApp, contacts | Planned | W7       |

## Database (all tables)

### `users`

| Field                                                                                                                | Type                     | Privacy             | Notes                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`                                                                                                              | string (optional)        | plaintext           |                                                                                                                                                                                                          |
| `name`                                                                                                               | string (optional)        | plaintext           |                                                                                                                                                                                                          |
| `avatarUrl`                                                                                                          | string (optional)        | plaintext           |                                                                                                                                                                                                          |
| `avatarStorageId`                                                                                                    | id → _storage (optional) | plaintext           | Convex storage handle for an uploaded avatar image. Tracked so the previous blob can be deleted when the avatar is replaced or the account is wiped; `avatarUrl` holds the resolved serving URL used for |
| `phoneNumber`                                                                                                        | string (optional)        | plaintext           |                                                                                                                                                                                                          |
| `timezone`                                                                                                           | string (optional)        | plaintext           |                                                                                                                                                                                                          |
| `language`                                                                                                           | string (optional)        | plaintext           |                                                                                                                                                                                                          |
| `authProviders`                                                                                                      | array of enum passkey    | email               | phone                                                                                                                                                                                                    | totp (optional)                                                                                                                                                                                          | plaintext      | Auth methods available on this account. Seeded with the sign-up method ("email" for password/email-OTP accounts, "phone" for phone-OTP) by the `afterUserCreatedOrUpdated` callback in auth.ts; "passkey |
| `publicKey`                                                                                                          | string (optional)        | public              | Crypto fields, populated during onboarding (Phase 2) Base64-serialized ML-KEM-768 public key (FIPS 203). Used by other users to wrap per-recipient DEKs and shards for this user.                        |
| `encryptedKeyBundle`                                                                                                 | string (optional)        | ciphertext          | JSON envelope { version, phraseSalt, iv, encryptedMasterKey }. The MasterKey is wrapped client-side by a RootKey derived from the user's 24-word phrase via Argon2id; the server never sees plaintext ke |
| `encryptedAsymmetricSecretKey`                                                                                       | string (optional)        | ciphertext          | JSON { ciphertext, iv }, the user's ML-KEM-768 secret key, AES-GCM wrapped client-side under their MasterKey. Stored separately from `encryptedKeyBundle` to avoid overwriting the MasterKey bundle.     |
| `encryptedAsymmetricSecretKeyPrev`                                                                                   | string (optional)        | ciphertext          | Transitional only, set during a master-key rotation (return-after-release flow). The PREVIOUS owner ML-KEM secret key, re-wrapped under the NEW MasterKey, so items still wrapped to the old keypair st  |
| `identityPublicKey`                                                                                                  | string (optional)        | public              | Identity key (finding #2, malicious-server key substitution). Base64 ML-DSA-65 public key (FIPS 204). The long-lived signing key that binds this user's ML-KEM public key to their identity so contacts  |
| `encryptedIdentitySecretKey`                                                                                         | string (optional)        | ciphertext          | JSON { ciphertext, iv }, the user's ML-DSA-65 secret key, AES-GCM wrapped client-side under their MasterKey, mirroring `encryptedAsymmetricSecretKey`. The raw identity secret key never reaches the se  |
| `publicKeySignature`                                                                                                 | string (optional)        | public              | Base64 ML-DSA-65 signature over this user's ML-KEM public-key bytes, produced with the identity secret key. Binds `publicKey` to `identityPublicKey`; step 2 verifies it before wrapping to this user.   |
| `phraseSalt`                                                                                                         | string (optional)        | hash / salt         | Per-user salt for Argon2id derivation of the RootKey. Public, served alongside the bundle so the client can re-derive the RootKey on login.                                                              |
| `recoveryPhraseHash`                                                                                                 | string (optional)        | hash / salt         |                                                                                                                                                                                                          |
| `recoveryVerified`                                                                                                   | boolean (optional)       | plaintext           |                                                                                                                                                                                                          |
| `vaultThreshold`                                                                                                     | number (optional)        | plaintext           | Shamir threshold chosen at onboarding: how many trusted contacts must collaborate to reconstruct the MasterKey. Min 2, max 3 (only the 3 contact shards participate in contacts-only recovery). Once sha |
| `totpResetVerifierHash`                                                                                              | string (optional)        | hash / salt         | SHA-256 hex of a PBKDF2 verifier derived from the recovery phrase with a TOTP-specific salt. Set when the user opts in to seed-based 2FA reset.                                                          |
| `birthday`                                                                                                           | number (optional)        | plaintext           | Legal identity, collected during onboarding for succession admissibility. birthday: Unix ms of birth date; used for age verification (>=18) and identification in succession proceedings.                |
| `country`                                                                                                            | string (optional)        | plaintext           | country: ISO-3166-1 alpha-2 code of declared residence at signup; determines applicable inheritance jurisdiction.                                                                                        |
| `legalInfoConfirmedAt`                                                                                               | number (optional)        | plaintext           | Timestamp when the user confirmed their legal info, proof of consent.                                                                                                                                    |
| `onboardingStep`                                                                                                     | enum auth_complete       | legal_info          | recovery_phrase                                                                                                                                                                                          | verification                                                                                                                                                                                             | key_generation | complete (optional)                                                                                                                                                                                      | plaintext |     |
| `welcomeSentAt`                                                                                                      | number (optional)        | plaintext           | Timestamp (ms) at which the post-onboarding welcome message (email + WhatsApp) was scheduled. Set once in `storeKeyBundle`; its presence is the idempotency guard that stops a second `storeKeyBundle` f |
| `updatedAt`                                                                                                          | number (optional)        | plaintext           | No `createdAt`, Convex stamps `_creationTime` on every document; use it.                                                                                                                                 |
| `lastSeenAt`                                                                                                         | number (optional)        | plaintext           |                                                                                                                                                                                                          |
| `emailVerificationTime`                                                                                              | number (optional)        | plaintext           | Set by @convex-dev/auth after a successful email OTP verification.                                                                                                                                       |
| `phoneNumberVerifiedAt`                                                                                              | number (optional)        | plaintext           | Timestamp (ms) at which the user verified ownership of their WhatsApp number via a 6-digit OTP delivered through the WhatsApp Business API. Cleared if the phone number is changed afterward.            |
| `plan`                                                                                                               | enum free                | lifetime (optional) | plaintext                                                                                                                                                                                                | Billing tier. Absent = "free". Flipped to "lifetime" only by the Stripe webhook (`billing.fulfillCheckout`) after a successful one-time payment; never set client-side. Drives the storage quota (see li |
| `stripeCustomerId`                                                                                                   | string (optional)        | plaintext           | Stripe Customer id captured from the completed Checkout session, kept so future receipts / the customer portal can reuse the same customer.                                                              |
| `role`                                                                                                               | enum user                | admin (optional)    | plaintext                                                                                                                                                                                                | Back-office role. Absent = a normal product user. "admin" grants access to the keeplas-admin analytics console (gated server-side by `requireAdmin`). Never set client-side, assigned out-of-band.       |
| Indexes: `email`(email), `by_last_seen`(lastSeenAt), `by_phone`(phoneNumber), `by_stripe_customer`(stripeCustomerId) |

### `payments`

| Field                                                     | Type              | Privacy   | Notes     |
| --------------------------------------------------------- | ----------------- | --------- | --------- |
| `userId`                                                  | id → users        | plaintext |           |
| `stripeSessionId`                                         | string            | plaintext |           |
| `stripePaymentIntentId`                                   | string (optional) | plaintext |           |
| `amountCents`                                             | number            | plaintext |           |
| `currency`                                                | string            | plaintext |           |
| `plan`                                                    | enum free         | lifetime  | plaintext |     |
| `status`                                                  | literal "paid"    | plaintext |           |
| `createdAt`                                               | number            | plaintext |           |
| Indexes: `by_session`(stripeSessionId), `by_user`(userId) |

### `phone_verification_codes`

| Field                                                           | Type       | Privacy     | Notes                                                                                                    |
| --------------------------------------------------------------- | ---------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `userId`                                                        | id → users | plaintext   |                                                                                                          |
| `phoneNumber`                                                   | string     | plaintext   | E.164 snapshot at time of issuance, invalidates the code if the user changes phone before submitting it. |
| `codeHash`                                                      | string     | hash / salt | SHA-256 hex of the 6-digit OTP. Plaintext is never stored.                                               |
| `expiresAt`                                                     | number     | plaintext   |                                                                                                          |
| `attempts`                                                      | number     | plaintext   |                                                                                                          |
| Indexes: `by_user`(userId), `by_user_expires`(userId,expiresAt) |

### `phone_auth_codes`

| Field                            | Type        | Privacy     | Notes     |
| -------------------------------- | ----------- | ----------- | --------- |
| `phoneNumber`                    | string      | plaintext   |           |
| `codeHash`                       | string      | hash / salt |           |
| `expiresAt`                      | number      | plaintext   |           |
| `attempts`                       | number      | plaintext   |           |
| `intent`                         | enum signup | signin      | plaintext |     |
| Indexes: `by_phone`(phoneNumber) |

### `email_verification_codes`

| Field                                                           | Type       | Privacy     | Notes                                                                                                                    |
| --------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `userId`                                                        | id → users | plaintext   |                                                                                                                          |
| `email`                                                         | string     | plaintext   | Normalized (lowercased) email snapshot at issuance, invalidates the code if the pending email changes before submission. |
| `codeHash`                                                      | string     | hash / salt | SHA-256 hex of the 6-digit OTP. Plaintext is never stored.                                                               |
| `expiresAt`                                                     | number     | plaintext   |                                                                                                                          |
| `attempts`                                                      | number     | plaintext   |                                                                                                                          |
| Indexes: `by_user`(userId), `by_user_expires`(userId,expiresAt) |

### `email_auth_codes`

| Field                      | Type        | Privacy     | Notes     |
| -------------------------- | ----------- | ----------- | --------- |
| `email`                    | string      | plaintext   |           |
| `codeHash`                 | string      | hash / salt |           |
| `expiresAt`                | number      | plaintext   |           |
| `attempts`                 | number      | plaintext   |           |
| `intent`                   | enum signup | signin      | plaintext |     |
| Indexes: `by_email`(email) |

### `passkey_credentials`

| Field                                                        | Type                       | Privacy                | Notes     |
| ------------------------------------------------------------ | -------------------------- | ---------------------- | --------- |
| `userId`                                                     | id → users                 | plaintext              |           |
| `credentialId`                                               | string                     | plaintext              |           |
| `publicKey`                                                  | string                     | public                 |           |
| `counter`                                                    | number                     | plaintext              |           |
| `transports`                                                 | array of string (optional) | plaintext              |           |
| `deviceName`                                                 | string                     | plaintext              |           |
| `backedUp`                                                   | boolean (optional)         | plaintext              |           |
| `deviceType`                                                 | enum singleDevice          | multiDevice (optional) | plaintext |     |
| `createdAt`                                                  | number                     | plaintext              |           |
| `lastUsedAt`                                                 | number                     | plaintext              |           |
| Indexes: `by_user`(userId), `by_credential_id`(credentialId) |

### `webauthn_challenges`

| Field                                                      | Type                  | Privacy        | Notes     |
| ---------------------------------------------------------- | --------------------- | -------------- | --------- |
| `challenge`                                                | string                | secret         |           |
| `kind`                                                     | enum registration     | authentication | plaintext |     |
| `userId`                                                   | id → users (optional) | plaintext      |           |
| `email`                                                    | string (optional)     | plaintext      |           |
| `expiresAt`                                                | number                | plaintext      |           |
| Indexes: `by_challenge`(challenge), `by_expiry`(expiresAt) |

### `totp_secrets`

| Field                      | Type              | Privacy       | Notes                                                                                                                                                                                                   |
| -------------------------- | ----------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                   | id → users        | plaintext     |                                                                                                                                                                                                         |
| `secret`                   | string            | server secret | Base32-encoded 20-byte HMAC-SHA1 secret. Stored server-side so we can verify codes; treated as a high-value credential alongside password hashes. Must never leave the backend after enrollment. DELIBE |
| `label`                    | string (optional) | plaintext     |                                                                                                                                                                                                         |
| `verifiedAt`               | number (optional) | plaintext     | Set when the user has confirmed enrollment by entering a valid code. Rows without verifiedAt are pending enrollments and may be replaced.                                                               |
| `lastUsedAt`               | number (optional) | plaintext     |                                                                                                                                                                                                         |
| `createdAt`                | number            | plaintext     |                                                                                                                                                                                                         |
| Indexes: `by_user`(userId) |

### `auth_session_totp`

| Field                                               | Type              | Privacy   | Notes |
| --------------------------------------------------- | ----------------- | --------- | ----- |
| `sessionId`                                         | id → authSessions | plaintext |       |
| `userId`                                            | id → users        | plaintext |       |
| `verifiedAt`                                        | number            | plaintext |       |
| Indexes: `by_session`(sessionId), `by_user`(userId) |

### `login_otp_codes`

| Field                                                           | Type       | Privacy     | Notes                                                                                                                          |
| --------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `userId`                                                        | id → users | plaintext   |                                                                                                                                |
| `channel`                                                       | enum email | whatsapp    | plaintext                                                                                                                      |     |
| `destination`                                                   | string     | plaintext   | Email address or E.164 phone snapshot at issuance, invalidates the code if the destination changes before the user submits it. |
| `codeHash`                                                      | string     | hash / salt | SHA-256 hex of the 6-digit OTP. Plaintext is never stored.                                                                     |
| `expiresAt`                                                     | number     | plaintext   |                                                                                                                                |
| `attempts`                                                      | number     | plaintext   |                                                                                                                                |
| Indexes: `by_user`(userId), `by_user_expires`(userId,expiresAt) |

### `ip_rate_limits`

| Field                  | Type   | Privacy   | Notes |
| ---------------------- | ------ | --------- | ----- |
| `key`                  | string | plaintext |       |
| `createdAt`            | number | plaintext |       |
| Indexes: `by_key`(key) |

### `auth_session_login_otp`

| Field                                               | Type              | Privacy   | Notes |
| --------------------------------------------------- | ----------------- | --------- | ----- |
| `sessionId`                                         | id → authSessions | plaintext |       |
| `userId`                                            | id → users        | plaintext |       |
| `verifiedAt`                                        | number            | plaintext |       |
| Indexes: `by_session`(sessionId), `by_user`(userId) |

### `vaults`

| Field                      | Type       | Privacy    | Notes                                                                                                                                      |
| -------------------------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `userId`                   | id → users | plaintext  |                                                                                                                                            |
| `encryptedItemsCount`      | number     | ciphertext |                                                                                                                                            |
| `lastVerifiedAt`           | number     | plaintext  | Stamped on creation and refreshed when a trusted contact verifies their shard; read by the recipient UI to show a "Verified Xm ago" badge. |
| `createdAt`                | number     | plaintext  |                                                                                                                                            |
| `updatedAt`                | number     | plaintext  |                                                                                                                                            |
| Indexes: `by_user`(userId) |

### `vault_items`

| Field                                                                                                                                           | Type                                      | Privacy         | Notes                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vaultId`                                                                                                                                       | id → vaults                               | plaintext       |                                                                                                                                                                                                          |
| `userId`                                                                                                                                        | id → users                                | plaintext       |                                                                                                                                                                                                          |
| `category`                                                                                                                                      | enum personal_document                    | financial_asset | digital_asset                                                                                                                                                                                            | health_directive | legal_document | business_continuity | conditional_message | credential | property | insurance_policy | subscription | contacts | wishes | other | plaintext |     |
| `title`                                                                                                                                         | string (optional)                         | plaintext       | Legacy plaintext title. Kept optional only to read rows not yet migrated to `encryptedTitle`; new writes never set it. Removed once the client-side backfill has converged (see vault_items.backfillItem |
| `encryptedTitle`                                                                                                                                | string (optional)                         | ciphertext      | Encrypted item title, same per-item DEK + JSON {ciphertext, iv} envelope as `encryptedContent`. Under the owner/recipient-wrapped DEK for ZK items, under the master key for legacy `aes_256_gcm` items  |
| `encryptedContent`                                                                                                                              | string                                    | ciphertext      |                                                                                                                                                                                                          |
| `encryptedLinks`                                                                                                                                | string (optional)                         | ciphertext      | Optional encrypted JSON array of URLs attached to this item. Encrypted with the same per-item DEK as encryptedContent, payload is a self contained JSON envelope (ciphertext + iv) just like encryptedC  |
| `encryptionType`                                                                                                                                | enum aes_256_gcm                          | zero_knowledge  | plaintext                                                                                                                                                                                                |                  |
| `sharedWithContacts`                                                                                                                            | array of id → trusted_contacts            | plaintext       |                                                                                                                                                                                                          |
| `sharedWithGroups`                                                                                                                              | array of id → recipient_groups (optional) | plaintext       |                                                                                                                                                                                                          |
| `pendingRecipients`                                                                                                                             | array of id → trusted_contacts (optional) | plaintext       | Contacts the owner intended to share with at save time but whose encryption key wasn't yet publishable (`unverifiable`): no wrapped DEK row exists for them. The owner's client re-wraps the DEK to each |
| `recipientMode`                                                                                                                                 | enum default                              | groups          | explicit (optional)                                                                                                                                                                                      | plaintext        |                |
| `ownerWrappedDek`                                                                                                                               | string (optional)                         | ciphertext      | ML-KEM-768 + AES-GCM envelope (JSON: {v, alg, kem, iv, ct}).                                                                                                                                             |
| `accessLevel`                                                                                                                                   | enum private                              | trusted_only    | emergency_only                                                                                                                                                                                           | public           | plaintext      |                     |
| `status`                                                                                                                                        | enum active                               | draft           | archived                                                                                                                                                                                                 | sealed           | released       | plaintext           |                     |
| `triggerType`                                                                                                                                   | enum life_check_failure                   | time_based      | manual (optional)                                                                                                                                                                                        | plaintext        |                |
| `triggerConfig`                                                                                                                                 | object {releaseDate} (optional)           | plaintext       |                                                                                                                                                                                                          |
| `releasedAt`                                                                                                                                    | number (optional)                         | plaintext       |                                                                                                                                                                                                          |
| `isReleaseIntroduction`                                                                                                                         | boolean (optional)                        | plaintext       | When true, the item is a "release introduction": a welcome message the owner authors for trusted contacts who unlock the memorial vault after release. Hidden from the owner's regular /vault listings a |
| `createdAt`                                                                                                                                     | number                                    | plaintext       |                                                                                                                                                                                                          |
| `updatedAt`                                                                                                                                     | number                                    | plaintext       |                                                                                                                                                                                                          |
| Indexes: `by_vault`(vaultId), `by_category`(vaultId,category), `by_status`(vaultId,status), `by_user`(userId), `by_trigger`(triggerType,status) |

### `recipient_groups`

| Field                                                           | Type                           | Privacy   | Notes |
| --------------------------------------------------------------- | ------------------------------ | --------- | ----- |
| `userId`                                                        | id → users                     | plaintext |       |
| `name`                                                          | string                         | plaintext |       |
| `description`                                                   | string (optional)              | plaintext |       |
| `color`                                                         | string (optional)              | plaintext |       |
| `memberContactIds`                                              | array of id → trusted_contacts | plaintext |       |
| `isDefault`                                                     | boolean                        | plaintext |       |
| `createdAt`                                                     | number                         | plaintext |       |
| `updatedAt`                                                     | number                         | plaintext |       |
| Indexes: `by_user`(userId), `by_user_default`(userId,isDefault) |

### `vault_item_recipient_keys`

| Field                                                                                    | Type                  | Privacy    | Notes                                                        |
| ---------------------------------------------------------------------------------------- | --------------------- | ---------- | ------------------------------------------------------------ |
| `itemId`                                                                                 | id → vault_items      | plaintext  |                                                              |
| `contactId`                                                                              | id → trusted_contacts | plaintext  |                                                              |
| `wrappedDek`                                                                             | string                | ciphertext | ML-KEM-768 + AES-GCM envelope (JSON: {v, alg, kem, iv, ct}). |
| `createdAt`                                                                              | number                | plaintext  |                                                              |
| Indexes: `by_item`(itemId), `by_contact`(contactId), `by_item_contact`(itemId,contactId) |

### `vault_item_files`

| Field                                         | Type              | Privacy   | Notes |
| --------------------------------------------- | ----------------- | --------- | ----- |
| `itemId`                                      | id → vault_items  | plaintext |       |
| `userId`                                      | id → users        | plaintext |       |
| `storageId`                                   | id → _storage     | plaintext |       |
| `name`                                        | string            | plaintext |       |
| `mimeType`                                    | string            | plaintext |       |
| `size`                                        | number            | plaintext |       |
| `iv`                                          | string            | nonce     |       |
| `kind`                                        | enum document     | audio     | video | image | plaintext |     |
| `durationSec`                                 | number (optional) | plaintext |       |
| `order`                                       | number            | plaintext |       |
| `createdAt`                                   | number            | plaintext |       |
| Indexes: `by_item`(itemId), `by_user`(userId) |

### `trusted_contacts`

| Field                                                                                                                                     | Type                  | Privacy                   | Notes                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                                                                                                                  | id → users            | plaintext                 |                                                                                                                                                                                                          |
| `contactUserId`                                                                                                                           | id → users (optional) | plaintext                 |                                                                                                                                                                                                          |
| `name`                                                                                                                                    | string                | plaintext                 |                                                                                                                                                                                                          |
| `email`                                                                                                                                   | string (optional)     | plaintext                 | At least one of email / phoneNumber is provided (enforced in inviteContact); a contact can be invited by either channel or both.                                                                         |
| `phoneNumber`                                                                                                                             | string (optional)     | plaintext                 |                                                                                                                                                                                                          |
| `role`                                                                                                                                    | enum family           | friend                    | lawyer                                                                                                                                                                                                   | doctor  | other     | plaintext |     |
| `contactType`                                                                                                                             | enum trust            | recipient_only (optional) | plaintext                                                                                                                                                                                                |         |
| `shardIndex`                                                                                                                              | number (optional)     | plaintext                 |                                                                                                                                                                                                          |
| `encryptedShard`                                                                                                                          | string (optional)     | ciphertext                |                                                                                                                                                                                                          |
| `shardPublicKeyUsed`                                                                                                                      | string (optional)     | public                    |                                                                                                                                                                                                          |
| `shardConfirmed`                                                                                                                          | boolean (optional)    | plaintext                 |                                                                                                                                                                                                          |
| `lastVerifiedAt`                                                                                                                          | number (optional)     | plaintext                 | Stamped automatically after a successful on-device shard unwrap (see useReceiveShard), the contact decrypting their real `encryptedShard` is the verification.                                           |
| `contactPublicKey`                                                                                                                        | string (optional)     | public                    |                                                                                                                                                                                                          |
| `contactIdentityPublicKey`                                                                                                                | string (optional)     | public                    | Identity material mirrored from the contact user's record (finding #2, malicious-server key substitution). `contactIdentityPublicKey` is the contact's ML-DSA-65 public key; `contactPublicKeySignature  |
| `contactPublicKeySignature`                                                                                                               | string (optional)     | public                    |                                                                                                                                                                                                          |
| `pinnedIdentityFingerprint`                                                                                                               | string (optional)     | public                    | TOFU pin: hex SHA-256 of `contactIdentityPublicKey`, set by the owner the first time they successfully verify this contact's key. If the contact's identity key later changes, the recomputed fingerprin |
| `invitationStatus`                                                                                                                        | enum pending          | accepted                  | declined                                                                                                                                                                                                 | revoked | plaintext |           |
| `invitationToken`                                                                                                                         | string                | secret                    |                                                                                                                                                                                                          |
| `invitedAt`                                                                                                                               | number                | plaintext                 |                                                                                                                                                                                                          |
| `acceptedAt`                                                                                                                              | number (optional)     | plaintext                 |                                                                                                                                                                                                          |
| `reconfirmReminders`                                                                                                                      | number (optional)     | plaintext                 | Availability re-confirmation tracking (weekly cron). `reconfirmReminders` counts nudges sent to a contact whose shard verification is stale/missing; `ownerNotifiedUnavailableAt` is stamped once the ow |
| `lastReconfirmAt`                                                                                                                         | number (optional)     | plaintext                 |                                                                                                                                                                                                          |
| `ownerNotifiedUnavailableAt`                                                                                                              | number (optional)     | plaintext                 |                                                                                                                                                                                                          |
| `createdAt`                                                                                                                               | number                | plaintext                 |                                                                                                                                                                                                          |
| `updatedAt`                                                                                                                               | number                | plaintext                 |                                                                                                                                                                                                          |
| Indexes: `by_user`(userId), `by_contact_user`(contactUserId), `by_shard_index`(userId,shardIndex), `by_invitation_token`(invitationToken) |

### `life_check_configs`

| Field                                                                                                            | Type                              | Privacy                   | Notes                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                                                                                         | id → users                        | plaintext                 |                                                                                                                                                                                                          |
| `frequency`                                                                                                      | enum weekly                       | monthly                   | quarterly                                                                                                                                                                                                | plaintext |     |
| `inactivityThresholdDays`                                                                                        | number (optional)                 | plaintext                 | Inactivity-driven trigger model. Derived from `frequency` at write time (weekly=7d, monthly=30d, quarterly=90d) but stored explicitly so the evaluator can compare without re-mapping. Optional during r |
| `lastActivityAt`                                                                                                 | number (optional)                 | plaintext                 | Last observed user activity (login, navigation). The evaluator only initiates a cycle once `now - lastActivityAt >= inactivityThresholdDays`.                                                            |
| `activeChannels`                                                                                                 | array of {type, order, isEnabled} | plaintext                 |                                                                                                                                                                                                          |
| `travelModeEnabled`                                                                                              | boolean                           | plaintext                 |                                                                                                                                                                                                          |
| `travelModeUntil`                                                                                                | number (optional)                 | plaintext                 |                                                                                                                                                                                                          |
| `isActive`                                                                                                       | boolean                           | plaintext                 |                                                                                                                                                                                                          |
| `nextCheckAt`                                                                                                    | number                            | plaintext                 |                                                                                                                                                                                                          |
| `lastCheckAt`                                                                                                    | number (optional)                 | plaintext                 |                                                                                                                                                                                                          |
| `checkInWindowDays`                                                                                              | number (optional)                 | plaintext                 | Stage-1 user check-in window length (days). Optional override; defaults to CHECK_IN_WINDOW_DAYS in life_check.ts. Used by the dev fast-test mode.                                                        |
| `confirmationThreshold`                                                                                          | number (optional)                 | plaintext                 | Stage-2 human confirmation. Defaults applied in life_check.ts: threshold 2 trusted contacts, window 7 days, fallback "abort" (release nothing unless a human confirms). Edited via the release-policy se |
| `confirmationWindowDays`                                                                                         | number (optional)                 | plaintext                 |                                                                                                                                                                                                          |
| `fallbackBehavior`                                                                                               | enum abort                        | release_anyway (optional) | plaintext                                                                                                                                                                                                |           |
| `createdAt`                                                                                                      | number                            | plaintext                 |                                                                                                                                                                                                          |
| `updatedAt`                                                                                                      | number                            | plaintext                 |                                                                                                                                                                                                          |
| Indexes: `by_user`(userId), `by_next_check`(nextCheckAt,isActive), `by_active_activity`(isActive,lastActivityAt) |

### `life_check_cycles`

| Field                                                                               | Type                                                       | Privacy   | Notes                                                                                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                                                            | id → users                                                 | plaintext |                                                                                                                                 |
| `configId`                                                                          | id → life_check_configs                                    | plaintext |                                                                                                                                 |
| `status`                                                                            | enum running                                               | plaintext |                                                                                                                                 |
| `channelsAttempted`                                                                 | array of {channelType, attemptedAt, respondedAt, response} | plaintext |                                                                                                                                 |
| `pendingScheduleIds`                                                                | array of id → _scheduled_functions (optional)              | plaintext | IDs of pending scheduled escalations (Convex scheduler). Cancelled when the cycle is validated by passive activity or user tap. |
| `validatedAt`                                                                       | number (optional)                                          | plaintext |                                                                                                                                 |
| `validatedBy`                                                                       | string (optional)                                          | plaintext |                                                                                                                                 |
| `cancelledAt`                                                                       | number (optional)                                          | plaintext |                                                                                                                                 |
| `cancelledReason`                                                                   | string (optional)                                          | plaintext |                                                                                                                                 |
| `scheduledAt`                                                                       | number                                                     | plaintext |                                                                                                                                 |
| `startedAt`                                                                         | number                                                     | plaintext |                                                                                                                                 |
| `completedAt`                                                                       | number (optional)                                          | plaintext |                                                                                                                                 |
| Indexes: `by_user`(userId), `by_status`(userId,status), `by_scheduled`(scheduledAt) |

### `push_subscriptions`

| Field                                               | Type              | Privacy   | Notes |
| --------------------------------------------------- | ----------------- | --------- | ----- |
| `userId`                                            | id → users        | plaintext |       |
| `endpoint`                                          | string            | secret    |       |
| `p256dh`                                            | string            | public    |       |
| `auth`                                              | string            | secret    |       |
| `deviceLabel`                                       | string (optional) | plaintext |       |
| `createdAt`                                         | number            | plaintext |       |
| `lastUsedAt`                                        | number (optional) | plaintext |       |
| Indexes: `by_user`(userId), `by_endpoint`(endpoint) |

### `access_requests`

| Field                                                                                               | Type                                      | Privacy   | Notes  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------- | ------ |
| `vaultUserId`                                                                                       | id → users                                | plaintext |        |
| `requestedBy`                                                                                       | id → trusted_contacts                     | plaintext |        |
| `sectionsRequested`                                                                                 | array of string                           | plaintext |        |
| `status`                                                                                            | enum pending                              | approved  | denied | auto_denied | expired | revoked | plaintext |     |
| `respondedAt`                                                                                       | number (optional)                         | plaintext |        |
| `autoResponseAt`                                                                                    | number                                    | plaintext |        |
| `quorumRequired`                                                                                    | number (optional)                         | plaintext |        |
| `quorumReached`                                                                                     | boolean (optional)                        | plaintext |        |
| `contactsInitiated`                                                                                 | array of id → trusted_contacts (optional) | plaintext |        |
| `gracePeriodEndsAt`                                                                                 | number (optional)                         | plaintext |        |
| `cancelledDuringGrace`                                                                              | boolean (optional)                        | plaintext |        |
| `reason`                                                                                            | string (optional)                         | plaintext |        |
| `createdAt`                                                                                         | number                                    | plaintext |        |
| `updatedAt`                                                                                         | number                                    | plaintext |        |
| Indexes: `by_vault_user`(vaultUserId), `by_requester`(requestedBy), `by_status`(vaultUserId,status) |

### `recovery_shard_submissions`

| Field                                                                                                                                                          | Type                  | Privacy    | Notes                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessRequestId`                                                                                                                                              | id → access_requests  | plaintext  |                                                                                                                                                                   |
| `vaultUserId`                                                                                                                                                  | id → users            | plaintext  |                                                                                                                                                                   |
| `submitterContactId`                                                                                                                                           | id → trusted_contacts | plaintext  |                                                                                                                                                                   |
| `recipientContactId`                                                                                                                                           | id → trusted_contacts | plaintext  |                                                                                                                                                                   |
| `wrappedShard`                                                                                                                                                 | string                | ciphertext | ML-KEM-768 + AES-GCM envelope wrapping the submitter's raw Shamir share. Only `recipientContactId` (the holder of the matching private key) can decrypt this row. |
| `createdAt`                                                                                                                                                    | number                | plaintext  |                                                                                                                                                                   |
| Indexes: `by_request`(accessRequestId), `by_request_recipient`(accessRequestId,recipientContactId), `by_request_submitter`(accessRequestId,submitterContactId) |

### `audit_logs`

| Field                                                                                  | Type              | Privacy         | Notes                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                                                               | id → users        | plaintext       |                                                                                                                                                                                                         |
| `actorType`                                                                            | enum user         | trusted_contact | system                                                                                                                                                                                                  | ai_assistant | plaintext |     |
| `actorId`                                                                              | string            | plaintext       |                                                                                                                                                                                                         |
| `action`                                                                               | string            | plaintext       |                                                                                                                                                                                                         |
| `resourceType`                                                                         | string            | plaintext       |                                                                                                                                                                                                         |
| `resourceId`                                                                           | string            | plaintext       |                                                                                                                                                                                                         |
| `metadata`                                                                             | string (optional) | plaintext       |                                                                                                                                                                                                         |
| `ipAddress`                                                                            | string (optional) | plaintext       | Server-attested IP and ISO-3166-1 alpha-2 country at the time of action. Captured by the Next.js middleware (Vercel geo headers), HMAC-signed, verified inside `auditedMutation` before being persisted |
| `country`                                                                              | string (optional) | plaintext       |                                                                                                                                                                                                         |
| `previousLogHash`                                                                      | string            | hash / salt     |                                                                                                                                                                                                         |
| `logHash`                                                                              | string            | hash / salt     |                                                                                                                                                                                                         |
| `createdAt`                                                                            | number            | plaintext       |                                                                                                                                                                                                         |
| Indexes: `by_user`(userId), `by_action`(userId,action), `by_created`(userId,createdAt) |

### `support_tickets`

| Field                                                     | Type                  | Privacy     | Notes                                                                                                                                                                                                   |
| --------------------------------------------------------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                                  | id → users (optional) | plaintext   |                                                                                                                                                                                                         |
| `name`                                                    | string                | plaintext   |                                                                                                                                                                                                         |
| `email`                                                   | string (optional)     | plaintext   | Reply-to contact. Exactly one of these is set, depending on the channel the submitter chose (email account → email, phone/WhatsApp account → whatsapp). Both optional so either channel can be omitted. |
| `whatsapp`                                                | string (optional)     | plaintext   |                                                                                                                                                                                                         |
| `topic`                                                   | enum general          | security    | billing                                                                                                                                                                                                 | recovery | feature_request | other | plaintext |     |
| `subject`                                                 | string                | plaintext   |                                                                                                                                                                                                         |
| `message`                                                 | string                | plaintext   |                                                                                                                                                                                                         |
| `status`                                                  | enum open             | in_progress | resolved                                                                                                                                                                                                | closed   | plaintext       |       |
| `createdAt`                                               | number                | plaintext   |                                                                                                                                                                                                         |
| `updatedAt`                                               | number                | plaintext   |                                                                                                                                                                                                         |
| Indexes: `by_user`(userId), `by_status`(status,createdAt) |

### `notifications`

| Field                                                                          | Type              | Privacy        | Notes           |
| ------------------------------------------------------------------------------ | ----------------- | -------------- | --------------- |
| `userId`                                                                       | id → users        | plaintext      |                 |
| `type`                                                                         | enum life_check   | access_request | contact_invited | contact_confirmed | vault_update | security_alert | system | plaintext |     |
| `title`                                                                        | string            | plaintext      |                 |
| `body`                                                                         | string            | plaintext      |                 |
| `actionUrl`                                                                    | string (optional) | plaintext      |                 |
| `channels`                                                                     | array of string   | plaintext      |                 |
| `isRead`                                                                       | boolean           | plaintext      |                 |
| `readAt`                                                                       | number (optional) | plaintext      |                 |
| `relatedId`                                                                    | string (optional) | plaintext      |                 |
| `relatedType`                                                                  | string (optional) | plaintext      |                 |
| `createdAt`                                                                    | number            | plaintext      |                 |
| Indexes: `by_user`(userId), `by_unread`(userId,isRead), `by_type`(userId,type) |

### `analytics_events`

| Field                                                                                       | Type                  | Privacy       | Notes                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | --------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                                                                    | id → users (optional) | plaintext     | Absent for pre-auth pages (auth / onboarding) where no user exists yet.                                                                        |
| `eventType`                                                                                 | enum page_view        | session_start | plaintext                                                                                                                                      |     |
| `route`                                                                                     | string                | plaintext     |                                                                                                                                                |
| `ipAddress`                                                                                 | string (optional)     | plaintext     | Server-attested IP + ISO-3166-1 alpha-2 country, lifted from the sealed `_audit` envelope (same source as audit_logs), verified before insert. |
| `country`                                                                                   | string (optional)     | plaintext     |                                                                                                                                                |
| `createdAt`                                                                                 | number                | plaintext     |                                                                                                                                                |
| Indexes: `by_created`(createdAt), `by_user`(userId), `by_type_created`(eventType,createdAt) |

### `devices`

| Field                      | Type              | Privacy   | Notes                                                          |
| -------------------------- | ----------------- | --------- | -------------------------------------------------------------- |
| `userId`                   | id → users        | plaintext |                                                                |
| `kind`                     | enum ios          | android   | web                                                            | plaintext | ios / android / web |
| `label`                    | string            | plaintext | Human label derived from the user agent, e.g. "Chrome on Mac". |
| `devicePublicKey`          | string (optional) | public    | ML-KEM-768 public key of the device (for handoffs to it).      |
| `trusted`                  | boolean           | plaintext | True when the user ticked "Trust this browser".                |
| `lastSeenAt`               | number            | plaintext |                                                                |
| `revokedAt`                | number (optional) | plaintext |                                                                |
| `createdAt`                | number            | plaintext |                                                                |
| Indexes: `by_user`(userId) |

### `pairing_sessions`

| Field                                         | Type                  | Privacy     | Notes                                                                  |
| --------------------------------------------- | --------------------- | ----------- | ---------------------------------------------------------------------- |
| `userId`                                      | id → users (optional) | plaintext   | Set when the phone approves.                                           |
| `browserPublicKey`                            | string                | public      | Ephemeral ML-KEM-768 public key generated by the new browser / device. |
| `userAgent`                                   | string                | plaintext   |                                                                        |
| `approxLocation`                              | string (optional)     | plaintext   |                                                                        |
| `status`                                      | enum waiting          | approved    | consumed                                                               | expired | rejected | plaintext |     |
| `envelope`                                    | string (optional)     | ciphertext  | ML-KEM + AES-GCM envelope of the MasterKey, read once.                 |
| `approvalSignature`                           | string (optional)     | public      | ML-DSA-65 signature by the approving device.                           |
| `loginTokenHash`                              | string (optional)     | hash / salt | SHA-256 of the one-time login token; the token itself is never stored. |
| `expiresAt`                                   | number                | plaintext   |                                                                        |
| `createdAt`                                   | number                | plaintext   |                                                                        |
| Indexes: `by_status_expiry`(status,expiresAt) |

### `cloud_backup_envelopes`

| Field                      | Type              | Privacy    | Notes                                                                          |
| -------------------------- | ----------------- | ---------- | ------------------------------------------------------------------------------ |
| `userId`                   | id → users        | plaintext  |                                                                                |
| `provider`                 | enum icloud       | google     | plaintext                                                                      |     |
| `envelope`                 | string            | ciphertext | AES-GCM(CBK, RootKey). CBK lives only in iCloud Keychain / Google Block Store. |
| `createdAt`                | number            | plaintext  |                                                                                |
| `lastRestoredAt`           | number (optional) | plaintext  |                                                                                |
| Indexes: `by_user`(userId) |

### `recovery_requests`

| Field                                    | Type                                 | Privacy    | Notes                                    |
| ---------------------------------------- | ------------------------------------ | ---------- | ---------------------------------------- |
| `userId`                                 | id → users                           | plaintext  |                                          |
| `newDevicePublicKey`                     | string                               | public     | ML-KEM-768 public key of the new device. |
| `status`                                 | enum pending                         | approved_1 | approved_2                               | released | rotated | cancelled | rejected | expired | plaintext |     |
| `windowEndsAt`                           | number                               | plaintext  | createdAt + 48 h.                        |
| `scheduledReleaseId`                     | id → _scheduled_functions (optional) | plaintext  |                                          |
| `cancelledAt`                            | number (optional)                    | plaintext  |                                          |
| `createdAt`                              | number                               | plaintext  |                                          |
| Indexes: `by_user_status`(userId,status) |

### `recovery_approvals`

| Field                                              | Type                   | Privacy    | Notes                                                   |
| -------------------------------------------------- | ---------------------- | ---------- | ------------------------------------------------------- |
| `requestId`                                        | id → recovery_requests | plaintext  |                                                         |
| `contactId`                                        | id → trusted_contacts  | plaintext  |                                                         |
| `decision`                                         | enum approve           | reject     | plaintext                                               |     |
| `wrappedShareForDevice`                            | string (optional)      | ciphertext | Recovery Secret share re-wrapped to the new device key. |
| `signature`                                        | string                 | public     | ML-DSA-65 over (requestId, decision, envelope hash).    |
| `createdAt`                                        | number                 | plaintext  |                                                         |
| Indexes: `by_request_contact`(requestId,contactId) |

### `recovery_secret_shares`

| Field                                            | Type                  | Privacy    | Notes                                                       |
| ------------------------------------------------ | --------------------- | ---------- | ----------------------------------------------------------- |
| `userId`                                         | id → users            | plaintext  |                                                             |
| `contactId`                                      | id → trusted_contacts | plaintext  |                                                             |
| `generation`                                     | number                | plaintext  |                                                             |
| `wrappedShare`                                   | string                | ciphertext | ML-KEM envelope of one Shamir share of the Recovery Secret. |
| Indexes: `by_user_generation`(userId,generation) |

### `social_envelopes`

| Field                      | Type       | Privacy    | Notes                              |
| -------------------------- | ---------- | ---------- | ---------------------------------- |
| `userId`                   | id → users | plaintext  |                                    |
| `generation`               | number     | plaintext  |                                    |
| `envelope`                 | string     | ciphertext | AES-GCM(HKDF(RS // G), MasterKey). |
| Indexes: `by_user`(userId) |

### `gate_keys`

| Field                                            | Type       | Privacy    | Notes                                                                  |
| ------------------------------------------------ | ---------- | ---------- | ---------------------------------------------------------------------- |
| `userId`                                         | id → users | plaintext  |                                                                        |
| `generation`                                     | number     | plaintext  |                                                                        |
| `kmsCiphertext`                                  | string     | ciphertext | Encrypted by an external KMS; only a "use node" action can decrypt it. |
| Indexes: `by_user_generation`(userId,generation) |

Files: `convex-schema-additions.ts`, `device-sqlite.sql`.
