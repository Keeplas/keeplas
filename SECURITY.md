# Security Policy

## Reporting a Vulnerability

**Do NOT open a public GitHub issue, discussion or pull request for security vulnerabilities.**

Report privately through either channel:

- **GitHub Private Vulnerability Reporting:** [report a vulnerability](https://github.com/Keeplas/keeplas/security/advisories/new) (Security tab → "Report a vulnerability")
- **Email:** security@keeplas.com

We acknowledge reports within 48 hours.

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Supported Versions

| Version    | Supported |
| ---------- | --------- |
| 0.x (beta) | Yes       |

## Security Model

Keeplas uses **client-side, zero-access encryption**: vault data is encrypted on the user's device and the server (Convex) only stores and relays ciphertext. This is not a zero-knowledge _proof_ system, and it is not infallible against a malicious server and a compromised client at the same time.

- **Keys stay on the device.** The Master Key and the 24-word recovery phrase never leave the client unencrypted. The 24 words are the root crypto secret (Argon2id-derived); the password, where still used, is authentication only.
- **The Master Key is never split.** Trusted contacts hold no part of it.
- **Vault items** are encrypted with AES-256-GCM before upload. Each item's data key (DEK) is wrapped per recipient with **ML-KEM-768** (NIST FIPS 203, post-quantum).
- **Authenticated key distribution (TOFU).** Each user has an **ML-DSA-65** (NIST FIPS 204) identity key that signs their ML-KEM public key. Clients verify the signature and the pinned fingerprint before wrapping a DEK to a contact, so a server-substituted public key is rejected. The identity secret key is wrapped under the Master Key.
- **Mobile-first sign-in.** The phone app is the primary device and uses a passkey. A computer is linked by scanning a QR code with the phone (the Master Key is sealed to the browser's ephemeral ML-KEM key and signed by the phone's identity key), then signs in with a passkey.
- **New or lost phone.** An encrypted cloud backup (iCloud Keychain / Google Block Store) is on by default: a random backup key lives only in the platform keychain and Keeplas stores only the root key wrapped under it, so neither Apple/Google alone nor Keeplas alone can open it. The 24 words are not shown by default; users can opt in to a recovery kit from Settings.
- **Owner recovery with trusted contacts.** A random recovery secret (not the Master Key) is split 2-of-n between trusted contacts, each share sealed to the contact's ML-KEM key, and combined with a gate key Keeplas keeps under KMS. The gate key is released only after 2 signed contact approvals and a 72-hour owner-cancellable protection window. Contacts alone or Keeplas alone open nothing.
- **Per-device unlock.** PIN, biometrics and hardware keys (WebAuthn PRF) unlock a locally wrapped key; the vault auto-locks after inactivity and clears in-memory keys.
- **Step-up gates.** Sensitive server functions require full authentication (login OTP + TOTP), not just a session.
- **Hardening.** The web app sends a strict, hash-based Content Security Policy and security headers. All sensitive cryptography lives in [`packages/crypto/`](./packages/crypto), which requires founder review (see [CODEOWNERS](./.github/CODEOWNERS)).

## Disclosure Policy

We follow coordinated disclosure: please give us reasonable time to fix an issue before publishing it. We credit researchers who report valid vulnerabilities, unless they prefer to stay anonymous.
