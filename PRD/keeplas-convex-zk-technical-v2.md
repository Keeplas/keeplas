# Keeplas — Technical Architecture: Convex, ZK & Recovery

> Technical document — April 2026 — v1

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Client / Server Separation](#2-client--server-separation)
3. [Complete Convex Schema](#3-complete-convex-schema)
4. [Passkey (WebAuthn) — Recommended Auth](#4-passkey-webauthn--recommended-auth)
5. [Zero Knowledge & Cryptography](#5-zero-knowledge--cryptography)
6. [Recovery — Complete Flows](#6-recovery--complete-flows)
7. [Convex Functions Logic](#7-convex-functions-logic)
8. [Scheduled Functions — Life Check](#8-scheduled-functions--life-check)
9. [Convex File Structure](#9-convex-file-structure)

---

## 1. Core Principles

### Absolute rule

> **Anything secret never touches the Convex server.**

Convex is a coordination and storage server. It never knows:

- The Master Key
- The Recovery Phrase
- The Shamir shards in clear
- The decrypted vault content

It only stores encrypted data that it cannot read.

### Responsibilities per layer

```
packages/crypto/     ← Secrets, encryption, ZK proofs
    zk/              ← ZK Proof generation (Noir/Barretenberg)
    aes/             ← AES-256-GCM encryption (Web Crypto API)
    shamir/          ← Shamir split and reconstruction
    recovery/        ← BIP-39, Master Key derivation

convex/              ← Storage and coordination
    schema.ts        ← Tables (encrypted data only)
    users.ts         ← User CRUD
    vault.ts         ← Encrypted vault item CRUD
    lifeCheck.ts     ← Scheduling, cycles, passive signals
    trustedContacts.ts ← Contact management and encrypted shards
    accessRequests.ts  ← Access modes A/B
    zkVerification.ts  ← ZK Proof verification (not generation)
    scenarios.ts     ← Scenario Engine
    auditLogs.ts     ← Immutable log
    notifications.ts ← Notifications
```

---

## 2. Client / Server Separation

### What Convex stores vs what it never sees

| Data                       | Client only             | Convex stores                     |
| -------------------------- | ----------------------- | --------------------------------- |
| Master Key                 | ✅ Generated locally    | ❌ Never                          |
| Recovery Phrase (24 words) | ✅ Shown once           | ❌ Never                          |
| Shamir shards in clear     | ✅ Local reconstruction | ❌ Never                          |
| Vault decryption           | ✅ Browser-side         | ❌ Never                          |
| ZK Proof computation       | ✅ Noir/Barretenberg    | ❌ Never                          |
| Recovery Phrase hash       | —                       | ✅ sha256 only                    |
| Encrypted shards           | —                       | ✅ Unreadable without private key |
| Encrypted vault items      | —                       | ✅ Unreadable without Master Key  |
| User Public Key            | —                       | ✅ Not secret                     |
| Metadata (title, date)     | —                       | ✅ In clear                       |
| ZK Proof verification      | —                       | ✅ Verify ≠ know                  |
| Audit logs                 | —                       | ✅ Immutable                      |
| Life Check config          | —                       | ✅ In clear                       |

### What Convex actually sees in each table

```typescript
// users — what Convex sees
{
  email: "user@example.com",
  publicKey: "0x04a3f8b...",           // Public key, not secret
  encryptedKeyBundle: "U2FsdGVk...",   // Master Key encrypted with biometrics
                                        // Convex CANNOT decrypt
  recoveryPhraseHash: "sha256:abc...", // Hash to verify without knowing
  keeplasShard: "U2FsdGVk...",         // Shard 5 encrypted by ZK proof
}

// vault_items — what Convex sees
{
  title: "Passport Scan",              // Metadata in clear
  encryptedContent: "U2FsdGVk...",    // Content unreadable without Master Key
  contentHash: "sha256:xyz...",        // Integrity only
}

// trusted_contacts — what Convex sees
{
  shardIndex: 2,
  encryptedShard: "U2FsdGVk...",      // Shard encrypted with the contact's public key
                                        // Only the contact can decrypt it
  shardPublicKeyUsed: "0x04b2c...",
}
```

---

## 3. Complete Convex Schema

```typescript
// packages/convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════

  users: defineTable({
    // Identity
    email: v.optional(v.string()), // Optional if Passkey-only
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()), // "fr" | "en" | "sw"

    // Auth — array to support several methods simultaneously
    authProviders: v.array(
      v.union(
        v.literal("passkey"), // ← Recommended first
        v.literal("email"),
        v.literal("google"),
        v.literal("apple"),
      ),
    ),

    // Passkey / WebAuthn — several devices possible
    passkeyCredentials: v.optional(
      v.array(
        v.object({
          credentialId: v.string(), // Unique Passkey ID
          publicKey: v.string(), // WebAuthn public key
          deviceName: v.optional(v.string()), // "Prince's iPhone"
          createdAt: v.number(),
          lastUsedAt: v.number(),
        }),
      ),
    ),

    // ZK — public keys only on the server side
    publicKey: v.string(), // EC public key
    encryptedKeyBundle: v.string(), // Master Key encrypted with biometrics/passkey
    recoveryPhraseHash: v.string(), // sha256(phrase) — verification
    recoveryVerified: v.boolean(),
    zkVerifierKey: v.string(), // Noir circuit public key

    // Shard 5 — held by Keeplas, ZK-encrypted
    keeplasShard: v.string(), // Unreadable without a valid ZK proof

    // Onboarding
    onboardingStep: v.union(
      v.literal("recovery_phrase"),
      v.literal("dashboard"),
      v.literal("complete"),
    ),
    vaultIntegrityScore: v.number(), // 0-100

    // Status
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
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
      v.literal("suspended"),
    ),
    securityLevel: v.union(v.literal("standard"), v.literal("maximum")),

    // Integrity
    integrityScore: v.number(),
    encryptedItemsCount: v.number(),
    secureNodesCount: v.number(),
    lastVerifiedAt: v.number(),

    // Sync
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

    category: v.union(
      v.literal("personal_document"),
      v.literal("financial_asset"),
      v.literal("digital_asset"),
      v.literal("health_directive"),
      v.literal("legal_document"),
      v.literal("business_continuity"),
      v.literal("conditional_message"),
      v.literal("personal_message"),
      v.literal("credential"),
    ),

    // Content — encrypted, unreadable by Convex
    title: v.string(), // Metadata in clear
    description: v.optional(v.string()),
    encryptedContent: v.string(), // AES-256-GCM
    encryptionType: v.union(
      v.literal("aes_256_gcm"),
      v.literal("zero_knowledge"),
    ),
    contentHash: v.string(), // Integrity verification

    // Files
    fileStorageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),

    // Access
    sharedWithContacts: v.array(v.id("trusted_contacts")),
    accessLevel: v.union(
      v.literal("private"),
      v.literal("trusted_only"),
      v.literal("emergency_only"),
      v.literal("public"),
    ),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("draft"),
      v.literal("archived"),
      v.literal("sealed"),
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
    userId: v.id("users"), // Vault owner
    contactUserId: v.optional(v.id("users")), // If a Keeplas account

    // Identity
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

    // Special designations
    isFirstResponder: v.boolean(),
    isMedicalContact: v.boolean(),

    // Permissions
    accessModes: v.array(
      v.union(
        v.literal("mode_a"),
        v.literal("mode_b1"),
        v.literal("mode_b2"),
        v.literal("mode_b3"),
        v.literal("mode_b4"),
      ),
    ),

    // Shamir shard — encrypted with the contact's public key
    shardIndex: v.number(), // 1-5
    encryptedShard: v.string(), // Unreadable without the contact's private key
    shardPublicKeyUsed: v.string(), // Public key used
    shardConfirmed: v.boolean(),
    shardConfirmedAt: v.optional(v.number()),

    // Contact recovery
    contactRecoveryHash: v.optional(v.string()), // sha256(contact recovery phrase)
    contactPublicKey: v.optional(v.string()), // Contact's public key

    // Invitation
    invitationStatus: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked"),
    ),
    invitationToken: v.string(), // Secure token (72h)
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),

    // Proactive access B2
    proactiveAccess: v.optional(
      v.object({
        sections: v.array(v.string()),
        accessType: v.union(v.literal("read"), v.literal("read_download")),
        expiresAt: v.optional(v.number()),
        isPermanent: v.boolean(),
      }),
    ),

    // Conditional access B4
    conditionalAccess: v.optional(
      v.object({
        inactivityDays: v.number(),
        sections: v.array(v.string()),
      }),
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
      v.literal("quarterly"),
    ),

    // Passive signals (opt-in)
    passiveSignals: v.object({
      appActivity: v.boolean(), // Always true
      deviceActivity: v.boolean(),
      gpsMovement: v.boolean(),
      whatsappActivity: v.boolean(),
      googleActivity: v.boolean(),
      healthData: v.boolean(),
      appleWatch: v.boolean(),
    }),

    // Ordered active channels
    activeChannels: v.array(
      v.object({
        type: v.union(
          v.literal("push"),
          v.literal("email"),
          v.literal("whatsapp"),
          v.literal("sms"),
          v.literal("ivr_call"),
          v.literal("first_responder"),
        ),
        order: v.number(),
        isEnabled: v.boolean(),
        delayHours: v.number(),
      }),
    ),

    // Special cases
    travelModeEnabled: v.boolean(),
    travelModeUntil: v.optional(v.number()),
    expeditionMode: v.boolean(),

    // Status
    isActive: v.boolean(),
    nextCheckAt: v.number(),
    lastCheckAt: v.optional(v.number()),
    confidenceThreshold: v.number(), // Default: 50 pts

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
      v.literal("cancelled"),
    ),

    // Level 0 — Passive
    passiveScore: v.number(),
    passiveValidatedAt: v.optional(v.number()),
    passiveSignalUsed: v.optional(v.string()),

    // Escalation
    currentLevel: v.number(), // 0-4
    levelReachedAt: v.optional(v.number()),

    // Channels attempted
    channelsAttempted: v.array(
      v.object({
        channelType: v.string(),
        attemptedAt: v.number(),
        respondedAt: v.optional(v.number()),
        response: v.optional(v.string()),
      }),
    ),

    // Resolution
    validatedAt: v.optional(v.number()),
    validatedBy: v.optional(v.string()), // "passive"|"tap"|"email"|...
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
      v.literal("mode_b4"),
    ),

    sectionsRequested: v.array(v.string()),

    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("auto_denied"),
      v.literal("expired"),
      v.literal("revoked"),
    ),

    // Response
    respondedAt: v.optional(v.number()),
    autoResponseAt: v.number(), // Automatic-denial delay
    accessType: v.optional(
      v.union(v.literal("read"), v.literal("read_download")),
    ),
    accessExpiresAt: v.optional(v.number()),

    // Mode A quorum
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
    encryptedContent: v.string(), // ZK Sealed

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
    curatorsRequired: v.number(), // Contacts required to release

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
      v.literal("cancelled"),
    ),

    isSafePauseActive: v.boolean(),
    safePauseUntil: v.optional(v.number()),

    // Fail-safe
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
    triggerValue: v.number(), // Days (7, 30, 60...)
    label: v.string(),

    actions: v.array(
      v.object({
        actionType: v.union(
          v.literal("send_message"),
          v.literal("grant_access"),
          v.literal("alert_authority"),
          v.literal("unlock_vault"),
          v.literal("account_wipe"),
        ),
        targetContactId: v.optional(v.id("trusted_contacts")),
        config: v.string(), // JSON config
      }),
    ),

    executionStatus: v.union(
      v.literal("pending"),
      v.literal("executed"),
      v.literal("skipped"),
      v.literal("failed"),
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

    // Public data
    fullName: v.optional(v.string()),
    bloodType: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medicalConditions: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelation: v.optional(v.string()),

    // Privacy Controls
    showFullName: v.boolean(),
    showBloodType: v.boolean(),
    showAllergies: v.boolean(),
    showEmergencyContact: v.boolean(),
    showMedicalConditions: v.boolean(),

    // QR Code
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
      v.literal("ai_assistant"),
    ),
    actorId: v.string(),

    // Action in the form "resource.action"
    action: v.string(), // "vault.item.created"
    resourceType: v.string(),
    resourceId: v.string(),

    metadata: v.optional(v.string()), // JSON
    ipAddress: v.optional(v.string()),
    deviceInfo: v.optional(v.string()),

    // Integrity chain
    previousLogHash: v.string(),
    logHash: v.string(),

    createdAt: v.number(),
    // No updatedAt — never modified
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
```

---

## 4. Passkey (WebAuthn) — Recommended Auth

### Alignment with the ZK philosophy

The Passkey is the recommended default authentication choice for Keeplas because it shares exactly the same philosophy as Zero Knowledge:

```
Passkey (WebAuthn)                    Zero Knowledge
──────────────────────────────────    ──────────────────────────────────
Private key never transmitted    ←→   Master Key never transmitted
Local biometrics only            ←→   Local decryption only
Challenge-based verification     ←→   ZK identity proof
No server-side password          ←→   No secret on the Convex side
Phishing-resistant               ←→   Vault unreadable without the local key
```

### Passkey ↔ Master Key relationship

```
Passkey                              Master Key (ZK)
────────────────────────────         ────────────────────────────────
Authenticates the user               Decrypts the vault
Proves "it's really you"             Accesses the encrypted data
Managed by the OS / browser          Managed by packages/crypto/
Stored in iCloud / Google            encryptedKeyBundle in Convex

→ The Passkey does NOT replace the Master Key
→ It protects and unlocks it
```

### Passkey flow at sign-up

```typescript
// packages/crypto/passkey/register.ts

export async function registerPasskey(
  userId: string,
  masterKey: CryptoKey,
): Promise<PasskeyCredential> {
  // 1. Create the Passkey via WebAuthn
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Keeplas", id: "keeplas.com" },
      user: {
        id: new TextEncoder().encode(userId),
        name: userId,
        displayName: "Keeplas Vault",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Local biometrics
        userVerification: "required", // Face ID / fingerprint required
        residentKey: "required", // Passkey stored on the device
      },
    },
  })) as PublicKeyCredential;

  // 2. Encrypt the Master Key with the Passkey's public key
  // → encryptedKeyBundle will be stored in Convex
  const credentialPublicKey = extractPublicKey(credential);
  const encryptedKeyBundle = await encryptWithPasskey(
    masterKey,
    credentialPublicKey,
  );

  return {
    credentialId: bufferToBase64(credential.rawId),
    publicKey: credentialPublicKey,
    encryptedKeyBundle, // → Convex (unreadable without the Passkey)
    deviceName: getDeviceName(),
  };
}
```

### Passkey flow at sign-in

```typescript
// packages/crypto/passkey/authenticate.ts

export async function authenticateWithPasskey(
  encryptedKeyBundle: string, // Fetched from Convex
): Promise<CryptoKey> {
  // 1. WebAuthn challenge — biometrics required
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: "keeplas.com",
      userVerification: "required", // Face ID / fingerprint required
    },
  })) as PublicKeyCredential;

  // 2. Decrypt the Master Key locally with the Passkey's private key
  // The private key never leaves the device's Secure Enclave
  const masterKey = await decryptWithPasskey(
    base64ToBuffer(encryptedKeyBundle),
    assertion,
  );

  return masterKey;
  // Master Key available → vault decrypted client-side ✅
  // Convex has never seen the Master Key
}
```

### Multi-device management

```typescript
// Add a new device with a Passkey
export const addPasskeyDevice = mutation({
  args: {
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    encryptedKeyBundle: v.string(), // Master Key re-encrypted for this Passkey
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const existing = user.passkeyCredentials ?? [];

    // Maximum 5 devices per account
    if (existing.length >= 5) throw new Error("Maximum 5 devices reached");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      passkeyCredentials: [
        ...existing,
        {
          credentialId: args.credentialId,
          publicKey: args.publicKey,
          deviceName: args.deviceName,
          createdAt: now,
          lastUsedAt: now,
        },
      ],
      // Update the encryptedKeyBundle for this new device
      // (each device has its own encryptedKeyBundle)
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: "passkey.device.added",
      resourceType: "user",
      resourceId: args.userId,
      metadata: JSON.stringify({ deviceName: args.deviceName }),
    });
  },
});
```

### Scenario — New device with a Passkey

```
Option A — Synced Passkey (iCloud / Google)
────────────────────────────────────────────────────
Passkey available automatically on the new device
    ↓
Face ID → decrypts encryptedKeyBundle
    ↓
Master Key available → vault accessible ✅
(no additional action required)

Option B — Non-synced Passkey (new Android device)
────────────────────────────────────────────────────
Authentication via Recovery Phrase or Social Recovery
    ↓
Master Key reconstructed client-side
    ↓
New Passkey created on the new device
    ↓
Master Key re-encrypted with the new Passkey
    ↓
New encryptedKeyBundle + passkeyCredentials updated in Convex
```

### Revoke a lost device

```typescript
export const revokePasskeyDevice = mutation({
  args: {
    userId: v.id("users"),
    credentialId: v.string(), // ID of the device to revoke
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updated = (user.passkeyCredentials ?? []).filter(
      (c) => c.credentialId !== args.credentialId,
    );

    await ctx.db.patch(args.userId, {
      passkeyCredentials: updated,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: "passkey.device.revoked",
      resourceType: "user",
      resourceId: args.userId,
      metadata: JSON.stringify({ credentialId: args.credentialId }),
    });
  },
});
```

---

## 5. Zero Knowledge & Cryptography

### 4.1 Master Key generation (100% client)

```typescript
// packages/crypto/aes/masterKey.ts

import { generateKey, exportKey, importKey } from "./webCrypto";
import { splitSecret } from "../shamir/split";
import { deriveRecoveryPhrase } from "../recovery/bip39";

export async function generateMasterKey() {
  // 1. Generate the AES-256-GCM key via the Web Crypto API
  const masterKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"],
  );

  // 2. Export to raw bytes for Shamir
  const rawKey = await window.crypto.subtle.exportKey("raw", masterKey);
  const keyBytes = new Uint8Array(rawKey);

  // 3. Derive the Recovery Phrase (BIP-39)
  // The phrase is NOT sent to the server
  const recoveryPhrase = deriveRecoveryPhrase(keyBytes); // 24 words

  // 4. Compute the verification hash (sent to Convex)
  const phraseHash = await hashRecoveryPhrase(recoveryPhrase);

  // 5. Shamir 3-of-5 split
  const shards = splitSecret(keyBytes, 5, 3);
  // shards[0] → local device
  // shards[1] → Contact A
  // shards[2] → Contact B
  // shards[3] → Contact C
  // shards[4] → Keeplas (shard 5, ZK-encrypted)

  return {
    masterKey, // Stays in local memory only
    rawKey: keyBytes, // Same
    recoveryPhrase, // Shown once, never stored
    phraseHash, // → Convex
    shards, // Encrypted before sending to Convex
  };
}

async function hashRecoveryPhrase(phrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phrase);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return "sha256:" + bufferToHex(hash);
}
```

### 4.2 Encrypting shards before sending to Convex

```typescript
// packages/crypto/shamir/encryptShards.ts

export async function encryptShardForContact(
  shard: Uint8Array,
  contactPublicKey: string, // Contact's EC public key
): Promise<string> {
  // ECDH: asymmetric encryption
  // Only the contact (with their private key) can decrypt
  const encrypted = await ecdhEncrypt(shard, contactPublicKey);
  return bufferToBase64(encrypted);
  // This encrypted result is sent to Convex
  // Convex cannot decrypt it without the contact's private key
}

export async function encryptShardForKeeplus(
  shard: Uint8Array,
  zkVerifierKey: string, // Noir circuit public key
): Promise<string> {
  // Encrypted such that it can only be decrypted
  // by providing a valid ZK Proof
  const encrypted = await zkEncrypt(shard, zkVerifierKey);
  return bufferToBase64(encrypted);
}
```

### 4.3 Vault encryption (AES-256-GCM)

```typescript
// packages/crypto/aes/encrypt.ts

export async function encryptVaultItem(
  content: string,
  masterKey: CryptoKey,
): Promise<{ encryptedContent: string; contentHash: string }> {
  // Random IV for each encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encoded = new TextEncoder().encode(content);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    encoded,
  );

  // Prefix the IV to the ciphertext for decryption
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  const encryptedContent = bufferToBase64(combined);

  // Hash for integrity verification
  const hash = await window.crypto.subtle.digest("SHA-256", encrypted);
  const contentHash = "sha256:" + bufferToHex(hash);

  return { encryptedContent, contentHash };
  // Only encryptedContent is sent to Convex — unreadable without masterKey
}

export async function decryptVaultItem(
  encryptedContent: string,
  masterKey: CryptoKey,
): Promise<string> {
  const combined = base64ToBuffer(encryptedContent);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
  // Decryption 100% client-side — Convex is never involved
}
```

### 4.4 Zero Knowledge Proof — Noir circuit

```typescript
// packages/crypto/zk/keeplasShard.ts
// This code runs on the client only (WASM)

import { BarretenbergBackend } from "@noir-lang/backend_barretenberg";
import { Noir } from "@noir-lang/noir_js";
import circuit from "./circuits/keeplas_identity.json";

export async function generateIdentityProof(
  secretInput: Uint8Array, // Derived from the Master Key — never transmitted
  publicInput: string, // The user's public identifier
): Promise<{ proof: Uint8Array; publicSignals: string[] }> {
  const backend = new BarretenbergBackend(circuit);
  const noir = new Noir(circuit, backend);

  // The proof proves: "I know a secret such that hash(secret) = publicInput"
  // Without revealing the secret itself
  const { proof, publicInputs } = await noir.generateFinalProof({
    secret: Array.from(secretInput), // Stayed on the client
    identity_hash: publicInput, // Known to Convex
  });

  return { proof, publicSignals: publicInputs };
}

// On the Convex side (verification only — no secret)
export async function verifyIdentityProof(
  proof: Uint8Array,
  publicSignals: string[],
  verifierKey: string, // zkVerifierKey stored in users
): Promise<boolean> {
  // Convex verifies the proof mathematically
  // Without ever knowing the secret
  const backend = new BarretenbergBackend(circuit);
  const noir = new Noir(circuit, backend);
  return await noir.verifyFinalProof({ proof, publicInputs: publicSignals });
}
```

---

## 6. Recovery — Complete Flows

### 5.1 Recovery via Recovery Phrase (Option A)

```
STEP 1 — User enters their 24 words (client only)
────────────────────────────────────────────────────
User types the 24 words into the interface
    ↓
BIP-39 → reconstructs the Master Key's raw bytes
    ↓
hash(phrase) computed locally
    ↓
Convex query: recoveryPhraseHash === computed hash ?
    ↓ YES
Master Key reconstructed locally ✅
    ↓
STEP 2 — Local shard regeneration
────────────────────────────────────────────────────
New shard 1 generated for the new device
    ↓
Encrypted with the new device's biometrics
    ↓
New encryptedKeyBundle → saved in Convex
    ↓
Vault accessible on the new device ✅
```

```typescript
// packages/crypto/recovery/phraseRecovery.ts

export async function recoverFromPhrase(
  inputPhrase: string,
  storedHash: string, // Fetched from Convex
): Promise<CryptoKey | null> {
  // 1. Verify the hash locally
  const inputHash = await hashRecoveryPhrase(inputPhrase);
  if (inputHash !== storedHash) return null; // Incorrect phrase

  // 2. Reconstruct the Master Key from the phrase
  const rawKey = phraseToKeyBytes(inputPhrase); // Inverse BIP-39

  // 3. Import as a CryptoKey
  const masterKey = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return masterKey;
  // The Master Key is reconstructed — never sent to Convex
}
```

### 5.2 Social Recovery (Option B — minimum 2 contacts)

```
STEP 1 — Contact A submits their shard
────────────────────────────────────────────────────
Contact A enters their personal Recovery Phrase (client A)
    ↓
Reconstructs their local private key
    ↓
Fetches their encryptedShard from Convex
    ↓
Decrypts the shard with their private key → Shard A in clear
    ↓
Shard A securely transmitted to the recovery flow
(via an E2E-encrypted channel between the two devices)

STEP 2 — Contact B does the same
────────────────────────────────────────────────────
Shard B obtained on client B

STEP 3 — Shamir reconstruction (the user's client)
────────────────────────────────────────────────────
Shard A + Shard B + Shard 5 (Keeplas via ZK proof)
    ↓
Shamir reconstruct (3 of 5 shards = threshold reached)
    ↓
Master Key reconstructed locally ✅
    ↓
STEP 4 — Redistribution
────────────────────────────────────────────────────
New shard 1 for the new device
New shards for the contacts if necessary
New ZK-encrypted keeplasShard
All encryptedShards updated in Convex
```

```typescript
// packages/crypto/recovery/socialRecovery.ts

export async function reconstructFromShards(
  shards: Uint8Array[], // Minimum 3 decrypted shards
): Promise<CryptoKey> {
  // Shamir reconstruction (client-side only)
  const rawKey = combineSecret(shards);

  const masterKey = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return masterKey;
}

export async function decryptContactShard(
  encryptedShard: string, // Fetched from Convex
  contactPrivateKey: CryptoKey, // Contact's private key — local only
): Promise<Uint8Array> {
  const shardBytes = base64ToBuffer(encryptedShard);
  return await ecdhDecrypt(shardBytes, contactPrivateKey);
  // Decryption 100% local to the contact — Convex is never involved
}
```

### 5.3 Obtaining the Keeplas Shard 5 (via ZK Proof)

```typescript
// packages/crypto/recovery/keeplasShard.ts

export async function requestKeeplasShard(
  masterKey: Uint8Array, // Partial — reconstructed from other shards
  userId: string,
  zkVerifierKey: string,
): Promise<Uint8Array> {
  // 1. Generate the identity ZK Proof (client-side)
  const { proof, publicSignals } = await generateIdentityProof(
    masterKey,
    userId,
  );

  // 2. Send the proof to Convex (not the secret)
  const encryptedShard5 = await convex.mutation(
    api.zkVerification.verifyAndReleaseShard,
    { proof: bufferToBase64(proof), publicSignals, userId },
  );
  // Convex verifies the proof mathematically
  // If valid → returns the encrypted shard 5

  // 3. Decrypt shard 5 on the client
  const shard5 = await zkDecrypt(base64ToBuffer(encryptedShard5), masterKey);

  return shard5;
}
```

---

## 7. Convex Functions Logic

### 6.1 Users

```typescript
// packages/convex/users.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Account creation — receives only public data
export const createUser = mutation({
  args: {
    email: v.optional(v.string()), // Optional if Passkey
    authProviders: v.array(v.string()), // ["passkey"] | ["google"] | ...
    publicKey: v.string(),
    encryptedKeyBundle: v.string(), // Master Key encrypted with biometrics/passkey
    recoveryPhraseHash: v.string(), // sha256 only — not the phrase
    zkVerifierKey: v.string(),
    keeplasShard: v.string(), // ZK-encrypted shard 5
    // Passkey-specific
    passkeyCredential: v.optional(
      v.object({
        credentialId: v.string(),
        publicKey: v.string(),
        deviceName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const passkeyCredentials = args.passkeyCredential
      ? [{ ...args.passkeyCredential, createdAt: now, lastUsedAt: now }]
      : undefined;

    const userId = await ctx.db.insert("users", {
      email: args.email,
      authProviders: args.authProviders as any[],
      publicKey: args.publicKey,
      encryptedKeyBundle: args.encryptedKeyBundle,
      recoveryPhraseHash: args.recoveryPhraseHash,
      recoveryVerified: false,
      zkVerifierKey: args.zkVerifierKey,
      keeplasShard: args.keeplasShard,
      passkeyCredentials,
      onboardingStep: "recovery_phrase",
      vaultIntegrityScore: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });

    // Create the empty vault
    await ctx.db.insert("vaults", {
      userId,
      status: "active",
      securityLevel: "maximum",
      integrityScore: 0,
      encryptedItemsCount: 0,
      secureNodesCount: 0,
      lastVerifiedAt: Date.now(),
      syncHash: generateSyncHash(),
      lastSyncAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "user.created",
      resourceType: "user",
      resourceId: userId,
    });

    return userId;
  },
});

// Recovery Phrase verification — compares hashes only
export const verifyRecoveryPhrase = mutation({
  args: {
    userId: v.id("users"),
    recoveryPhraseHash: v.string(), // sha256(phrase) computed client-side
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Hash comparison — Convex never knows the phrase
    if (user.recoveryPhraseHash !== args.recoveryPhraseHash) {
      return { success: false };
    }

    await ctx.db.patch(args.userId, {
      recoveryVerified: true,
      onboardingStep: "dashboard",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Update lastSeenAt — triggered on every app interaction
export const recordAppActivity = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastSeenAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Record as a passive signal
    await ctx.db.insert("passive_signals", {
      userId: args.userId,
      signalType: "app_activity",
      scoreContribution: 40,
      detectedAt: Date.now(),
      validUntil: Date.now() + 15 * 24 * 60 * 60 * 1000, // 15 days
    });
  },
});
```

### 6.2 Vault Items

```typescript
// packages/convex/vault.ts

export const addVaultItem = mutation({
  args: {
    vaultId: v.id("vaults"),
    userId: v.id("users"),
    category: v.string(),
    title: v.string(),
    encryptedContent: v.string(), // Encrypted client-side before sending
    encryptionType: v.string(),
    contentHash: v.string(),
    accessLevel: v.string(),
    isCritical: v.boolean(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify that the user really owns the vault
    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== args.userId) {
      throw new Error("Unauthorized");
    }

    const itemId = await ctx.db.insert("vault_items", {
      ...args,
      sharedWithContacts: [],
      description: undefined,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update the vault counter
    await ctx.db.patch(args.vaultId, {
      encryptedItemsCount: vault.encryptedItemsCount + 1,
      updatedAt: Date.now(),
    });

    // Recompute the Vault Integrity Score
    await recalculateIntegrityScore(ctx, args.userId, args.vaultId);

    // Audit log
    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: "vault.item.created",
      resourceType: "vault_item",
      resourceId: itemId,
      metadata: JSON.stringify({ category: args.category, title: args.title }),
    });

    return itemId;
  },
});
```

### 6.3 Trusted Contacts

```typescript
// packages/convex/trustedContacts.ts

export const inviteContact = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    role: v.string(),
    accessModes: v.array(v.string()),
    isFirstResponder: v.boolean(),
    isMedicalContact: v.boolean(),
    shardIndex: v.number(),
    encryptedShard: v.string(), // Encrypted client-side with the contact's public key
    shardPublicKeyUsed: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify there are not already 5 contacts
    const existing = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const active = existing.filter(
      (c) =>
        c.invitationStatus !== "revoked" && c.invitationStatus !== "declined",
    );
    if (active.length >= 5) throw new Error("Maximum 5 trusted contacts");

    // Generate a secure invitation token (72h)
    const invitationToken = generateSecureToken();

    const contactId = await ctx.db.insert("trusted_contacts", {
      ...args,
      invitationToken,
      invitationStatus: "pending",
      shardConfirmed: false,
      invitedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Send the invitation email (via a scheduled function)
    await ctx.scheduler.runAfter(0, api.notifications.sendInvitationEmail, {
      contactId,
      invitationToken,
      ownerName: (await ctx.db.get(args.userId))?.name ?? "Someone",
    });

    return contactId;
  },
});

// Shard confirmation by the contact
export const confirmShard = mutation({
  args: {
    contactId: v.id("trusted_contacts"),
    invitationToken: v.string(),
    contactPublicKey: v.string(), // Contact's public key
    contactRecoveryHash: v.string(), // sha256(contact recovery phrase)
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.invitationToken !== args.invitationToken) {
      throw new Error("Invalid invitation token");
    }

    await ctx.db.patch(args.contactId, {
      invitationStatus: "accepted",
      shardConfirmed: true,
      shardConfirmedAt: Date.now(),
      contactPublicKey: args.contactPublicKey,
      contactRecoveryHash: args.contactRecoveryHash,
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update the Vault Integrity Score
    await recalculateIntegrityScore(ctx, contact.userId);
  },
});
```

### 6.4 ZK Verification

```typescript
// packages/convex/zkVerification.ts

export const verifyAndReleaseShard = mutation({
  args: {
    userId: v.id("users"),
    proof: v.string(), // ZK Proof generated client-side
    publicSignals: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Verify the proof mathematically
    // Convex VERIFIES but does NOT KNOW the secret
    const isValid = await verifyZKProof(
      base64ToBuffer(args.proof),
      args.publicSignals,
      user.zkVerifierKey,
    );

    if (!isValid) {
      await createAuditLog(ctx, {
        userId: args.userId,
        actorType: "user",
        actorId: args.userId,
        action: "zk.proof.failed",
        resourceType: "user",
        resourceId: args.userId,
      });
      throw new Error("Invalid ZK Proof");
    }

    // Log the access to shard 5
    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: "zk.shard5.released",
      resourceType: "user",
      resourceId: args.userId,
    });

    // Return the encrypted shard 5 — the client decrypts it with its ZK proof
    return user.keeplasShard;
  },
});
```

### 6.5 Access Requests

```typescript
// packages/convex/accessRequests.ts

// Mode B1 — Trusted Contact requests access
export const requestAccess = mutation({
  args: {
    vaultUserId: v.id("users"),
    contactId: v.id("trusted_contacts"),
    accessMode: v.string(),
    sectionsRequested: v.array(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== args.vaultUserId) {
      throw new Error("Unauthorized");
    }

    // Verify the mode is allowed for this contact
    if (!contact.accessModes.includes(args.accessMode as any)) {
      throw new Error("Access mode not permitted for this contact");
    }

    // Automatic-denial delay per the user's config
    const autoResponseHours = 24; // Configurable by the user
    const autoResponseAt = Date.now() + autoResponseHours * 3600 * 1000;

    const requestId = await ctx.db.insert("access_requests", {
      vaultUserId: args.vaultUserId,
      requestedBy: args.contactId,
      accessMode: args.accessMode as any,
      sectionsRequested: args.sectionsRequested,
      status: "pending",
      autoResponseAt,
      reason: args.reason,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Notify the owner immediately
    await ctx.db.insert("notifications", {
      userId: args.vaultUserId,
      type: "access_request",
      title: `${contact.name} is requesting access to your vault`,
      body: args.reason ?? "No reason specified",
      actionUrl: `/access-requests/${requestId}`,
      channels: ["push", "email"],
      isRead: false,
      relatedId: requestId,
      relatedType: "access_request",
      createdAt: Date.now(),
    });

    // Schedule the automatic denial if no response
    await ctx.scheduler.runAt(autoResponseAt, api.accessRequests.autoDecline, {
      requestId,
    });

    return requestId;
  },
});

// Response from the vault owner
export const respondToAccessRequest = mutation({
  args: {
    requestId: v.id("access_requests"),
    userId: v.id("users"),
    decision: v.union(
      v.literal("approve"),
      v.literal("deny"),
      v.literal("approve_temporary"),
    ),
    accessType: v.optional(v.string()),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.vaultUserId !== args.userId) {
      throw new Error("Unauthorized");
    }
    if (request.status !== "pending") {
      throw new Error("Request already resolved");
    }

    const now = Date.now();
    const accessExpiresAt = args.durationHours
      ? now + args.durationHours * 3600 * 1000
      : undefined;

    await ctx.db.patch(args.requestId, {
      status: args.decision === "deny" ? "denied" : "approved",
      respondedAt: now,
      accessType: args.accessType as any,
      accessExpiresAt,
      updatedAt: now,
    });

    // Notify the contact of the decision
    const contact = await ctx.db.get(request.requestedBy);
    if (contact?.contactUserId) {
      await ctx.db.insert("notifications", {
        userId: contact.contactUserId,
        type: "access_request",
        title: args.decision === "deny" ? "Access denied" : "Access granted",
        body:
          args.decision === "deny"
            ? "The owner denied your access request."
            : "You now have access to the vault.",
        channels: ["push", "email"],
        isRead: false,
        relatedId: args.requestId,
        relatedType: "access_request",
        createdAt: now,
      });
    }

    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: `access.request.${args.decision}d`,
      resourceType: "access_request",
      resourceId: args.requestId,
    });
  },
});
```

---

## 8. Scheduled Functions — Life Check

### 7.1 Main cron

```typescript
// packages/convex/crons.ts

import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Every hour — check the due Life Checks
crons.interval(
  "life-check-scheduler",
  { hours: 1 },
  api.lifeCheck.processScheduledChecks,
);

// Every 4 hours — escalate the running cycles
crons.interval(
  "life-check-escalation",
  { hours: 4 },
  api.lifeCheck.processEscalations,
);

// Every 15 minutes — passive signals
crons.interval(
  "passive-signals-collector",
  { minutes: 15 },
  api.lifeCheck.collectPassiveSignals,
);

// Every day — cleanup of expired signals
crons.daily(
  "cleanup-expired-signals",
  { hourUTC: 2, minuteUTC: 0 },
  api.lifeCheck.cleanupExpiredSignals,
);

export default crons;
```

### 7.2 Main Life Check logic

```typescript
// packages/convex/lifeCheck.ts

// Triggered every hour
export const processScheduledChecks = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    // Find all due Life Checks
    const dueConfigs = await ctx.runQuery(api.lifeCheck.getDueConfigs, {
      before: now,
    });

    for (const config of dueConfigs) {
      await ctx.runMutation(api.lifeCheck.startCycle, {
        configId: config._id,
        userId: config.userId,
      });
    }
  },
});

// Start a cycle
export const startCycle = internalMutation({
  args: {
    configId: v.id("life_check_configs"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const cycleId = await ctx.db.insert("life_check_cycles", {
      userId: args.userId,
      configId: args.configId,
      status: "running",
      passiveScore: 0,
      currentLevel: 0,
      channelsAttempted: [],
      scheduledAt: now,
      startedAt: now,
    });

    // Step 1: Compute the passive score immediately
    await ctx.scheduler.runAfter(0, api.lifeCheck.evaluatePassiveSignals, {
      cycleId,
      userId: args.userId,
    });

    return cycleId;
  },
});

// Level 0 — Passive signals evaluation
export const evaluatePassiveSignals = internalAction({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Fetch all valid signals
    const signals = await ctx.runQuery(api.lifeCheck.getValidSignals, {
      userId: args.userId,
      validAt: now,
    });

    // Compute the total score
    let totalScore = 0;
    let bestSignal = "";

    for (const signal of signals) {
      if (signal.scoreContribution > 0) {
        totalScore += signal.scoreContribution;
        if (signal.scoreContribution >= 30) {
          bestSignal = signal.signalType;
        }
      }
    }

    const config = await ctx.runQuery(api.lifeCheck.getConfig, {
      userId: args.userId,
    });

    if (totalScore >= (config?.confidenceThreshold ?? 50)) {
      // Sufficient score → silent validation ✅
      await ctx.runMutation(api.lifeCheck.validateCycle, {
        cycleId: args.cycleId,
        validatedBy: "passive",
        passiveScore: totalScore,
        passiveSignalUsed: bestSignal,
      });
    } else {
      // Insufficient score → move to level 1
      await ctx.runMutation(api.lifeCheck.updateCycleScore, {
        cycleId: args.cycleId,
        passiveScore: totalScore,
      });

      // Delay before level 1 depending on frequency
      const delayHours =
        config?.frequency === "weekly"
          ? 12
          : config?.frequency === "monthly"
            ? 24
            : 72; // quarterly

      await ctx.scheduler.runAfter(
        delayHours * 3600 * 1000,
        api.lifeCheck.triggerLevel1,
        { cycleId: args.cycleId, userId: args.userId },
      );
    }
  },
});

// Level 1 — Simple push notification
export const triggerLevel1 = internalAction({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify the cycle is still "running"
    const cycle = await ctx.runQuery(api.lifeCheck.getCycle, {
      cycleId: args.cycleId,
    });
    if (cycle?.status !== "running") return; // Already validated

    await ctx.runMutation(api.lifeCheck.updateCycleLevel, {
      cycleId: args.cycleId,
      level: 1,
    });

    // Send a push notification "All good? 👍"
    await ctx.runMutation(api.notifications.sendLifeCheckPush, {
      userId: args.userId,
      cycleId: args.cycleId,
      message: "All good?",
    });

    // Fetch config for the next delay
    const config = await ctx.runQuery(api.lifeCheck.getConfig, {
      userId: args.userId,
    });
    const nextChannelDelay = getNextChannelDelay(config, 1);

    // Schedule level 2 if no response
    await ctx.scheduler.runAfter(
      nextChannelDelay,
      api.lifeCheck.triggerNextChannel,
      { cycleId: args.cycleId, userId: args.userId, channelIndex: 0 },
    );
  },
});

// Levels 2+ — Channel-by-channel escalation
export const triggerNextChannel = internalAction({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
    channelIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.runQuery(api.lifeCheck.getCycle, {
      cycleId: args.cycleId,
    });
    if (cycle?.status !== "running" && cycle?.status !== "escalating") return;

    const config = await ctx.runQuery(api.lifeCheck.getConfig, {
      userId: args.userId,
    });
    const channels =
      config?.activeChannels
        .filter((c) => c.isEnabled)
        .sort((a, b) => a.order - b.order) ?? [];

    if (args.channelIndex >= channels.length) {
      // All channels exhausted → trigger emergency
      await ctx.runMutation(api.lifeCheck.triggerEmergency, {
        cycleId: args.cycleId,
        userId: args.userId,
      });
      return;
    }

    const channel = channels[args.channelIndex];

    await ctx.runMutation(api.lifeCheck.updateCycleLevel, {
      cycleId: args.cycleId,
      level: args.channelIndex + 2,
    });

    // Send via the appropriate channel
    await ctx.runMutation(api.notifications.sendViaChannel, {
      userId: args.userId,
      cycleId: args.cycleId,
      channelType: channel.type,
    });

    // Schedule the next channel
    await ctx.scheduler.runAfter(
      channel.delayHours * 3600 * 1000,
      api.lifeCheck.triggerNextChannel,
      {
        cycleId: args.cycleId,
        userId: args.userId,
        channelIndex: args.channelIndex + 1,
      },
    );
  },
});

// Validate a cycle (by any level)
export const validateCycle = internalMutation({
  args: {
    cycleId: v.id("life_check_cycles"),
    validatedBy: v.string(),
    passiveScore: v.optional(v.number()),
    passiveSignalUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) return;

    const now = Date.now();

    await ctx.db.patch(args.cycleId, {
      status: "validated",
      validatedAt: now,
      validatedBy: args.validatedBy,
      passiveScore: args.passiveScore ?? cycle.passiveScore,
      passiveSignalUsed: args.passiveSignalUsed,
      completedAt: now,
    });

    // Schedule the next cycle
    const config = await ctx.db.get(cycle.configId);
    if (config) {
      const nextCheckAt = calculateNextCheck(config.frequency, now);
      await ctx.db.patch(cycle.configId, {
        lastCheckAt: now,
        nextCheckAt,
        updatedAt: now,
      });
    }
  },
});

// Emergency triggering
export const triggerEmergency = internalMutation({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const gracePeriodEndsAt = now + 72 * 3600 * 1000; // 72h grace

    await ctx.db.patch(args.cycleId, {
      status: "triggered",
      completedAt: now,
    });

    // Notify ALL trusted contacts
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    for (const contact of contacts) {
      if (contact.contactUserId) {
        await ctx.db.insert("notifications", {
          userId: contact.contactUserId,
          type: "security_alert",
          title: "Life Check — No response detected",
          body: "The vault owner has not responded. A 72h grace period is in progress.",
          channels: ["push", "email"],
          isRead: false,
          relatedId: args.cycleId,
          relatedType: "life_check_cycle",
          createdAt: now,
        });
      }
    }

    // Immutable audit log
    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "system",
      actorId: "life_check_system",
      action: "life_check.emergency.triggered",
      resourceType: "life_check_cycle",
      resourceId: args.cycleId,
      metadata: JSON.stringify({ gracePeriodEndsAt }),
    });
  },
});

// Helpers
function calculateNextCheck(frequency: string, from: number): number {
  const DAY = 24 * 3600 * 1000;
  if (frequency === "weekly") return from + 7 * DAY;
  if (frequency === "monthly") return from + 30 * DAY;
  if (frequency === "quarterly") return from + 90 * DAY;
  return from + 30 * DAY;
}
```

### 7.3 Immutable Audit Log

```typescript
// packages/convex/auditLogs.ts

let lastLogHash = "genesis"; // Initial hash

export async function createAuditLog(
  ctx: any,
  params: {
    userId: string;
    actorType: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: string;
    ipAddress?: string;
  },
) {
  const now = Date.now();

  // Fetch the last log for the chain
  const lastLog = await ctx.db
    .query("audit_logs")
    .withIndex("by_created", (q) => q.eq("userId", params.userId))
    .order("desc")
    .first();

  const previousHash = lastLog?.logHash ?? "genesis";

  // Build the hash of this log
  const logContent = JSON.stringify({
    ...params,
    previousHash,
    createdAt: now,
  });
  const logHash = await sha256(logContent);

  await ctx.db.insert("audit_logs", {
    ...params,
    previousLogHash: previousHash,
    logHash,
    createdAt: now,
    // No updatedAt — never modified
  });
}
```

---

## 9. Convex File Structure

```
packages/convex/
├── schema.ts                   ← Complete schema (section 3)
├── _generated/                 ← Auto-generated by the Convex CLI
├── crons.ts                    ← Scheduled functions
│
├── users.ts                    ← CRUD + recovery verification
├── vault.ts                    ← Vault item CRUD
├── trustedContacts.ts          ← Invitations + shard confirmations
├── lifeCheck.ts                ← Cycles + escalation + passive signals
├── accessRequests.ts           ← Modes A/B
├── conditionalMessages.ts      ← Dead Man Switch messages
├── scenarios.ts                ← Scenario Engine
├── emergencyCards.ts           ← Emergency Card + QR
├── zkVerification.ts           ← ZK Proof verification
├── notifications.ts            ← Multi-channel sending
├── auditLogs.ts                ← Immutable log + hash chain
│
└── _helpers/
    ├── integrityScore.ts       ← Vault Integrity Score computation
    ├── secureToken.ts          ← Secure token generation
    └── syncHash.ts             ← Vault synchronization hash

packages/crypto/
├── passkey/                    ← WebAuthn (NEW)
│   ├── register.ts             ← Passkey creation + Master Key encryption
│   ├── authenticate.ts         ← Passkey auth + Master Key decryption
│   └── multiDevice.ts          ← Device add / revoke
├── zk/
│   ├── circuits/
│   │   └── keeplas_identity.json ← Compiled Noir circuit
│   └── keeplasShard.ts         ← ZK Proof generation + verification
├── aes/
│   ├── masterKey.ts            ← Master Key generation
│   └── encrypt.ts              ← Vault item encryption / decryption
├── shamir/
│   ├── split.ts                ← Shamir 3-of-5 split
│   ├── combine.ts              ← Reconstruction from shards
│   └── encryptShards.ts        ← Shard encryption for contacts + Keeplas
└── recovery/
    ├── bip39.ts                ← 24-word Recovery Phrase generation
    ├── phraseRecovery.ts       ← Recovery from a Recovery Phrase
    └── socialRecovery.ts       ← Social recovery (min. 2 contacts)
```

---

_Technical document — Keeplas v1 — April 2026 — v2_
_Next step: Implementation of packages/crypto/ (Passkey + Noir ZK circuits)_
