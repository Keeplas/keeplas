import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  accessLevelValidator,
  contactRoleValidator,
  vaultGroupValidator,
} from "./validators";
import { planValidator } from "./lib/plans";
import { storageRefValidator } from "./lib/storage";

export default defineSchema({
  // Auth tables (managed by @convex-dev/auth)
  ...authTables,

  // ═══════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════

  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    // Only read when there is no `avatarStorageId` (a URL typed in before
    // avatar uploads existed); cleared when an avatar is uploaded.
    avatarUrl: v.optional(v.string()),
    // Storage handle of an uploaded avatar image. Its serving URL is resolved
    // on read (users.viewer), never stored: a stored URL breaks once the blob
    // moves to another storage provider or deployment.
    avatarStorageId: v.optional(storageRefValidator),
    phoneNumber: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    // Built-in categories the user deleted (their items show in the Inbox).
    hiddenCategoryGroups: v.optional(v.array(vaultGroupValidator)),

    // Auth methods available on this account. Seeded with the sign-up method
    // ("email" for password/email-OTP accounts, "phone" for phone-OTP) by the
    // `afterUserCreatedOrUpdated` callback in auth.ts; "passkey"/"totp" are
    // appended later as the user enrolls them (webauthn.ts / totp.ts).
    authProviders: v.optional(
      v.array(
        v.union(
          v.literal("passkey"),
          v.literal("email"),
          v.literal("phone"),
          v.literal("totp"),
        ),
      ),
    ),

    // Crypto fields — populated during onboarding (Phase 2)
    // Base64-serialized ML-KEM-768 public key (FIPS 203). Used by other
    // users to wrap per-recipient DEKs for this user.
    publicKey: v.optional(v.string()),
    // JSON envelope { version, phraseSalt, iv, encryptedMasterKey }. The
    // MasterKey is wrapped client-side by a RootKey derived from the user's
    // 24-word phrase via Argon2id; the server never sees plaintext keys.
    encryptedKeyBundle: v.optional(v.string()),
    // JSON { ciphertext, iv } — the user's ML-KEM-768 secret key, AES-GCM
    // wrapped client-side under their MasterKey. Stored separately from
    // `encryptedKeyBundle` to avoid overwriting the MasterKey bundle.
    encryptedAsymmetricSecretKey: v.optional(v.string()),
    // Transitional only — set during a master-key rotation (return-after-release
    // flow). The PREVIOUS owner ML-KEM secret key, re-wrapped under the NEW
    // MasterKey, so items still wrapped to the old keypair stay readable while
    // they are re-encrypted item-by-item. Cleared by `rotation.finalizeRotation`
    // once every item has migrated to the new keypair.
    encryptedAsymmetricSecretKeyPrev: v.optional(v.string()),
    // Identity key (finding #2 — malicious-server key substitution). Base64
    // ML-DSA-65 public key (FIPS 204). The long-lived signing key that binds
    // this user's ML-KEM public key to their identity so contacts can detect a
    // server-substituted encryption key (TOFU + verification land in step 2).
    identityPublicKey: v.optional(v.string()),
    // JSON { ciphertext, iv } — the user's ML-DSA-65 secret key, AES-GCM
    // wrapped client-side under their MasterKey, mirroring
    // `encryptedAsymmetricSecretKey`. The raw identity secret key never reaches
    // the server.
    encryptedIdentitySecretKey: v.optional(v.string()),
    // Base64 ML-DSA-65 signature over this user's ML-KEM public-key bytes,
    // produced with the identity secret key. Binds `publicKey` to
    // `identityPublicKey`; step 2 verifies it before wrapping to this user.
    publicKeySignature: v.optional(v.string()),
    // Per-user salt for Argon2id derivation of the RootKey. Public — served
    // alongside the bundle so the client can re-derive the RootKey on login.
    phraseSalt: v.optional(v.string()),
    recoveryPhraseHash: v.optional(v.string()),
    // The owner turned the cloud backup off: the app stops turning it back on.
    cloudBackupOffAt: v.optional(v.number()),
    recoveryVerified: v.optional(v.boolean()),
    // Set by the v2 shard purge (Oct 2026) for owners whose MasterKey was once
    // Shamir-split to trusted contacts: those shards may still sit on a
    // contact's device, so the owner must rotate the MasterKey. Cleared by
    // `rotation.finalizeRotation`.
    masterKeyRotationRequired: v.optional(v.boolean()),
    // Set when the social-recovery material must be renewed (new generation):
    // after a MasterKey rotation, or a cancelled request that already
    // collected contact shares. Cleared by `recovery_node.setup`.
    socialRecoveryRenewalRequired: v.optional(v.boolean()),
    deletionScheduledAt: v.optional(v.number()),
    deletionJobId: v.optional(v.id("_scheduled_functions")),
    // SHA-256 hex of a PBKDF2 verifier derived from the recovery phrase with
    // a TOTP-specific salt. Set when the user opts in to seed-based 2FA reset.
    totpResetVerifierHash: v.optional(v.string()),

    // Legal identity — collected during onboarding for succession admissibility.
    // birthday: Unix ms of birth date; used for age verification (>=18) and
    // identification in succession proceedings.
    birthday: v.optional(v.number()),
    // country: ISO-3166-1 alpha-2 code of declared residence at signup;
    // determines applicable inheritance jurisdiction.
    country: v.optional(v.string()),
    // Timestamp when the user confirmed their legal info — proof of consent.
    legalInfoConfirmedAt: v.optional(v.number()),

    onboardingStep: v.optional(
      v.union(
        v.literal("auth_complete"),
        v.literal("legal_info"),
        v.literal("recovery_phrase"),
        v.literal("verification"),
        v.literal("key_generation"),
        v.literal("complete"),
      ),
    ),

    // Timestamp (ms) at which the post-onboarding welcome message (email +
    // WhatsApp) was scheduled. Set once in `storeKeyBundle`; its presence is the
    // idempotency guard that stops a second `storeKeyBundle` from re-sending.
    welcomeSentAt: v.optional(v.number()),

    // No `createdAt` — Convex stamps `_creationTime` on every document; use it.
    updatedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),

    // Set by @convex-dev/auth after a successful email OTP verification.
    emailVerificationTime: v.optional(v.number()),

    // Timestamp (ms) at which the user verified ownership of their WhatsApp
    // number via a 6-digit OTP delivered through the WhatsApp Business API.
    // Cleared if the phone number is changed afterward.
    phoneNumberVerifiedAt: v.optional(v.number()),

    // Billing tier. Absent = "free". Written only by the RevenueCat webhook
    // (billing.ts): "lifetime" after an in-app purchase, back to "free" when
    // it is refunded or restored onto another account; never set
    // client-side. Drives the storage quota (see lib/plans.ts).
    plan: v.optional(planValidator),
    // Legacy: Stripe Customer id of buyers from the former web Checkout. No
    // longer written; kept so existing rows still validate.
    stripeCustomerId: v.optional(v.string()),

    // Back-office role. Absent = a normal product user. "admin" grants access
    // to the keeplas-admin analytics console (gated server-side by
    // `requireAdmin`). Never set client-side — assigned out-of-band.
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  })
    .index("email", ["email"])
    .index("by_last_seen", ["lastSeenAt"])
    .index("by_phone", ["phoneNumber"]),

  // ═══════════════════════════════════════════════
  // PAYMENTS (RevenueCat in-app purchases on mobile)
  // ═══════════════════════════════════════════════

  // One row per completed Lifetime purchase. Serves two purposes: webhook
  // idempotency (a re-delivered event finds the existing row by its store
  // transaction id and no-ops) and a billing/receipt history for the user.
  // No provider secret ever touches this table.
  payments: defineTable({
    userId: v.id("users"),
    // Legacy: rows from the former Stripe web Checkout. No longer written;
    // kept so existing rows still validate.
    stripeSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    // App Store / Play transaction id relayed by the RevenueCat webhook.
    revenueCatTransactionId: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string(),
    plan: planValidator,
    // "refunded" once the store refunds it (RevenueCat CANCELLATION), back to
    // "paid" if Apple reverses the refund.
    status: v.union(v.literal("paid"), v.literal("refunded")),
    createdAt: v.number(),
  })
    .index("by_revenuecat_transaction", ["revenueCatTransactionId"])
    .index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // PHONE VERIFICATION (WhatsApp OTP)
  // ═══════════════════════════════════════════════

  phone_verification_codes: defineTable({
    userId: v.id("users"),
    // E.164 snapshot at time of issuance — invalidates the code if the user
    // changes phone before submitting it.
    phoneNumber: v.string(),
    // SHA-256 hex of the 6-digit OTP. Plaintext is never stored.
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_expires", ["userId", "expiresAt"]),

  // Pre-auth OTP for passwordless phone accounts (signup/login). Keyed by
  // phone, NOT userId: at signup no user exists yet, and the credentials
  // provider's authorize() runs without an auth context. Mirrors
  // phone_verification_codes' hashing/expiry/attempts semantics.
  phone_auth_codes: defineTable({
    phoneNumber: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    // "number_change": sent to the new number of an approved lost-number
    // request (number_change.ts), consumed by the `number-change` provider.
    intent: v.union(
      v.literal("signup"),
      v.literal("signin"),
      v.literal("number_change"),
    ),
  }).index("by_phone", ["phoneNumber"]),

  // Lost number, no 24 words (cases B / D / F): a request made signed out
  // with the old number. It waits 72 h with alerts on every channel ("It
  // wasn't me" cancels it) and a support review of non-encrypted details in
  // the admin console. Completing it changes the number and signs in; the
  // vault still needs the cloud backup, the 24 words or two contacts.
  number_change_requests: defineTable({
    userId: v.id("users"),
    oldPhone: v.string(),
    newPhone: v.string(),
    // What the requester declared, compared by support with the account.
    declaredName: v.string(),
    declaredEmail: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
    // SHA-256 of the secret the requesting phone keeps to follow and
    // complete the request (it holds no session yet).
    claimHash: v.string(),
    createdAt: v.number(),
    windowEndsAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
    closedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ═══════════════════════════════════════════════
  // EMAIL VERIFICATION / AUTH (passwordless email OTP)
  // ═══════════════════════════════════════════════

  // Settings-side add+verify of an email (authenticated). Mirrors
  // phone_verification_codes: keyed by userId, consumed to link an `email-otp`
  // auth account to the current user.
  email_verification_codes: defineTable({
    userId: v.id("users"),
    // Normalized (lowercased) email snapshot at issuance — invalidates the
    // code if the pending email changes before submission.
    email: v.string(),
    // SHA-256 hex of the 6-digit OTP. Plaintext is never stored.
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_expires", ["userId", "expiresAt"]),

  // Pre-auth OTP for passwordless email accounts (signup/login). Keyed by
  // email, NOT userId — sibling of phone_auth_codes for the `email-otp`
  // ConvexCredentials provider whose authorize() runs without an auth context.
  email_auth_codes: defineTable({
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    intent: v.union(v.literal("signup"), v.literal("signin")),
  }).index("by_email", ["email"]),

  // ═══════════════════════════════════════════════
  // PASSKEYS (WebAuthn credentials)
  // ═══════════════════════════════════════════════

  passkey_credentials: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    deviceName: v.string(),
    backedUp: v.optional(v.boolean()),
    deviceType: v.optional(
      v.union(v.literal("singleDevice"), v.literal("multiDevice")),
    ),
    // Device (browser / phone) the passkey was created on; deleted with it
    // when the device is revoked, so a revoked browser cannot sign in again.
    keeplasDeviceId: v.optional(v.id("devices")),
    createdAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_credential_id", ["credentialId"])
    .index("by_keeplas_device", ["keeplasDeviceId"]),

  webauthn_challenges: defineTable({
    challenge: v.string(),
    kind: v.union(v.literal("registration"), v.literal("authentication")),
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    expiresAt: v.number(),
  })
    .index("by_challenge", ["challenge"])
    .index("by_expiry", ["expiresAt"]),

  // ═══════════════════════════════════════════════
  // OWNER RECOVERY WITH TRUST CONTACTS (v2 workflow 7, F3)
  // ═══════════════════════════════════════════════
  //
  // A random Recovery Secret RS is split 2-of-n between trust contacts; a
  // random gate key G is held under KMS; the social envelope is
  // AES-GCM(HKDF(RS ‖ G), MasterKey). One current generation per user; a new
  // setup replaces the previous rows.

  // One row per user: the current generation's sealed MasterKey.
  social_envelopes: defineTable({
    userId: v.id("users"),
    generation: v.number(),
    envelope: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ML-KEM envelope of one Shamir share of RS, sealed to a trust contact.
  recovery_secret_shares: defineTable({
    userId: v.id("users"),
    contactId: v.id("trusted_contacts"),
    generation: v.number(),
    wrappedShare: v.string(),
  })
    .index("by_user_generation", ["userId", "generation"])
    .index("by_contact", ["contactId"]),

  // G encrypted by the KMS; only `recovery_node.release` decrypts it.
  gate_keys: defineTable({
    userId: v.id("users"),
    generation: v.number(),
    kmsCiphertext: v.string(),
  }).index("by_user_generation", ["userId", "generation"]),

  recovery_requests: defineTable({
    userId: v.id("users"),
    generation: v.number(),
    // ML-KEM-768 public key of the recovering device.
    newDevicePublicKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved_1"),
      v.literal("approved_2"),
      v.literal("released"),
      v.literal("rotated"),
      v.literal("cancelled"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    // createdAt + 72 h (D3): G is never released before.
    windowEndsAt: v.number(),
    // createdAt + 7 days: pending / approved_1 expire.
    expiresAt: v.number(),
    // G sealed to `newDevicePublicKey`, set at release.
    wrappedGateKey: v.optional(v.string()),
    releasedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  recovery_approvals: defineTable({
    requestId: v.id("recovery_requests"),
    contactId: v.id("trusted_contacts"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    rejectReason: v.optional(
      v.union(v.literal("declined"), v.literal("code_mismatch")),
    ),
    // RS share re-sealed to the device key + ML-DSA-65 signature.
    wrappedShareForDevice: v.optional(v.string()),
    signature: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_request", ["requestId"]),

  // iCloud Keychain / Google Block Store backup (workflows 10–11, D7):
  // AES-GCM(CBK, RootKey). CBK lives only in the platform keychain.
  cloud_backup_envelopes: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("icloud"), v.literal("google")),
    envelope: v.string(),
    // users.phraseSalt of the key bundle the sealed RootKey opens: a new kit
    // (new 24 words) makes the envelope stale until the phone re-seals it.
    phraseSalt: v.optional(v.string()),
    createdAt: v.number(),
    lastRestoredAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // MOBILE SIGN-UP ATTESTATION (App Attest / Play Integrity, M09-9)
  // ═══════════════════════════════════════════════

  // One-time challenge the app attests over (5 min).
  attestation_challenges: defineTable({
    challenge: v.string(),
    expiresAt: v.number(),
  }),

  // Verified attestation for a phone number (10 min, single use). A sign-up
  // OTP is only issued against one of these.
  signup_attestations: defineTable({
    phoneNumber: v.string(),
    platform: v.union(
      v.literal("ios"),
      v.literal("android"),
      v.literal("simulator"),
    ),
    expiresAt: v.number(),
  }).index("by_phone", ["phoneNumber"]),

  // ═══════════════════════════════════════════════
  // DEVICES + QR PAIRING (v2 workflow 8)
  // ═══════════════════════════════════════════════

  // One row per phone / browser linked to the account (W04-6, M08-3).
  devices: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    // Human label derived from the user agent, e.g. "Chrome on Mac".
    label: v.string(),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    // ML-KEM-768 public key of the device (for handoffs to it).
    devicePublicKey: v.optional(v.string()),
    // True when the user ticked "Trust this browser".
    trusted: v.boolean(),
    // Convex Auth session the device registered from; ended on revoke.
    sessionId: v.optional(v.id("authSessions")),
    // Expo push token of a phone, for security alerts (mobile only).
    pushToken: v.optional(v.string()),
    // Set when the owner answered "It was me" (M08-4). The first device of
    // an account is acknowledged at registration.
    acknowledgedAt: v.optional(v.number()),
    lastSeenAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_push_token", ["pushToken"]),

  // Short-lived QR handoff from a signed-in phone to a new browser. Convex
  // only relays ciphertext: the MasterKey envelope is sealed by the phone to
  // the browser's ephemeral ML-KEM key. Each row is purged at `expiresAt`
  // (scheduled at creation), so no envelope outlives the 2-minute window.
  // W06-7 "Scan with my phone": the browser shows a QR, the owner's phone
  // claims it, scans and seals the pages itself, then createItem completes
  // the handoff so the browser can open the new item. No content here.
  capture_handoffs: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("waiting"),
      v.literal("claimed"),
      v.literal("completed"),
    ),
    // The QR is scannable until then (2 min); the row is purged later.
    expiresAt: v.number(),
    itemId: v.optional(v.id("vault_items")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  pairing_sessions: defineTable({
    // Ephemeral ML-KEM-768 public key of the new browser (base64).
    browserPublicKey: v.string(),
    // SHA-256 of the browser-held login secret; the secret is never stored.
    // Only the browser that created the session can redeem the login.
    secretHash: v.string(),
    userAgent: v.string(),
    // Server-attested country of the browser (from the sealed `_audit`).
    approxLocation: v.optional(v.string()),
    status: v.union(
      v.literal("waiting"),
      v.literal("approved"),
      v.literal("consumed"),
      v.literal("rejected"),
    ),
    // Set when the phone approves or rejects.
    userId: v.optional(v.id("users")),
    // ML-KEM + AES-GCM envelope of the MasterKey, read once.
    envelope: v.optional(v.string()),
    // ML-DSA-65 signature over the envelope by the approving device.
    approvalSignature: v.optional(v.string()),
    // Starts the 60 s login-token window.
    approvedAt: v.optional(v.number()),
    // Set when the `pairing` auth provider consumes the login token.
    redeemedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }),

  // ═══════════════════════════════════════════════
  // TOTP (RFC 6238 authenticator-app secrets)
  // ═══════════════════════════════════════════════

  totp_secrets: defineTable({
    userId: v.id("users"),
    // Base32-encoded 20-byte HMAC-SHA1 secret. Stored server-side so we can
    // verify codes; treated as a high-value credential alongside password
    // hashes. Must never leave the backend after enrollment.
    //
    // DELIBERATELY NOT encrypted at rest. Server-side TOTP verification needs
    // the plaintext seed at every check, and any wrapping key would live in
    // the same deployment env as this table — an attacker with DB read access
    // (the threat encryption-at-rest defends) would also reach that key, so
    // the wrap buys almost nothing while adding key-management + migration
    // cost. Mitigations instead: `totp_secrets` is never logged or exported
    // (no query returns `secret`; audit metadata never includes it), and the
    // recovery-phrase escape hatch lets a user re-enrol if a seed is exposed.
    // Revisit if a dedicated KMS/HSM with an out-of-deployment key is added.
    secret: v.string(),
    label: v.optional(v.string()),
    // Set when the user has confirmed enrollment by entering a valid code.
    // Rows without verifiedAt are pending enrollments and may be replaced.
    verifiedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    // Time step (30 s counter) of the last accepted code: a code at or before
    // it is refused, so each code works once. Unset on rows that predate it.
    lastUsedCounter: v.optional(v.number()),
    // Wrong codes in the current lockout window (reset on success).
    failedAttempts: v.optional(v.number()),
    lastFailedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Marker that a Convex Auth session has cleared the TOTP step. Sessions
  // without a row here are blocked from TOTP-gated functions when the user
  // has TOTP enrolled. Rows live as long as the underlying authSessions row.
  auth_session_totp: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    verifiedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // LOGIN OTP (always-on step-up at every login)
  // ═══════════════════════════════════════════════

  // Pending login-OTP code, mirroring phone_verification_codes but
  // channel-aware (delivered on the account's email or WhatsApp).
  login_otp_codes: defineTable({
    userId: v.id("users"),
    channel: v.union(v.literal("email"), v.literal("whatsapp")),
    // Email address or E.164 phone snapshot at issuance — invalidates the
    // code if the destination changes before the user submits it.
    destination: v.string(),
    // SHA-256 hex of the 6-digit OTP. Plaintext is never stored.
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_expires", ["userId", "expiresAt"]),

  // Per-IP throttle for unauthenticated, enumeration-prone endpoints (e.g. the
  // recovery-phrase salt lookups). One row per hit, keyed `${scope}:${ip}`;
  // `enforceIpRateLimit` (lib/rate_limit.ts) counts rows in the trailing
  // window and prunes expired ones opportunistically.
  ip_rate_limits: defineTable({
    key: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["key"]),

  // Marker that a Convex Auth session has cleared the login-OTP step.
  // Login OTP is always required, so a session without a row here is
  // blocked from the dashboard. Rows live as long as the authSessions row.
  auth_session_login_otp: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    verifiedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // What a session has proven beyond its sign-in (session_proofs.ts).
  // "phone": a WhatsApp code reached the account's number in this session
  // (phone-otp sign-in, or the in-session code). Restoring the cloud backup
  // or asking contacts to recover needs it, so a synced passkey alone does
  // not open a vault.
  // "vault": the session opened the vault (identity-key signature, or the
  // 24-word verifier at a recovery sign-in). Resets TOTP, changes the number.
  // Rows live as long as the authSessions row.
  auth_session_proofs: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    kind: v.union(v.literal("phone"), v.literal("vault")),
    verifiedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  // Single-use nonce the identity key signs for the "vault" proof.
  session_vault_challenges: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    nonce: v.string(),
    expiresAt: v.number(),
  }).index("by_session", ["sessionId"]),

  // Pending in-session WhatsApp code that grants the "phone" proof.
  session_phone_codes: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    // E.164 snapshot at issuance: the code is void if the number changed.
    phoneNumber: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  }).index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // VAULTS
  // ═══════════════════════════════════════════════

  vaults: defineTable({
    userId: v.id("users"),

    encryptedItemsCount: v.number(),
    // Stamped on creation; read by the recipient UI to show a "Verified Xm ago"
    // badge.
    lastVerifiedAt: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // VAULT ITEMS
  // ═══════════════════════════════════════════════

  vault_items: defineTable({
    vaultId: v.id("vaults"),
    userId: v.id("users"),

    // Legacy plaintext category (F4). New writes put it in `encryptedMeta`;
    // the owner's client backfills old rows (vault_items.backfillItemMeta).
    // Dropped once `vault_items.countPlaintextMetadata` reaches zero.
    category: v.optional(categoryValidator),
    // Item metadata (JSON {v:1, category}) under the item DEK, same
    // {ciphertext, iv} envelope as `encryptedContent`.
    encryptedMeta: v.optional(v.string()),

    // Legacy plaintext title. Kept optional only to read rows not yet migrated
    // to `encryptedTitle`; new writes never set it. Removed once the
    // client-side backfill has converged (see vault_items.backfillItemTitle).
    title: v.optional(v.string()),
    // Encrypted item title — same per-item DEK + JSON {ciphertext, iv} envelope
    // as `encryptedContent`. Under the owner/recipient-wrapped DEK for ZK items,
    // under the master key for legacy `aes_256_gcm` items.
    encryptedTitle: v.optional(v.string()),
    encryptedContent: v.string(),
    // Optional encrypted JSON array of URLs attached to this item. Encrypted
    // with the same per-item DEK as encryptedContent — payload is a self
    // contained JSON envelope (ciphertext + iv) just like encryptedContent.
    // Omitted entirely when the item has no links.
    encryptedLinks: v.optional(v.string()),
    encryptionType: v.union(
      v.literal("aes_256_gcm"),
      v.literal("zero_knowledge"),
    ),
    sharedWithContacts: v.array(v.id("trusted_contacts")),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    // Contacts the owner intended to share with at save time but whose
    // encryption key wasn't yet publishable (`unverifiable`): no wrapped DEK
    // row exists for them. The owner's client re-wraps the DEK to each one
    // once they publish their key (see vault_items.getItemsNeedingRewrap +
    // useBackfillPendingShares), then removes them from this list. The save
    // is never blocked on these — only on signature/fingerprint alarms.
    pendingRecipients: v.optional(v.array(v.id("trusted_contacts"))),
    recipientMode: v.optional(
      v.union(v.literal("default"), v.literal("groups"), v.literal("explicit")),
    ),
    // ML-KEM-768 + AES-GCM envelope (JSON: {v, alg, kem, iv, ct}).
    ownerWrappedDek: v.optional(v.string()),
    accessLevel: accessLevelValidator,

    status: v.union(
      v.literal("active"),
      v.literal("draft"),
      v.literal("archived"),
      v.literal("sealed"),
      v.literal("released"),
    ),

    triggerType: v.optional(
      v.union(
        v.literal("life_check_failure"),
        v.literal("time_based"),
        v.literal("manual"),
      ),
    ),
    triggerConfig: v.optional(
      v.object({
        releaseDate: v.optional(v.number()),
      }),
    ),
    releasedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    archivedFromStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("draft"),
        v.literal("sealed"),
        v.literal("released"),
      ),
    ),

    // Former folder of the item, cleared when its category moves into the
    // sealed metadata (folders.migrateItem).
    folderId: v.optional(v.id("folders")),

    // When true, the item is a "release introduction": a welcome message the
    // owner authors for trusted contacts who unlock the memorial vault after
    // release. Hidden from the owner's regular /vault listings and surfaced
    // separately on the memorial page above the categorized items.
    isReleaseIntroduction: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vault", ["vaultId"])
    .index("by_folder", ["folderId"])
    .index("by_status", ["vaultId", "status"])
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_trigger", ["triggerType", "status"]),

  vault_item_versions: defineTable({
    itemId: v.id("vault_items"),
    userId: v.id("users"),
    encryptedTitle: v.optional(v.string()),
    encryptedContent: v.string(),
    encryptedMeta: v.optional(v.string()),
    encryptedLinks: v.optional(v.string()),
    files: v.array(
      v.object({
        storageId: storageRefValidator,
        iv: v.string(),
        encryptedMeta: v.optional(v.string()),
        sizeBucket: v.optional(v.number()),
        order: v.number(),
      }),
    ),
    savedAt: v.number(),
    replacedAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"]),

  // Former v2 folders, being turned into vault_categories by the owner's
  // phone (folders.adopt / folders.migrateItem): each one is deleted once
  // its items carry the category in their sealed metadata.
  folders: defineTable({
    userId: v.id("users"),
    // JSON {ciphertext, iv} under the owner's master key.
    encryptedName: v.string(),
    // The vault category this folder became (set by folders.adopt).
    categoryId: v.optional(v.id("vault_categories")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // User-made vault categories, next to the built-in ones. The name is
  // sealed under the owner's master key; items point at one through the
  // `categoryId` of their sealed metadata, so the server never learns which
  // item is in which category.
  vault_categories: defineTable({
    userId: v.id("users"),
    // JSON {ciphertext, iv} under the owner's master key.
    encryptedName: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Deprecated: folders became categories (access is set per item). Emptied
  // by migrations:dropFolderGrants; drop the table once that has run.
  folder_grants: defineTable({
    folderId: v.id("folders"),
    ownerId: v.id("users"),
    contactId: v.id("trusted_contacts"),
    // "now": readable at once. "after_verification": readable once the
    // owner's release is approved (death confirmed + 72 h grace).
    timing: v.union(v.literal("now"), v.literal("after_verification")),
    // Folder name sealed to the contact's ML-KEM key.
    sealedName: v.string(),
    createdAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_contact", ["contactId"]),

  recipient_groups: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    memberContactIds: v.array(v.id("trusted_contacts")),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  vault_item_recipient_keys: defineTable({
    itemId: v.id("vault_items"),
    contactId: v.id("trusted_contacts"),
    // ML-KEM-768 + AES-GCM envelope (JSON: {v, alg, kem, iv, ct}).
    wrappedDek: v.string(),
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_contact", ["contactId"])
    .index("by_item_contact", ["itemId", "contactId"]),

  // ═══════════════════════════════════════════════
  // VAULT ITEM FILES (encrypted blobs in Convex storage)
  // ═══════════════════════════════════════════════

  vault_item_files: defineTable({
    itemId: v.id("vault_items"),
    userId: v.id("users"),
    storageId: storageRefValidator,

    // Legacy plaintext metadata (F4), read-only until backfilled into
    // `encryptedMeta`; dropped once `countPlaintextMetadata` reaches zero.
    name: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    kind: v.optional(
      v.union(
        v.literal("document"),
        v.literal("audio"),
        v.literal("video"),
        v.literal("image"),
      ),
    ),
    durationSec: v.optional(v.number()),
    // File metadata (JSON {v:1, name, mimeType, size, kind, durationSec?})
    // under the item DEK.
    encryptedMeta: v.optional(v.string()),
    // Stored blob size rounded up to a bucket (lib/storage.ts sizeBucket):
    // enough for the quota, without the exact size in the row.
    sizeBucket: v.optional(v.number()),
    iv: v.string(),

    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"]),

  // Owner of each stored blob, bound when it is first attached (to an item or
  // as an avatar): a handle bound to another account is refused, and only the
  // owner's deletions remove it (lib/storage.ts claimBlob / deleteBlob). Also
  // the inventory of live blobs a move off Convex storage walks
  // (docs/STORAGE_MIGRATION.md).
  storage_blobs: defineTable({
    storageRef: storageRefValidator,
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_storage_ref", ["storageRef"])
    .index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // TRUSTED CONTACTS
  // ═══════════════════════════════════════════════

  trusted_contacts: defineTable({
    userId: v.id("users"),
    contactUserId: v.optional(v.id("users")),

    name: v.string(),
    // At least one of email / phoneNumber is provided (enforced in
    // inviteContact); a contact can be invited by either channel or both.
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    role: contactRoleValidator,

    // Legacy: contacts used to be "trust" or "recipient_only". Every contact
    // is now a trust contact; `migrations:migrateContactTypes` clears this
    // field. Drop it once that migration has run on every deployment.
    contactType: v.optional(
      v.union(v.literal("trust"), v.literal("recipient_only")),
    ),

    // Stamped when the contact's own key material unlocks on /shared-with-me
    // (see useConfirmAvailability) — the periodic availability proof.
    lastVerifiedAt: v.optional(v.number()),

    contactPublicKey: v.optional(v.string()),
    // Identity material mirrored from the contact user's record (finding #2 —
    // malicious-server key substitution). `contactIdentityPublicKey` is the
    // contact's ML-DSA-65 public key; `contactPublicKeySignature` is their
    // ML-DSA signature over `contactPublicKey`'s ML-KEM public-key bytes. The
    // owner verifies the signature before wrapping any DEK to this
    // contact, so a server cannot substitute the encryption key.
    contactIdentityPublicKey: v.optional(v.string()),
    contactPublicKeySignature: v.optional(v.string()),
    // TOFU pin: hex SHA-256 of `contactIdentityPublicKey`, set by the owner the
    // first time they successfully verify this contact's key. If the contact's
    // identity key later changes, the recomputed fingerprint differs from the
    // pin and the owner is blocked from wrapping until they explicitly re-pin.
    pinnedIdentityFingerprint: v.optional(v.string()),

    invitationStatus: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked"),
    ),
    invitationToken: v.string(),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),

    // Availability re-confirmation tracking (weekly cron). `reconfirmReminders`
    // counts nudges sent to a contact whose availability check is stale/missing;
    // `ownerNotifiedUnavailableAt` is stamped once the owner has been alerted to
    // replace an unresponsive contact (prevents repeat owner alerts).
    reconfirmReminders: v.optional(v.number()),
    lastReconfirmAt: v.optional(v.number()),
    ownerNotifiedUnavailableAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_contact_user", ["contactUserId"])
    .index("by_invitation_token", ["invitationToken"]),

  // ═══════════════════════════════════════════════
  // LIFE CHECK CONFIG
  // ═══════════════════════════════════════════════

  life_check_configs: defineTable({
    userId: v.id("users"),

    frequency: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
    ),

    // Inactivity-driven trigger model. Derived from `frequency` at write time
    // (weekly=7d, monthly=30d, quarterly=90d) but stored explicitly
    // so the evaluator can compare without re-mapping. Optional during rollout.
    inactivityThresholdDays: v.optional(v.number()),
    // Last observed user activity (login, navigation). The evaluator only
    // initiates a cycle once `now - lastActivityAt >= inactivityThresholdDays`.
    lastActivityAt: v.optional(v.number()),

    activeChannels: v.array(
      v.object({
        type: v.union(
          v.literal("push"),
          v.literal("email"),
          v.literal("whatsapp"),
        ),
        order: v.number(),
        isEnabled: v.boolean(),
      }),
    ),

    travelModeEnabled: v.boolean(),
    travelModeUntil: v.optional(v.number()),

    isActive: v.boolean(),
    nextCheckAt: v.number(),
    lastCheckAt: v.optional(v.number()),
    // Stage-1 user check-in window length (days). Optional override; defaults
    // to CHECK_IN_WINDOW_DAYS in life_check.ts. Used by the dev fast-test mode.
    checkInWindowDays: v.optional(v.number()),
    // Stage-2 human confirmation. Defaults applied in life_check.ts: threshold
    // 2 trusted contacts, window 7 days. Edited via the release-policy settings.
    confirmationThreshold: v.optional(v.number()),
    confirmationWindowDays: v.optional(v.number()),
    // Set to "abort" once the policy is saved: nothing is released unless a
    // human confirms (v2 F5 retired "release_anyway"). Also marks the policy
    // as set for the Hub.
    fallbackBehavior: v.optional(v.literal("abort")),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_next_check", ["nextCheckAt", "isActive"])
    .index("by_active_activity", ["isActive", "lastActivityAt"]),

  // ═══════════════════════════════════════════════
  // LIFE CHECK CYCLES
  // ═══════════════════════════════════════════════

  life_check_cycles: defineTable({
    userId: v.id("users"),
    configId: v.id("life_check_configs"),

    status: v.union(
      v.literal("running"),
      // Stage 2: the user never replied; trusted contacts are being asked to
      // confirm unavailability before any release.
      v.literal("awaiting_confirmation"),
      v.literal("validated"),
      v.literal("triggered"),
      v.literal("cancelled"),
    ),

    channelsAttempted: v.array(
      v.object({
        channelType: v.string(),
        attemptedAt: v.number(),
        respondedAt: v.optional(v.number()),
        response: v.optional(v.string()),
      }),
    ),

    // IDs of pending scheduled escalations (Convex scheduler). Cancelled when
    // the cycle is validated by passive activity or user tap.
    pendingScheduleIds: v.optional(v.array(v.id("_scheduled_functions"))),

    validatedAt: v.optional(v.number()),
    validatedBy: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    cancelledReason: v.optional(v.string()),

    scheduledAt: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"])
    .index("by_scheduled", ["scheduledAt"]),

  // ═══════════════════════════════════════════════
  // ACCESS REQUESTS
  // ═══════════════════════════════════════════════

  access_requests: defineTable({
    vaultUserId: v.id("users"),
    requestedBy: v.id("trusted_contacts"),

    sectionsRequested: v.array(v.string()),

    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("auto_denied"),
      v.literal("expired"),
      v.literal("revoked"),
    ),

    respondedAt: v.optional(v.number()),
    autoResponseAt: v.number(),

    quorumRequired: v.optional(v.number()),
    quorumReached: v.optional(v.boolean()),
    contactsInitiated: v.optional(v.array(v.id("trusted_contacts"))),
    gracePeriodEndsAt: v.optional(v.number()),
    cancelledDuringGrace: v.optional(v.boolean()),

    reason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vault_user", ["vaultUserId"])
    .index("by_requester", ["requestedBy"])
    .index("by_status", ["vaultUserId", "status"]),

  // ═══════════════════════════════════════════════
  // AUDIT LOGS — IMMUTABLE
  // ═══════════════════════════════════════════════

  audit_logs: defineTable({
    userId: v.id("users"),

    actorType: v.union(
      v.literal("user"),
      v.literal("trusted_contact"),
      v.literal("system"),
      v.literal("ai_assistant"),
    ),
    actorId: v.string(),

    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),

    metadata: v.optional(v.string()),
    // Server-attested IP and ISO-3166-1 alpha-2 country at the time of action.
    // Captured by the Next.js middleware (Vercel geo headers), HMAC-signed,
    // verified inside `auditedMutation` before being persisted here.
    ipAddress: v.optional(v.string()),
    country: v.optional(v.string()),

    previousLogHash: v.string(),
    logHash: v.string(),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["userId", "action"])
    .index("by_created", ["userId", "createdAt"]),

  // ═══════════════════════════════════════════════
  // SUPPORT TICKETS
  // ═══════════════════════════════════════════════

  support_tickets: defineTable({
    userId: v.optional(v.id("users")),

    name: v.string(),
    // Reply-to contact. Exactly one of these is set, depending on the channel
    // the submitter chose (email account → email, phone/WhatsApp account →
    // whatsapp). Both optional so either channel can be omitted.
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    topic: v.union(
      v.literal("general"),
      v.literal("security"),
      v.literal("billing"),
      v.literal("recovery"),
      v.literal("feature_request"),
      v.literal("other"),
    ),
    subject: v.string(),
    message: v.string(),

    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed"),
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status", "createdAt"]),

  // ═══════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════

  notifications: defineTable({
    userId: v.id("users"),

    type: v.union(
      v.literal("life_check"),
      v.literal("access_request"),
      v.literal("contact_invited"),
      v.literal("contact_confirmed"),
      v.literal("vault_update"),
      v.literal("security_alert"),
      v.literal("system"),
    ),

    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
    channels: v.array(v.string()),

    isRead: v.boolean(),
    readAt: v.optional(v.number()),

    relatedId: v.optional(v.string()),
    relatedType: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_unread", ["userId", "isRead"])
    .index("by_type", ["userId", "type"]),

  // ═══════════════════════════════════════════════
  // ANALYTICS EVENTS (product usage — consumed by keeplas-admin)
  // ═══════════════════════════════════════════════
  //
  // Lightweight product-analytics stream emitted by the web app on navigation.
  // Deliberately NOT part of the tamper-evident audit chain (a page view is not
  // an auditable action) — written by the plain `analytics.track` mutation, not
  // `auditedMutation`. To preserve the zero-knowledge model, `route` stores the
  // matched route TEMPLATE (e.g. "/vault/$itemId"), never a resolved path, so no
  // sensitive identifier ever lands here in cleartext.
  analytics_events: defineTable({
    // Absent for pre-auth pages (auth / onboarding) where no user exists yet.
    userId: v.optional(v.id("users")),
    eventType: v.union(v.literal("page_view"), v.literal("session_start")),
    route: v.string(),
    // Server-attested IP + ISO-3166-1 alpha-2 country, lifted from the sealed
    // `_audit` envelope (same source as audit_logs), verified before insert.
    ipAddress: v.optional(v.string()),
    country: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_type_created", ["eventType", "createdAt"]),
});
