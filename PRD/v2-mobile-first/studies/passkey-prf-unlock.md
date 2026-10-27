# Study: passkey (PRF) to reopen the vault on a new phone

Status: proposal, needs a founders' decision before any code. Date: 2026-10-27.

## Why

Principle: every account must be able to reopen its vault alone, without the 24 words and without trusted contacts. Contacts are a last resort, not the main path.

Today this rests on the cloud backup (D7): a random Cloud Backup Key (CBK) sits in the platform keychain, Keeplas holds `AES-GCM(CBK, RootKey)` (`packages/crypto/src/cloud`, `cloud_backup_envelopes`).

- **iPhone**: the CBK is in iCloud Keychain, synced continuously to every device on the Apple account. Reliable.
- **Android**: the CBK is in Google Block Store, which is not reliable for this job ([Block Store docs](https://developer.android.com/identity/block-store)):
  - `storeBytes` only writes locally. The upload happens later with Android Backup, only if the user turned Google backup on, and the app can't tell whether it succeeded.
  - The data reaches a new phone only if the user sets that phone up by restoring from the Google backup and restores Keeplas in that flow. A phone set up "as new", with Keeplas installed from the Play Store, gets nothing.
  - End-to-end encryption only "when possible" (screen lock and Google account). Since PR #333 we refuse to seal without it.
  - Google itself recommends passkeys with Credential Manager instead.
- **Android ↔ iPhone**: the CBK never crosses from Block Store to iCloud.

## Proposal

Use the account's passkey as the unlock key for the backup, through the WebAuthn **PRF** extension. A passkey with PRF returns a 32-byte secret that is stable for a given salt, computed inside the passkey provider after user verification, and synced with the passkey. It replaces the CBK: the secret no longer needs Block Store.

```
PRF(passkey, prfSalt)  ──HKDF──▶  unlock key  ──AES-GCM──▶  envelope = Enc(RootKey)
     (provider, E2EE)                                          (Keeplas)
```

- `prfSalt`: 32 random bytes per account, stored by Keeplas (not secret).
- Unlock key: `HKDF-SHA256(prfOutput, salt = prfSalt, info = "keeplas/passkey-unlock/v1|" + userId)`.
- Envelope: same format and AAD style as the cloud backup, AAD `userId|keeplas/passkey-unlock/v1`. It wraps the RootKey, so it survives MasterKey rotations like the cloud backup does.
- New phone: sign in with phone and WhatsApp code → "Open with your passkey" → one assertion with PRF → envelope from Keeplas → RootKey → MasterKey. No words, no contacts.

Zero-access is unchanged: Keeplas holds only the envelope, the passkey provider holds only the PRF secret, and the PRF output never leaves the phone. The trust model is the same as D7: whoever controls the Google / Apple account and the device lock can restore.

## What the platforms support

| Need                                              | State                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRF in iCloud Keychain passkeys (native app)      | API available from iOS 18 ([Apple](https://developer.apple.com/documentation/authenticationservices/asauthorizationpublickeycredentialprfassertioninput-swift.struct)). **Prototype**: confirm the output is identical on a second device after sync.      |
| PRF in Google Password Manager passkeys (Android) | Reported as on by default ([Corbado](https://www.corbado.com/blog/passkeys-prf-webauthn)), not confirmed by an official Google page. **Prototype** on Android 14+.                                                                                         |
| PRF with third-party providers on Android         | Reported as not available through Credential Manager today ([AliasVault](https://docs.aliasvault.net/mobile-apps/android/autofill.html)). Those users keep the other ways back.                                                                            |
| Our library                                       | `react-native-passkey` 3.6.2 (already installed) returns PRF results on iOS (`PasskeyDelegate.swift`). Android passes the request JSON to Credential Manager. **Prototype**: confirm PRF results come back on Android.                                     |
| Android → iPhone                                  | Works if the user uses Google Password Manager on the iPhone (iOS 17+, Chrome set as AutoFill provider, GPM PIN) ([Chrome blog](https://developer.chrome.com/blog/passkeys-gpm-ios)). **Prototype**: PRF through GPM in a native iOS app is not confirmed. |
| iPhone → Android                                  | Not covered when the passkey lives in iCloud Keychain. It works only if the passkey was created in Google Password Manager or a cross-platform manager.                                                                                                    |

## What it solves and what it doesn't

Solves:

- Android to Android without a setup restore: the passkey syncs with the Google account, no Block Store needed.
- Android to iPhone for users who keep Google Password Manager.
- One mechanism on both platforms instead of two keychains.

Doesn't solve:

- iPhone (iCloud Keychain) to Android: the 24-word kit or trusted contacts stay the way back.
- Losing the Google / Apple account as well: kit or contacts. This can't be avoided without breaking zero-access.
- Passkeys created before PRF was requested: on iOS, PRF may have to be enabled when the passkey is created. **Prototype** checks it; if so, existing users create a new passkey once.

## Migration for existing accounts

Nothing existing is removed. The passkey becomes an extra way back, next to the cloud backup.

| Account today                                  | What happens                                                                                                                                        | Until then                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Has a PRF-capable passkey, vault open on phone | At the next vault opening (RootKey in memory), one passkey check adds the passkey envelope, like `useEnsureCloudBackup` does today.                 | Cloud backup and kit keep working. |
| Has a passkey without PRF                      | Prompt once: "Create a new passkey to reopen your vault on your next phone". Old passkey kept for sign-in.                                          | Cloud backup and kit keep working. |
| No passkey                                     | The existing passkey step (`features/passkey-step.tsx`) asks for one with PRF.                                                                      | Cloud backup and kit keep working. |
| Legacy web account never opened on mobile      | Opens with the kit once (PR #333 explains this on the kit screen), then gets the passkey envelope and cloud backup like everyone else.              | Kit or contacts.                   |
| Android backup sealed before the E2EE check    | Not detectable today: the row doesn't record E2EE. Re-seal on next opening if `isEndToEndEncrypted()` is true, otherwise drop the Block Store copy. | Same as today.                     |

Block Store stays as a second Android path until we measure passkey coverage; removing it is a separate decision.

## Changes it needs

- `packages/crypto` (founders, CODEOWNERS): `sealPasskeyUnlock` / `openPasskeyUnlock` next to `sealCloudBackup`, plus tests (same salt → same key, other user → fails, other AAD → fails).
- `packages/convex`: a `passkey_unlock_envelopes` table (`userId`, `credentialId`, `prfSalt`, `envelope`, `phraseSalt`, `createdAt`), one row per passkey. Restore behind the same phone proof and rate limit as `cloud_backup.restore`. Removing a passkey (`webauthn.removeCredential`) deletes its envelope.
- `apps/mobile`: request PRF when creating passkeys; seal at vault opening; "Open with your passkey" on the kit screen and lost-access screen.
- Copy: D7's risk sentence applies as written.

## Prototype plan

1. iPhone 18+: create a passkey with PRF, evaluate with a fixed salt, evaluate again on a second iPhone after iCloud sync → verify: same 32 bytes.
2. Android 14+ with Google Password Manager: same test on two phones → verify: same 32 bytes, and PRF results returned by `react-native-passkey`.
3. iPhone with Chrome as AutoFill provider, passkey created on Android → verify: PRF works in the native app.
4. Existing passkey created without PRF → verify: whether PRF can be evaluated on it (iOS and Android).

The result of 1 and 2 decides go / no-go. 3 and 4 shape the migration.

## Decisions for the founders

1. Go for the prototype (steps 1–4)?
2. Keep Block Store as a second Android path, or plan to retire it once passkey coverage is known?
3. On iPhone, should onboarding suggest Google Password Manager for users who may switch to Android, or stay neutral?
