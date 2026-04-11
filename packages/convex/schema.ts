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
    phoneNumber: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),

    authProviders: v.optional(
      v.array(
        v.union(
          v.literal("passkey"),
          v.literal("email"),
          v.literal("google"),
          v.literal("apple")
        )
      )
    ),

    passkeyCredentials: v.optional(
      v.array(
        v.object({
          credentialId: v.string(),
          publicKey: v.string(),
          deviceName: v.optional(v.string()),
          createdAt: v.number(),
          lastUsedAt: v.number(),
        })
      )
    ),

    // Crypto fields — populated during onboarding (Phase 2)
    publicKey: v.optional(v.string()),
    encryptedKeyBundle: v.optional(v.string()),
    recoveryPhraseHash: v.optional(v.string()),
    recoveryVerified: v.optional(v.boolean()),
    zkVerifierKey: v.optional(v.string()),
    keeplasShard: v.optional(v.string()),

    onboardingStep: v.optional(
      v.union(
        v.literal("auth_complete"),
        v.literal("recovery_phrase"),
        v.literal("verification"),
        v.literal("key_generation"),
        v.literal("complete")
      )
    ),
    vaultIntegrityScore: v.optional(v.number()),

    isActive: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_last_seen", ["lastSeenAt"]),

  // ═══════════════════════════════════════════════
  // VAULTS
  // ═══════════════════════════════════════════════

  vaults: defineTable({
    userId: v.id("users"),

    status: v.union(
      v.literal("active"),
      v.literal("locked"),
      v.literal("emergency_access"),
      v.literal("suspended")
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
    encryptionType: v.union(
      v.literal("aes_256_gcm"),
      v.literal("zero_knowledge")
    ),
    contentHash: v.string(),

    fileStorageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),

    sharedWithContacts: v.array(v.id("trusted_contacts")),
    accessLevel: accessLevelValidator,

    status: v.union(
      v.literal("active"),
      v.literal("draft"),
      v.literal("archived"),
      v.literal("sealed")
    ),

    tags: v.array(v.string()),
    isCritical: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vault", ["vaultId"])
    .index("by_category", ["vaultId", "category"])
    .index("by_status", ["vaultId", "status"])
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
      v.literal("other")
    ),

    isFirstResponder: v.boolean(),
    isMedicalContact: v.boolean(),

    accessModes: v.array(
      v.union(
        v.literal("mode_a"),
        v.literal("mode_b1"),
        v.literal("mode_b2"),
        v.literal("mode_b3"),
        v.literal("mode_b4")
      )
    ),

    shardIndex: v.number(),
    encryptedShard: v.string(),
    shardPublicKeyUsed: v.string(),
    shardConfirmed: v.boolean(),
    shardConfirmedAt: v.optional(v.number()),

    contactRecoveryHash: v.optional(v.string()),
    contactPublicKey: v.optional(v.string()),

    invitationStatus: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked")
    ),
    invitationToken: v.string(),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),

    proactiveAccess: v.optional(
      v.object({
        sections: v.array(v.string()),
        accessType: v.union(v.literal("read"), v.literal("read_download")),
        expiresAt: v.optional(v.number()),
        isPermanent: v.boolean(),
      })
    ),

    conditionalAccess: v.optional(
      v.object({
        inactivityDays: v.number(),
        sections: v.array(v.string()),
      })
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_contact_user", ["contactUserId"])
    .index("by_shard_index", ["userId", "shardIndex"])
    .index("by_first_responder", ["userId", "isFirstResponder"])
    .index("by_invitation_token", ["invitationToken"]),

  // ═══════════════════════════════════════════════
  // LIFE CHECK CONFIG
  // ═══════════════════════════════════════════════

  life_check_configs: defineTable({
    userId: v.id("users"),

    frequency: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly")
    ),

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
          v.literal("sms"),
          v.literal("ivr_call"),
          v.literal("first_responder")
        ),
        order: v.number(),
        isEnabled: v.boolean(),
        delayHours: v.number(),
      })
    ),

    travelModeEnabled: v.boolean(),
    travelModeUntil: v.optional(v.number()),
    expeditionMode: v.boolean(),

    isActive: v.boolean(),
    nextCheckAt: v.number(),
    lastCheckAt: v.optional(v.number()),
    confidenceThreshold: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_next_check", ["nextCheckAt", "isActive"]),

  // ═══════════════════════════════════════════════
  // LIFE CHECK CYCLES
  // ═══════════════════════════════════════════════

  life_check_cycles: defineTable({
    userId: v.id("users"),
    configId: v.id("life_check_configs"),

    status: v.union(
      v.literal("running"),
      v.literal("validated"),
      v.literal("escalating"),
      v.literal("triggered"),
      v.literal("cancelled")
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
      })
    ),

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
      v.literal("apple_watch")
    ),

    scoreContribution: v.number(),
    detectedAt: v.number(),
    validUntil: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "signalType"])
    .index("by_detected", ["userId", "detectedAt"]),

  // ═══════════════════════════════════════════════
  // ACCESS REQUESTS
  // ═══════════════════════════════════════════════

  access_requests: defineTable({
    vaultUserId: v.id("users"),
    requestedBy: v.id("trusted_contacts"),

    accessMode: v.union(
      v.literal("mode_a"),
      v.literal("mode_b1"),
      v.literal("mode_b2"),
      v.literal("mode_b3"),
      v.literal("mode_b4")
    ),

    sectionsRequested: v.array(v.string()),

    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("auto_denied"),
      v.literal("expired"),
      v.literal("revoked")
    ),

    respondedAt: v.optional(v.number()),
    autoResponseAt: v.number(),
    accessType: v.optional(
      v.union(v.literal("read"), v.literal("read_download"))
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
      v.literal("manual")
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
      v.literal("cancelled")
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
  // SCENARIOS & STEPS
  // ═══════════════════════════════════════════════

  scenarios: defineTable({
    userId: v.id("users"),

    title: v.string(),
    description: v.optional(v.string()),

    status: v.union(
      v.literal("armed"),
      v.literal("paused"),
      v.literal("triggered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),

    isSafePauseActive: v.boolean(),
    safePauseUntil: v.optional(v.number()),

    latentIntegrity: v.number(),
    syncHash: v.string(),
    triggerProtocol: v.string(),

    lastCheckAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"]),

  scenario_steps: defineTable({
    scenarioId: v.id("scenarios"),
    userId: v.id("users"),

    triggerType: v.literal("inactivity_days"),
    triggerValue: v.number(),
    label: v.string(),

    actions: v.array(
      v.object({
        actionType: v.union(
          v.literal("send_message"),
          v.literal("grant_access"),
          v.literal("alert_authority"),
          v.literal("unlock_vault"),
          v.literal("account_wipe")
        ),
        targetContactId: v.optional(v.id("trusted_contacts")),
        config: v.string(),
      })
    ),

    executionStatus: v.union(
      v.literal("pending"),
      v.literal("executed"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    executedAt: v.optional(v.number()),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_scenario", ["scenarioId"])
    .index("by_trigger", ["scenarioId", "triggerValue"]),

  // ═══════════════════════════════════════════════
  // EMERGENCY CARDS
  // ═══════════════════════════════════════════════

  emergency_cards: defineTable({
    userId: v.id("users"),

    fullName: v.optional(v.string()),
    bloodType: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medicalConditions: v.optional(v.string()),
    medications: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelation: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),

    showFullName: v.boolean(),
    showBloodType: v.boolean(),
    showAllergies: v.boolean(),
    showEmergencyContact: v.boolean(),
    showMedicalConditions: v.boolean(),
    showMedications: v.boolean(),
    showAdditionalNotes: v.boolean(),

    qrCodeToken: v.string(),
    qrCodeUrl: v.string(),

    isActive: v.boolean(),
    lastPrintedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_qr_token", ["qrCodeToken"]),

  // ═══════════════════════════════════════════════
  // AUDIT LOGS — IMMUTABLE
  // ═══════════════════════════════════════════════

  audit_logs: defineTable({
    userId: v.id("users"),

    actorType: v.union(
      v.literal("user"),
      v.literal("trusted_contact"),
      v.literal("system"),
      v.literal("ai_assistant")
    ),
    actorId: v.string(),

    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),

    metadata: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceInfo: v.optional(v.string()),

    previousLogHash: v.string(),
    logHash: v.string(),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["userId", "action"])
    .index("by_created", ["userId", "createdAt"]),

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
      v.literal("system")
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
