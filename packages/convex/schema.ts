import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { categoryValidator, accessLevelValidator } from "./validators";

export default defineSchema({
  // Auth tables (managed by @convex-dev/auth)
  ...authTables,

  // ═══════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════

  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    // Convex storage handle for an uploaded avatar image. Tracked so the
    // previous blob can be deleted when the avatar is replaced or the account
    // is wiped; `avatarUrl` holds the resolved serving URL used for display.
    avatarStorageId: v.optional(v.id("_storage")),
    phoneNumber: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),

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
    // users to wrap per-recipient DEKs and shards for this user.
    publicKey: v.optional(v.string()),
    // JSON envelope { version, phraseSalt, iv, encryptedMasterKey }. The
    // MasterKey is wrapped client-side by a RootKey derived from the user's
    // 24-word phrase via Argon2id; the server never sees plaintext keys.
    encryptedKeyBundle: v.optional(v.string()),
    // JSON { ciphertext, iv } — the user's ML-KEM-768 secret key, AES-GCM
    // wrapped client-side under their MasterKey. Stored separately from
    // `encryptedKeyBundle` to avoid overwriting the MasterKey bundle.
    encryptedAsymmetricSecretKey: v.optional(v.string()),
    // Per-user salt for Argon2id derivation of the RootKey. Public — served
    // alongside the bundle so the client can re-derive the RootKey on login.
    phraseSalt: v.optional(v.string()),
    recoveryPhraseHash: v.optional(v.string()),
    recoveryVerified: v.optional(v.boolean()),
    zkVerifierKey: v.optional(v.string()),
    keeplasShard: v.optional(v.string()),
    // Shamir threshold chosen at onboarding: how many trusted contacts must
    // collaborate to reconstruct the MasterKey. Min 2, max 3 (only the 3
    // contact shards participate in contacts-only recovery). Once shards are
    // distributed, changing this requires a full re-split + re-distribution.
    vaultThreshold: v.optional(v.number()),
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
    vaultIntegrityScore: v.optional(v.number()),

    // Soft account state. Stays `v.optional` because @convex-dev/auth inserts
    // the user row before our `afterUserCreatedOrUpdated` callback stamps it;
    // a required field would fail that initial insert. Always `true` once set.
    isActive: v.optional(v.boolean()),
    // No `createdAt` — Convex stamps `_creationTime` on every document; use it.
    updatedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),

    // Set by @convex-dev/auth after a successful email OTP verification.
    emailVerificationTime: v.optional(v.number()),

    // Timestamp (ms) at which the user verified ownership of their WhatsApp
    // number via a 6-digit OTP delivered through the WhatsApp Business API.
    // Cleared if the phone number is changed afterward.
    phoneNumberVerifiedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("by_last_seen", ["lastSeenAt"])
    .index("by_phone", ["phoneNumber"]),

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
    intent: v.union(v.literal("signup"), v.literal("signin")),
  }).index("by_phone", ["phoneNumber"]),

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
    createdAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_credential_id", ["credentialId"]),

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
  // TOTP (RFC 6238 authenticator-app secrets)
  // ═══════════════════════════════════════════════

  totp_secrets: defineTable({
    userId: v.id("users"),
    // Base32-encoded 20-byte HMAC-SHA1 secret. Stored server-side so we can
    // verify codes; treated as a high-value credential alongside password
    // hashes. Must never leave the backend after enrollment.
    secret: v.string(),
    label: v.optional(v.string()),
    // Set when the user has confirmed enrollment by entering a valid code.
    // Rows without verifiedAt are pending enrollments and may be replaced.
    verifiedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
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

  // ═══════════════════════════════════════════════
  // VAULTS
  // ═══════════════════════════════════════════════

  vaults: defineTable({
    userId: v.id("users"),

    status: v.union(
      v.literal("active"),
      v.literal("locked"),
      v.literal("emergency_access"),
      v.literal("suspended"),
    ),
    securityLevel: v.union(v.literal("standard"), v.literal("maximum")),

    integrityScore: v.number(),
    encryptedItemsCount: v.number(),
    secureNodesCount: v.number(),
    lastVerifiedAt: v.number(),

    syncHash: v.string(),
    lastSyncAt: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ═══════════════════════════════════════════════
  // VAULT ITEMS
  // ═══════════════════════════════════════════════

  vault_items: defineTable({
    vaultId: v.id("vaults"),
    userId: v.id("users"),

    category: categoryValidator,

    title: v.string(),
    description: v.optional(v.string()),
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
    contentHash: v.string(),

    sharedWithContacts: v.array(v.id("trusted_contacts")),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    recipientMode: v.optional(
      v.union(v.literal("default"), v.literal("groups"), v.literal("explicit")),
    ),
    // ML-KEM-768 + AES-GCM envelope (JSON: {v, alg, kem, iv, ct}).
    ownerWrappedDek: v.optional(v.string()),
    // Deprecated — IV now lives inside the ownerWrappedDek envelope.
    ownerWrappedDekIv: v.optional(v.string()),
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

    tags: v.optional(v.array(v.string())),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vault", ["vaultId"])
    .index("by_category", ["vaultId", "category"])
    .index("by_status", ["vaultId", "status"])
    .index("by_user", ["userId"])
    .index("by_trigger", ["triggerType", "status"]),

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
    // Deprecated — IV now lives inside the wrappedDek envelope.
    wrappedDekIv: v.optional(v.string()),
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
    storageId: v.id("_storage"),

    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    iv: v.string(),

    kind: v.union(
      v.literal("document"),
      v.literal("audio"),
      v.literal("video"),
      v.literal("image"),
    ),

    durationSec: v.optional(v.number()),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════
  // TRUSTED CONTACTS
  // ═══════════════════════════════════════════════

  trusted_contacts: defineTable({
    userId: v.id("users"),
    contactUserId: v.optional(v.id("users")),

    name: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.union(
      v.literal("family"),
      v.literal("friend"),
      v.literal("lawyer"),
      v.literal("doctor"),
      v.literal("other"),
    ),

    contactType: v.optional(
      v.union(v.literal("trust"), v.literal("recipient_only")),
    ),

    shardIndex: v.optional(v.number()),
    encryptedShard: v.optional(v.string()),
    shardPublicKeyUsed: v.optional(v.string()),
    shardConfirmed: v.optional(v.boolean()),
    shardConfirmedAt: v.optional(v.number()),

    // Round-trip verification: the owner's client wraps a known plaintext to
    // the contact's ML-KEM public key once they accept. The contact can then
    // unwrap it on-device to prove their keypair is functional, without
    // exposing any vault content. `lastVerifiedAt` is stamped on success.
    verificationEnvelope: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),

    contactRecoveryHash: v.optional(v.string()),
    contactPublicKey: v.optional(v.string()),

    invitationStatus: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked"),
    ),
    invitationToken: v.string(),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),

    introMessage: v.optional(v.string()),

    // Availability re-confirmation tracking (weekly cron). `reconfirmReminders`
    // counts nudges sent to a contact whose shard verification is stale/missing;
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
    .index("by_shard_index", ["userId", "shardIndex"])
    .index("by_invitation_token", ["invitationToken"]),

  // ═══════════════════════════════════════════════
  // LIFE CHECK CONFIG
  // ═══════════════════════════════════════════════

  life_check_configs: defineTable({
    userId: v.id("users"),

    frequency: v.union(
      v.literal("test"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
    ),

    // Inactivity-driven trigger model. Derived from `frequency` at write time
    // (test=60s, weekly=7d, monthly=30d, quarterly=90d) but stored explicitly
    // so the evaluator can compare without re-mapping. Optional during rollout.
    inactivityThresholdDays: v.optional(v.number()),
    // Last observed user activity (login, navigation). The evaluator only
    // initiates a cycle once `now - lastActivityAt >= inactivityThresholdDays`.
    lastActivityAt: v.optional(v.number()),

    passiveSignals: v.object({
      appActivity: v.boolean(),
      deviceActivity: v.boolean(),
      gpsMovement: v.boolean(),
      whatsappActivity: v.boolean(),
      googleActivity: v.boolean(),
      healthData: v.boolean(),
      appleWatch: v.boolean(),
    }),

    activeChannels: v.array(
      v.object({
        type: v.union(
          v.literal("push"),
          v.literal("email"),
          v.literal("whatsapp"),
        ),
        order: v.number(),
        isEnabled: v.boolean(),
        // Deprecated: the per-channel escalation cascade was removed in favour
        // of an all-at-once fan-out + reminders. Kept optional during rollout;
        // dropped by the Phase-7 migration.
        delayHours: v.optional(v.number()),
      }),
    ),

    travelModeEnabled: v.boolean(),
    travelModeUntil: v.optional(v.number()),
    expeditionMode: v.boolean(),

    isActive: v.boolean(),
    nextCheckAt: v.number(),
    lastCheckAt: v.optional(v.number()),
    // Stage-1 user check-in window length (days). Optional override; defaults
    // to CHECK_IN_WINDOW_DAYS in life_check.ts. Used by the dev fast-test mode.
    checkInWindowDays: v.optional(v.number()),
    // Stage-2 human confirmation. Defaults applied in life_check.ts: threshold
    // 2 trusted contacts, window 7 days, fallback "abort" (release nothing
    // unless a human confirms). Edited via the release-policy settings (Phase 6).
    confirmationThreshold: v.optional(v.number()),
    confirmationWindowDays: v.optional(v.number()),
    fallbackBehavior: v.optional(
      v.union(v.literal("abort"), v.literal("release_anyway")),
    ),
    confidenceThreshold: v.number(),

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
      // Legacy (pre-redesign cascade); removed by the Phase-7 migration.
      v.literal("escalating"),
      v.literal("triggered"),
      v.literal("cancelled"),
    ),

    passiveScore: v.number(),
    passiveValidatedAt: v.optional(v.number()),
    passiveSignalUsed: v.optional(v.string()),

    currentLevel: v.number(),
    levelReachedAt: v.optional(v.number()),

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
  // PASSIVE SIGNALS
  // ═══════════════════════════════════════════════

  passive_signals: defineTable({
    userId: v.id("users"),
    cycleId: v.optional(v.id("life_check_cycles")),

    signalType: v.union(
      v.literal("app_activity"),
      v.literal("device_unlock"),
      v.literal("gps_movement"),
      v.literal("whatsapp_presence"),
      v.literal("google_activity"),
      v.literal("health_data"),
      v.literal("apple_watch"),
    ),

    scoreContribution: v.number(),
    detectedAt: v.number(),
    validUntil: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "signalType"])
    .index("by_detected", ["userId", "detectedAt"]),

  // ═══════════════════════════════════════════════
  // PUSH SUBSCRIPTIONS (Web Push)
  // ═══════════════════════════════════════════════

  push_subscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    deviceLabel: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

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
    accessType: v.optional(
      v.union(v.literal("read"), v.literal("read_download")),
    ),
    accessExpiresAt: v.optional(v.number()),

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
  // RECOVERY SHARD SUBMISSIONS (post-mortem reconstruction)
  // ═══════════════════════════════════════════════
  //
  // When an access_request reaches its quorum and the 72h grace window
  // expires, each participating trust contact submits their stored shard.
  // To preserve zero-knowledge, the raw shard is never sent to the server:
  // each submitter wraps a copy of their shard to every OTHER trust contact's
  // ML-KEM public key, then uploads the resulting fan-out as one row per
  // (submitter, recipient) pair.
  //
  // Any contact who is one of the submitters can later fetch the rows where
  // they are `recipientContactId`, unwrap them with their own private key,
  // and combine those raw shards with their own to reconstruct the master
  // key — entirely on-device.

  recovery_shard_submissions: defineTable({
    accessRequestId: v.id("access_requests"),
    vaultUserId: v.id("users"),
    submitterContactId: v.id("trusted_contacts"),
    recipientContactId: v.id("trusted_contacts"),
    // ML-KEM-768 + AES-GCM envelope wrapping the submitter's raw Shamir share.
    // Only `recipientContactId` (the holder of the matching private key) can
    // decrypt this row.
    wrappedShard: v.string(),
    createdAt: v.number(),
  })
    .index("by_request", ["accessRequestId"])
    .index("by_request_recipient", ["accessRequestId", "recipientContactId"])
    .index("by_request_submitter", ["accessRequestId", "submitterContactId"]),

  // ═══════════════════════════════════════════════
  // CONDITIONAL MESSAGES
  // ═══════════════════════════════════════════════

  conditional_messages: defineTable({
    userId: v.id("users"),
    vaultItemId: v.id("vault_items"),

    title: v.string(),
    encryptedContent: v.string(),

    recipients: v.array(v.id("trusted_contacts")),

    triggerType: v.union(
      v.literal("life_check_failure"),
      v.literal("time_based"),
      v.literal("age_based"),
      v.literal("legal_event"),
      v.literal("manual"),
    ),
    triggerConfig: v.object({
      inactivityDays: v.optional(v.number()),
      releaseDate: v.optional(v.number()),
      recipientAge: v.optional(v.number()),
      legalEventDesc: v.optional(v.string()),
    }),

    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("sealed"),
      v.literal("released"),
      v.literal("cancelled"),
    ),

    encryptionType: v.literal("zero_knowledge"),
    curatorsRequired: v.number(),

    releasedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"])
    .index("by_trigger", ["triggerType", "status"]),

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
    deviceInfo: v.optional(v.string()),

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
    email: v.string(),
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
});
