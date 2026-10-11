# Keeplas v2: global context, decisions and phases

Entry point for the v2 redesign (mobile-first continuity and succession). Read this first. It overrides older PRD files, and the design kit, wherever they disagree.

- **Started**: 2026-10-11
- **Owner**: Prince
- **Status**: in progress. Phases 0 to 3 done.

## Sources

| Folder                                             | What                                                                                                                                                                                                                                                                   | Notes                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`figma/`](figma/README.md)                        | Snapshot of the Figma file: original `.fig`, screen index, PNGs, per-screen layout specs, on-screen copy, light + dark tokens, code-ready SVG illustrations and logos                                                                                                  | Figma: https://www.figma.com/design/pzH8HSOAC5KQzFtK0j8ApE/                                                                  |
| [`design-kit/`](design-kit/README.md)              | The full Keeplas Design Kit: brand guide, interactive explorer, tokens (CSS / Tailwind / Expo), 58 SVG icons, 11 illustrations, 8 mockup boards, EN/FR i18n, architecture review, screen inventory, flows, business rules, proposed Convex tables, mobile SQLite draft | Start with `Keeplas-Explorer.html`. The architecture review (`docs/ARCHITECTURE.md`) was written against repo commit 512f03d |
| Affine "Product Strategy & Technical Architecture" | Strategy doc behind the redesign                                                                                                                                                                                                                                       | External                                                                                                                     |

## Vision

Keeplas moves from "a web vault" to **personal continuity and succession, mobile-first**.

| Today (shipped web app)                                  | v2                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-up on the web (email + password, or phone)          | **Sign-up only in the iOS / Android app**, with a phone number verified by a WhatsApp code. No email required                                                                        |
| 24 words required on every new device                    | 24 words become an **optional recovery kit**, used only in the mobile app                                                                                                            |
| Web sign-in with password + login OTP + TOTP             | Web: **QR link from the phone** the first time, then **passkey**. No password and no phrase on the web                                                                               |
| One "trust contact" role holding a MasterKey shard       | **Two independent roles that can be combined**: trust contact (helps recover access and confirms a death, cannot read files) and beneficiary (receives the content assigned to them) |
| No owner recovery                                        | **Owner recovery**: another signed-in device, 2 of 3 trust contacts (72 h protection window + 6-digit code compared by call), recovery kit, iCloud / Google encrypted backup         |
| Item creation by category                                | **Capture first** (scan, voice, note), Encrypted inbox to sort later                                                                                                                 |
| Release per item                                         | **Sharing per folder**, "now" or "after verification + 72 h grace period"                                                                                                            |
| "Digital Curator" brand (Manrope, `#041632`, no borders) | New brand: Source Serif 4 + Inter, navy `#0E2340`, ivory `#FDFBF7`, sky `#238BCA`, landscape illustrations, thin borders allowed, **light + dark (Noir)**                            |

Business rules: [`design-kit/docs/BUSINESS-RULES.md`](design-kit/docs/BUSINESS-RULES.md). Flows: [`design-kit/docs/FLOWS.md`](design-kit/docs/FLOWS.md).

## Decisions log

| #   | Topic                                                | Decision                                                                                                                                                                                                      | Date                         |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D1  | Mobile app                                           | New workspace `apps/mobile`, React Native with **Expo**. Scaffold only for now                                                                                                                                | 2026-10-11                   |
| D2  | Sign-up                                              | Mobile-only. The web shows "Get the app" (D-01) to visitors without an account and links computers by QR                                                                                                      | 2026-10-11 (from design kit) |
| D3  | Delays                                               | **72 h everywhere**: owner-recovery protection window **and** succession grace period. The kit's 48 h is dropped                                                                                              | 2026-10-11                   |
| D4  | Recovery code                                        | **6 digits**, computed locally from `hash(requestId, device pk)` (mockups show 4)                                                                                                                             | 2026-10-11                   |
| D5  | Existing email + password accounts                   | **Migrated to phone sign-in** (M09-7 "Move to phone sign-in", M09-8 "Password sign-in turned off")                                                                                                            | 2026-10-11                   |
| D6  | Labels                                               | FR uses **"Contacts"** (not "Personnes"). **"Life check"** stays in English in both languages                                                                                                                 | 2026-10-11                   |
| D7  | Optional encrypted backups (Keeplas, iCloud, Google) | **On by default**, explained on an onboarding screen with a visible toggle, in the app's brand. The screen must state the risk: whoever controls the Apple / Google account and a device passcode can restore | 2026-10-11                   |
| D8  | Life check frequency                                 | Keep **weekly / monthly / quarterly** (7 / 30 / 90 days)                                                                                                                                                      | 2026-10-11                   |
| D9  | Undesigned states                                    | Designed in Figma: section 09 (A, 10 security edge cases) and section 10 (B, 22 states from one template)                                                                                                     | 2026-10-11                   |
| D10 | Dark mode                                            | Only 5 reference screens are drawn, on purpose. Every other screen (mobile and web) binds to the `Semantic · Dark` tokens. No duplicate dark designs                                                          | 2026-10-11                   |
| D11 | Landing page                                         | The Figma "Landing page" (L-01 → L-06) is **out of the current plan** for the app; it is built in the keeplas-website repo                                                                                    | 2026-10-11                   |
| D12 | Language                                             | English by default, including first launch; French optional, saved on the account; missing FR keys fall back to EN                                                                                            | 2026-10-11 (from design kit) |
| D13 | Trust contacts                                       | Up to 3 trust contacts; 2 confirmations are enough                                                                                                                                                            | 2026-10-11 (from design kit) |
| D14 | MasterKey shards (F1 + F2)                           | **Removed entirely**, not re-split into 3 contact shares: once reconstruction is gone, MasterKey shares only keep a collusion risk. Owners whose key was ever split get a **forced** master-key rotation      | 2026-10-11                   |

Still open (design kit `OPEN-DECISIONS.md`): web sidebar labels (proposal: My vault, Shared with me, People, Life check, Devices, Settings; Recovery center from Settings), language selector style, tablet layout.

## Design references to fix

These come from the Figma snapshot and the design kit. Code follows the decisions above, not the mockups.

- M02-2, W04-5: 48 h / "36h left" → 72 h (D3)
- M02-2, M02-3, Foundations: code `4729` → 6 digits (D4)
- M02-6, W05-4: "Personnes", "Vérification de vie" → "Contacts", "Life check" (D6)
- M07-6: backups "Off by default" → on by default (D7)
- `design-kit/docs/ARCHITECTURE.md`, `BUSINESS-RULES.md`, `i18n/*.json`: any 48 h / 4-digit wording → D3 / D4

## Security findings to fix (from the architecture review)

| ID  | Severity | Finding                                                                                                         | Fix                                                                            |
| --- | -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| F1  | Critical | After a release, trust contacts can rebuild the owner's whole MasterKey ("Reconstruct", `submitRecoveryShards`) | Remove the path; keep the scoped memorial release                              |
| F2  | Critical | Shamir share 0 in plaintext in localStorage                                                                     | Split into 3 contact shares only, migrate users, delete `keeplas_device_shard` |
| F3  | High     | No owner recovery                                                                                               | Phase 5                                                                        |
| F4  | High     | Plaintext metadata (category, file name / MIME / size)                                                          | `encryptedMeta` + size buckets                                                 |
| F5  | Medium   | `release_anyway` fallback releases on silence                                                                   | Remove                                                                         |
| F6  | Medium   | 24 words required on every new device                                                                           | QR pairing (phase 4)                                                           |
| F7  | Low      | PRD drift (3-of-5, ZK proofs, "5 emergency contacts")                                                           | Align docs                                                                     |
| F8  | High     | Web sign-up still exists                                                                                        | Phase 4                                                                        |

Details and file locations: [`design-kit/docs/ARCHITECTURE.md`](design-kit/docs/ARCHITECTURE.md) § Findings.

## Phases

Each step lists its verification. A phase is done when every check passes.

### Phase 0: Context (done)

- [x] Design kit, Figma snapshot and this file under `PRD/v2-mobile-first/` → verify: links in this file resolve

### Phase 1: `apps/mobile` scaffold (done)

- [x] Expo app in `apps/mobile`, wired into pnpm workspace + Turborepo, no features → verify: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build` green; web unaffected
- [x] Load the design-kit tokens (`tokens/theme.ts`) and fonts (Source Serif 4, Inter via `expo-font`) → verify: app boots on iOS simulator with a token-styled placeholder screen

### Phase 2: Stop the leaks (F2 → F1 → F5) (done)

- [x] No MasterKey shares at all (D14); purge server + browser shards; forced rotation for exposed owners → verify: `stop_leaks.test.ts` (purge migration, no shard slot, rotation flag); `pnpm check:zk` forbids `@keeplas/crypto/shamir` in `apps/web`; 2 contacts still required (`hub.test.ts`, quorum tests)
- [x] Remove master-key reconstruction (UI + Convex endpoints) → verify: `stop_leaks.test.ts` proves no contact endpoint serves a shard, even from a legacy row after a release; memorial release tests still green
- [x] Remove `release_anyway` → verify: `life_check.test.ts` proves a missed confirmation window never releases, even with a legacy config; `retireReleaseAnyway` migration test

### Phase 3: Design system v2 (done)

- [x] Replace tokens in `packages/ui` and `apps/web/src/app/globals.css` with light + dark semantic tokens from `figma/tokens.json` → verify: every token name in Foundations exists in CSS for both themes (`design-tokens.test.ts`). Legacy Material names stay as light-only aliases until phase 7 rebuilds the screens
- [x] Fonts (Source Serif 4 + Inter), icons and illustrations from `design-kit/svg/` → verify: no remaining Manrope / `#041632` references outside `PRD/`
- [x] Rewrite the `/design-system` skill and the UI section of `CLAUDE.md`; align PRD (F7) → verify: review in PR

### Phase 4: Devices, QR linking and mobile-only sign-up (F6, F8, D2, D5)

- [x] Convex: `devices`, `pairing_sessions` (2 min TTL), auth provider `pairing` → verify: tests for create / approve / consume / expire, key-hash mismatch rejected (M09-3) — `pairing.test.ts`
- [x] Convex: App Attest / Play Integrity on phone-otp `signup`; disable Password sign-up → verify: signup without attestation rejected (M09-9) — `attestation.test.ts`
- [x] Email → phone migration flow (M09-7, M09-8) → verify: an existing email account can add a phone and passkey, then password sign-in is refused — `account_migration.test.ts`
- [x] Web: remove sign-up, onboarding and phrase entry; add D-01, W04-1, W04-2; invite links open the app → verify: no route under `_auth/signup` or `_onboarding`; e2e QR link works — routes removed; protocol e2e in `pairing_e2e.test.ts`, W04-2 state machine unit-tested (not yet run against a live deployment). Vault rotation needs the 24 words, so the web now tells the owner to finish it in the phone app (phase 8 builds it)
- [x] New-device alert + "It wasn't me" (M08-4, M09-1, M09-2): revoke device, end sessions, cancel recovery, rotate keys → verify: tests for each action — `devices.test.ts`, `recovery.test.ts`

### Phase 5: Owner recovery (F3, D3, D4, D7)

- [x] `@keeplas/crypto`: recovery secret split 2-of-3, social envelope, 6-digit code → verify: unit tests — `packages/crypto/__tests__/social.test.ts`
- [x] Convex: `recovery_requests`, `recovery_approvals`, `recovery_secret_shares`, `social_envelopes`, `gate_keys`; KMS `use node` action; **72 h** window → verify: state-machine tests (pending → approved_1 → approved_2 → released → rotated; cancel; expire; reject) — `recovery.test.ts` (KMS: AWS in production, local KEK in dev)
- [x] States M09-4, M09-5, M09-6, M09-10 → verify: each state reachable in tests — `recovery.test.ts`
- [x] Cloud backup (iCloud Keychain / Google Block Store), on by default with an onboarding explanation → verify: toggle off deletes both halves — server half `cloud_backup.test.ts`, crypto `cloud.test.ts`; the app deletes the CBK (phase 8)

### Phase 6: Metadata (F4)

- [ ] `encryptedMeta` on items and files, client backfill, drop plaintext columns, size buckets → verify: schema has no plaintext category / file name / MIME / size
  - [x] Widen + migrate: writes carry only `encryptedMeta`; server-measured size buckets for the quota; client backfill (`useBackfillItemMeta`) → `metadata_backfill.test.ts`, `storage_quota.test.ts`
  - [ ] Narrow: drop the plaintext columns once `vault_items.countPlaintextMetadata` returns `{ items: 0, files: 0 }` on production (needs every owner to unlock once)

### Phase 7: Web screens

Pixel-perfect rule (phases 7 and 8): build each component once from `figma/specs/` values bound to tokens; never paste generated Figma code.

- [x] W04-3 dashboard, W04-3b, W04-4, W04-5 (status only), W04-6, W04-7, W05-3 / W05-4 + section 10 states, light + dark → verify: Playwright visual regression per screen at 1440×900, pixel diff against `figma/screens/` under an agreed threshold (diff image on failure) — `pnpm --filter @keeplas/web test:visual` (harness in `apps/web/visual/`, fixtures, no backend): light screens vs Figma ≤ 3 % differing pixels (pixelmatch threshold 0.1; measured 0.7 to 1.6 % for W04/W05, 1.5 to 2.5 % for the 393 px state cards), dark against committed baselines. Routes: `/hub` (W04-3, W04-3b), `/shared-with-me` (W04-4), `/settings/recovery` (W04-5), `/devices` (W04-6), `/settings` (W04-7), life check modal on every dashboard page (W05-3 / W05-4). Section 10 states built for the web: vault empty, no trusted contacts, nothing shared, we missed you, travel mode, offline, upload failed, storage full, camera / microphone off. Not on the web: "You're all caught up" (no alerts list on the web) and "Vault list item states" (offline outbox, mobile). Dark mode is a saved preference (account menu), light by default while the legacy screens are light-only
  - [ ] Backend for the remaining Figma content: per-file stored bytes for the W04-7 storage breakdown (the bar shows the total until then)
  - [ ] Run the rebuilt screens against a live deployment (only fixtures were rendered)

### Phase 8: Mobile app build-out

- [ ] Setup (M01), home / unlock / settings (M08), capture (M07 incl. offline outbox in SQLCipher), people and sharing (M06), shared vault (M03), recovery and life check (M02), edge cases (M09), states (section 10), dark mode → verify: flows in `design-kit/docs/FLOWS.md` run end to end; simulator screenshots at 393×852 pixel-diffed against `figma/screens/` under an agreed threshold
- [ ] Crypto on Hermes: `react-native-quick-crypto` (AES-GCM), native Argon2id, `@noble/post-quantum` as is; passkeys via `react-native-passkey` → verify: cross-platform test vectors match `packages/crypto`

## Key numbers

| Item                    | Value                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Trust contacts          | Up to 3; 2 approvals / confirmations                                                                      |
| Owner-recovery window   | 72 h                                                                                                      |
| Succession grace period | 72 h                                                                                                      |
| Recovery code           | 6 digits                                                                                                  |
| QR pairing session      | ~2 min; login token single-use, 60 s                                                                      |
| Life check              | Weekly / monthly / quarterly; stage 1 = 15 days (reminders D+3, D+7, D+10), stage 2 = 7 days for contacts |
| Plans                   | Free 100 MB, Lifetime 10 GB                                                                               |
