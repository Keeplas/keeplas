# Keeplas — Architecture Technique : Convex, ZK & Recovery

> Document technique — Avril 2026 — v1

---

## Table des matières

1. [Principes Fondamentaux](#1-principes-fondamentaux)
2. [Séparation Client / Serveur](#2-séparation-client--serveur)
3. [Schema Convex Complet](#3-schema-convex-complet)
4. [Passkey (WebAuthn) — Auth Recommandée](#4-passkey-webauthn--auth-recommandée)
5. [Zero Knowledge & Cryptographie](#5-zero-knowledge--cryptographie)
6. [Recovery — Flux Complets](#6-recovery--flux-complets)
7. [Logique des Convex Functions](#7-logique-des-convex-functions)
8. [Scheduled Functions — Life Check](#8-scheduled-functions--life-check)
9. [Structure des fichiers Convex](#9-structure-des-fichiers-convex)

---

## 1. Principes Fondamentaux

### Règle absolue

> **Ce qui est secret ne touche jamais le serveur Convex.**

Convex est un serveur de coordination et de stockage. Il ne connaît jamais :

- Le Master Key
- La Recovery Phrase
- Les shards Shamir en clair
- Le contenu déchiffré du vault

Il stocke uniquement des données chiffrées qu'il ne peut pas lire.

### Responsabilités par couche

```
packages/crypto/     ← Secrets, chiffrement, ZK proofs
    zk/              ← Génération ZK Proofs (Noir/Barretenberg)
    aes/             ← Chiffrement AES-256-GCM (Web Crypto API)
    shamir/          ← Split et reconstruction Shamir
    recovery/        ← BIP-39, dérivation Master Key

convex/              ← Stockage et coordination
    schema.ts        ← Tables (données chiffrées uniquement)
    users.ts         ← CRUD utilisateurs
    vault.ts         ← CRUD vault items chiffrés
    lifeCheck.ts     ← Scheduling, cycles, signaux passifs
    trustedContacts.ts ← Gestion contacts et shards chiffrés
    accessRequests.ts  ← Modes d'accès A/B
    zkVerification.ts  ← Vérification ZK Proofs (pas génération)
    scenarios.ts     ← Scenario Engine
    auditLogs.ts     ← Log immuable
    notifications.ts ← Notifications
```

---

## 2. Séparation Client / Serveur

### Ce que Convex stocke vs ce qu'il ne voit jamais

| Donnée                    | Client uniquement        | Convex stocke                |
| ------------------------- | ------------------------ | ---------------------------- |
| Master Key                | ✅ Généré localement     | ❌ Jamais                    |
| Recovery Phrase (24 mots) | ✅ Affiché une fois      | ❌ Jamais                    |
| Shards Shamir en clair    | ✅ Reconstruction locale | ❌ Jamais                    |
| Déchiffrement vault       | ✅ Côté navigateur       | ❌ Jamais                    |
| ZK Proof computation      | ✅ Noir/Barretenberg     | ❌ Jamais                    |
| Hash Recovery Phrase      | —                        | ✅ sha256 uniquement         |
| Shards chiffrés           | —                        | ✅ Illisible sans clé privée |
| Vault items chiffrés      | —                        | ✅ Illisible sans Master Key |
| Public Key user           | —                        | ✅ Pas secrète               |
| Métadonnées (titre, date) | —                        | ✅ En clair                  |
| ZK Proof vérification     | —                        | ✅ Vérifier ≠ connaître      |
| Logs d'audit              | —                        | ✅ Immuables                 |
| Config Life Check         | —                        | ✅ En clair                  |

### Ce que Convex voit réellement dans chaque table

```typescript
// users — ce que Convex voit
{
  email: "user@example.com",
  publicKey: "0x04a3f8b...",           // Clé publique, pas secrète
  encryptedKeyBundle: "U2FsdGVk...",   // Master Key chiffré biométrie
                                        // Convex NE PEUT PAS déchiffrer
  recoveryPhraseHash: "sha256:abc...", // Hash pour vérifier sans connaître
  keeplasShard: "U2FsdGVk...",         // Shard 5 chiffré par ZK proof
}

// vault_items — ce que Convex voit
{
  title: "Passport Scan",              // Métadonnée en clair
  encryptedContent: "U2FsdGVk...",    // Contenu illisible sans Master Key
  contentHash: "sha256:xyz...",        // Intégrité seulement
}

// trusted_contacts — ce que Convex voit
{
  shardIndex: 2,
  encryptedShard: "U2FsdGVk...",      // Shard chiffré clé publique contact
                                        // Seul le contact peut déchiffrer
  shardPublicKeyUsed: "0x04b2c...",
}
```

---

## 3. Schema Convex Complet

```typescript
// packages/convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════

  users: defineTable({
    // Identité
    email: v.optional(v.string()), // Optionnel si Passkey uniquement
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()), // "fr" | "en" | "sw"

    // Auth — array pour supporter plusieurs méthodes simultanées
    authProviders: v.array(
      v.union(
        v.literal("passkey"), // ← Recommandé en premier
        v.literal("email"),
        v.literal("google"),
        v.literal("apple"),
      ),
    ),

    // Passkey / WebAuthn — plusieurs appareils possibles
    passkeyCredentials: v.optional(
      v.array(
        v.object({
          credentialId: v.string(), // ID unique du Passkey
          publicKey: v.string(), // Clé publique WebAuthn
          deviceName: v.optional(v.string()), // "iPhone de Prince"
          createdAt: v.number(),
          lastUsedAt: v.number(),
        }),
      ),
    ),

    // ZK — clés publiques uniquement côté serveur
    publicKey: v.string(), // Clé publique EC
    encryptedKeyBundle: v.string(), // Master Key chiffré biométrie/passkey
    recoveryPhraseHash: v.string(), // sha256(phrase) — vérification
    recoveryVerified: v.boolean(),
    zkVerifierKey: v.string(), // Clé publique circuit Noir

    // Shard 5 — détenu par Keeplas, chiffré ZK
    keeplasShard: v.string(), // Illisible sans ZK proof valide

    // Onboarding
    onboardingStep: v.union(
      v.literal("recovery_phrase"),
      v.literal("dashboard"),
      v.literal("complete"),
    ),
    vaultIntegrityScore: v.number(), // 0-100

    // Statut
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

    // Intégrité
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

    // Contenu — chiffré, illisible par Convex
    title: v.string(), // Métadonnée en clair
    description: v.optional(v.string()),
    encryptedContent: v.string(), // AES-256-GCM
    encryptionType: v.union(
      v.literal("aes_256_gcm"),
      v.literal("zero_knowledge"),
    ),
    contentHash: v.string(), // Vérification intégrité

    // Fichiers
    fileStorageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),

    // Accès
    sharedWithContacts: v.array(v.id("trusted_contacts")),
    accessLevel: v.union(
      v.literal("private"),
      v.literal("trusted_only"),
      v.literal("emergency_only"),
      v.literal("public"),
    ),

    // Statut
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
    userId: v.id("users"), // Propriétaire vault
    contactUserId: v.optional(v.id("users")), // Si compte Keeplas

    // Identité
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

    // Désignations spéciales
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

    // Shard Shamir — chiffré avec clé publique du contact
    shardIndex: v.number(), // 1-5
    encryptedShard: v.string(), // Illisible sans clé privée contact
    shardPublicKeyUsed: v.string(), // Clé publique utilisée
    shardConfirmed: v.boolean(),
    shardConfirmedAt: v.optional(v.number()),

    // Recovery du contact
    contactRecoveryHash: v.optional(v.string()), // sha256(recovery phrase contact)
    contactPublicKey: v.optional(v.string()), // Clé publique du contact

    // Invitation
    invitationStatus: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked"),
    ),
    invitationToken: v.string(), // Token sécurisé (72h)
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),

    // Accès proactif B2
    proactiveAccess: v.optional(
      v.object({
        sections: v.array(v.string()),
        accessType: v.union(v.literal("read"), v.literal("read_download")),
        expiresAt: v.optional(v.number()),
        isPermanent: v.boolean(),
      }),
    ),

    // Accès conditionnel B4
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

    // Signaux passifs (opt-in)
    passiveSignals: v.object({
      appActivity: v.boolean(), // Toujours true
      deviceActivity: v.boolean(),
      gpsMovement: v.boolean(),
      whatsappActivity: v.boolean(),
      googleActivity: v.boolean(),
      healthData: v.boolean(),
      appleWatch: v.boolean(),
    }),

    // Canaux actifs ordonnés
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

    // Cas particuliers
    travelModeEnabled: v.boolean(),
    travelModeUntil: v.optional(v.number()),
    expeditionMode: v.boolean(),

    // Statut
    isActive: v.boolean(),
    nextCheckAt: v.number(),
    lastCheckAt: v.optional(v.number()),
    confidenceThreshold: v.number(), // Défaut: 50 pts

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

    // Niveau 0 — Passif
    passiveScore: v.number(),
    passiveValidatedAt: v.optional(v.number()),
    passiveSignalUsed: v.optional(v.string()),

    // Escalade
    currentLevel: v.number(), // 0-4
    levelReachedAt: v.optional(v.number()),

    // Canaux tentés
    channelsAttempted: v.array(
      v.object({
        channelType: v.string(),
        attemptedAt: v.number(),
        respondedAt: v.optional(v.number()),
        response: v.optional(v.string()),
      }),
    ),

    // Résolution
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

    // Réponse
    respondedAt: v.optional(v.number()),
    autoResponseAt: v.number(), // Délai refus automatique
    accessType: v.optional(
      v.union(v.literal("read"), v.literal("read_download")),
    ),
    accessExpiresAt: v.optional(v.number()),

    // Quorum Mode A
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
    curatorsRequired: v.number(), // Contacts requis pour libérer

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
    triggerValue: v.number(), // Jours (7, 30, 60...)
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

    // Données publiques
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
  // AUDIT LOGS — IMMUABLE
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

    // Action sous forme "resource.action"
    action: v.string(), // "vault.item.created"
    resourceType: v.string(),
    resourceId: v.string(),

    metadata: v.optional(v.string()), // JSON
    ipAddress: v.optional(v.string()),
    deviceInfo: v.optional(v.string()),

    // Chaîne d'intégrité
    previousLogHash: v.string(),
    logHash: v.string(),

    createdAt: v.number(),
    // Pas de updatedAt — jamais modifié
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

## 4. Passkey (WebAuthn) — Auth Recommandée

### Alignement avec la philosophie ZK

Le Passkey est le choix d'authentification recommandé par défaut pour Keeplas car il partage exactement la même philosophie que le Zero Knowledge :

```
Passkey (WebAuthn)                    Zero Knowledge
──────────────────────────────────    ──────────────────────────────────
Clé privée jamais transmise     ←→   Master Key jamais transmis
Biométrie locale uniquement     ←→   Déchiffrement local uniquement
Vérification par challenge      ←→   ZK Proof d'identité
Pas de mot de passe côté serveur ←→  Pas de secret côté Convex
Résistant au phishing           ←→   Vault illisible sans clé locale
```

### Relation Passkey ↔ Master Key

```
Passkey                              Master Key (ZK)
────────────────────────────         ────────────────────────────────
Authentifie le user                  Déchiffre le vault
Prouve "c'est bien toi"              Accède aux données chiffrées
Géré par l'OS / navigateur           Géré par packages/crypto/
Stocké dans iCloud / Google          encryptedKeyBundle dans Convex

→ Le Passkey ne remplace PAS le Master Key
→ Il le protège et le déverrouille
```

### Flux Passkey à l'inscription

```typescript
// packages/crypto/passkey/register.ts

export async function registerPasskey(
  userId: string,
  masterKey: CryptoKey,
): Promise<PasskeyCredential> {
  // 1. Créer le Passkey via WebAuthn
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
        authenticatorAttachment: "platform", // Biométrie locale
        userVerification: "required", // Face ID / empreinte obligatoire
        residentKey: "required", // Passkey stocké sur l'appareil
      },
    },
  })) as PublicKeyCredential;

  // 2. Chiffrer le Master Key avec la clé publique du Passkey
  // → encryptedKeyBundle sera stocké dans Convex
  const credentialPublicKey = extractPublicKey(credential);
  const encryptedKeyBundle = await encryptWithPasskey(
    masterKey,
    credentialPublicKey,
  );

  return {
    credentialId: bufferToBase64(credential.rawId),
    publicKey: credentialPublicKey,
    encryptedKeyBundle, // → Convex (illisible sans Passkey)
    deviceName: getDeviceName(),
  };
}
```

### Flux Passkey à la connexion

```typescript
// packages/crypto/passkey/authenticate.ts

export async function authenticateWithPasskey(
  encryptedKeyBundle: string, // Récupéré depuis Convex
): Promise<CryptoKey> {
  // 1. Challenge WebAuthn — biométrie requise
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: "keeplas.com",
      userVerification: "required", // Face ID / empreinte obligatoire
    },
  })) as PublicKeyCredential;

  // 2. Déchiffrer le Master Key localement avec la clé privée du Passkey
  // La clé privée ne quitte jamais le Secure Enclave de l'appareil
  const masterKey = await decryptWithPasskey(
    base64ToBuffer(encryptedKeyBundle),
    assertion,
  );

  return masterKey;
  // Master Key disponible → vault déchiffré côté client ✅
  // Convex n'a jamais vu le Master Key
}
```

### Gestion multi-appareils

```typescript
// Ajouter un nouvel appareil avec Passkey
export const addPasskeyDevice = mutation({
  args: {
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    encryptedKeyBundle: v.string(), // Master Key re-chiffré pour ce Passkey
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const existing = user.passkeyCredentials ?? [];

    // Maximum 5 appareils par compte
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
      // Mettre à jour le encryptedKeyBundle pour ce nouvel appareil
      // (chaque appareil a son propre encryptedKeyBundle)
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

### Scénario — Nouvel appareil avec Passkey

```
Option A — Passkey synchronisé (iCloud / Google)
────────────────────────────────────────────────────
Passkey disponible automatiquement sur le nouvel appareil
    ↓
Face ID → déchiffre encryptedKeyBundle
    ↓
Master Key disponible → vault accessible ✅
(aucune action supplémentaire requise)

Option B — Passkey non synchronisé (nouvel appareil Android)
────────────────────────────────────────────────────
Authentification via Recovery Phrase ou Social Recovery
    ↓
Master Key reconstruit côté client
    ↓
Nouveau Passkey créé sur le nouvel appareil
    ↓
Master Key re-chiffré avec le nouveau Passkey
    ↓
Nouveau encryptedKeyBundle + passkeyCredentials mis à jour dans Convex
```

### Révoquer un appareil perdu

```typescript
export const revokePasskeyDevice = mutation({
  args: {
    userId: v.id("users"),
    credentialId: v.string(), // ID de l'appareil à révoquer
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

## 5. Zero Knowledge & Cryptographie

### 4.1 Génération du Master Key (100% client)

```typescript
// packages/crypto/aes/masterKey.ts

import { generateKey, exportKey, importKey } from "./webCrypto";
import { splitSecret } from "../shamir/split";
import { deriveRecoveryPhrase } from "../recovery/bip39";

export async function generateMasterKey() {
  // 1. Générer la clé AES-256-GCM via Web Crypto API
  const masterKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"],
  );

  // 2. Exporter en raw bytes pour Shamir
  const rawKey = await window.crypto.subtle.exportKey("raw", masterKey);
  const keyBytes = new Uint8Array(rawKey);

  // 3. Dériver la Recovery Phrase (BIP-39)
  // La phrase N'EST PAS envoyée au serveur
  const recoveryPhrase = deriveRecoveryPhrase(keyBytes); // 24 mots

  // 4. Calculer le hash de vérification (envoyé à Convex)
  const phraseHash = await hashRecoveryPhrase(recoveryPhrase);

  // 5. Split Shamir 3-of-5
  const shards = splitSecret(keyBytes, 5, 3);
  // shards[0] → appareil local
  // shards[1] → Contact A
  // shards[2] → Contact B
  // shards[3] → Contact C
  // shards[4] → Keeplas (shard 5, chiffré ZK)

  return {
    masterKey, // Reste en mémoire locale uniquement
    rawKey: keyBytes, // Idem
    recoveryPhrase, // Affiché une fois, jamais stocké
    phraseHash, // → Convex
    shards, // Chiffrés avant envoi à Convex
  };
}

async function hashRecoveryPhrase(phrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phrase);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return "sha256:" + bufferToHex(hash);
}
```

### 4.2 Chiffrement des Shards avant envoi à Convex

```typescript
// packages/crypto/shamir/encryptShards.ts

export async function encryptShardForContact(
  shard: Uint8Array,
  contactPublicKey: string, // Clé publique EC du contact
): Promise<string> {
  // ECDH : chiffrement asymétrique
  // Seul le contact (avec sa clé privée) peut déchiffrer
  const encrypted = await ecdhEncrypt(shard, contactPublicKey);
  return bufferToBase64(encrypted);
  // Ce résultat chiffré est envoyé à Convex
  // Convex ne peut pas déchiffrer sans la clé privée du contact
}

export async function encryptShardForKeeplus(
  shard: Uint8Array,
  zkVerifierKey: string, // Clé publique du circuit Noir
): Promise<string> {
  // Chiffré de façon à ne pouvoir être déchiffré
  // qu'en fournissant une ZK Proof valide
  const encrypted = await zkEncrypt(shard, zkVerifierKey);
  return bufferToBase64(encrypted);
}
```

### 4.3 Chiffrement du vault (AES-256-GCM)

```typescript
// packages/crypto/aes/encrypt.ts

export async function encryptVaultItem(
  content: string,
  masterKey: CryptoKey,
): Promise<{ encryptedContent: string; contentHash: string }> {
  // IV aléatoire pour chaque chiffrement
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encoded = new TextEncoder().encode(content);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    encoded,
  );

  // Préfixer l'IV au ciphertext pour le déchiffrement
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  const encryptedContent = bufferToBase64(combined);

  // Hash pour vérification d'intégrité
  const hash = await window.crypto.subtle.digest("SHA-256", encrypted);
  const contentHash = "sha256:" + bufferToHex(hash);

  return { encryptedContent, contentHash };
  // Seul encryptedContent est envoyé à Convex — illisible sans masterKey
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
  // Déchiffrement 100% côté client — Convex n'est jamais impliqué
}
```

### 4.4 Zero Knowledge Proof — Circuit Noir

```typescript
// packages/crypto/zk/keeplasShard.ts
// Ce code tourne côté client uniquement (WASM)

import { BarretenbergBackend } from "@noir-lang/backend_barretenberg";
import { Noir } from "@noir-lang/noir_js";
import circuit from "./circuits/keeplas_identity.json";

export async function generateIdentityProof(
  secretInput: Uint8Array, // Dérivé du Master Key — jamais transmis
  publicInput: string, // Identifiant public du user
): Promise<{ proof: Uint8Array; publicSignals: string[] }> {
  const backend = new BarretenbergBackend(circuit);
  const noir = new Noir(circuit, backend);

  // La proof prouve : "je connais un secret tel que hash(secret) = publicInput"
  // Sans révéler le secret lui-même
  const { proof, publicInputs } = await noir.generateFinalProof({
    secret: Array.from(secretInput), // Resté côté client
    identity_hash: publicInput, // Connu de Convex
  });

  return { proof, publicSignals: publicInputs };
}

// Côté Convex (vérification uniquement — pas de secret)
export async function verifyIdentityProof(
  proof: Uint8Array,
  publicSignals: string[],
  verifierKey: string, // zkVerifierKey stocké dans users
): Promise<boolean> {
  // Convex vérifie la proof mathématiquement
  // Sans jamais connaître le secret
  const backend = new BarretenbergBackend(circuit);
  const noir = new Noir(circuit, backend);
  return await noir.verifyFinalProof({ proof, publicInputs: publicSignals });
}
```

---

## 6. Recovery — Flux Complets

### 5.1 Recovery via Recovery Phrase (Option A)

```
ÉTAPE 1 — User entre ses 24 mots (client uniquement)
────────────────────────────────────────────────────
User saisit les 24 mots dans l'interface
    ↓
BIP-39 → reconstruit les raw bytes du Master Key
    ↓
hash(phrase) calculé localement
    ↓
Convex query : recoveryPhraseHash === hash calculé ?
    ↓ OUI
Master Key reconstruit localement ✅
    ↓
ÉTAPE 2 — Regénération du shard local
────────────────────────────────────────────────────
Nouveau shard 1 généré pour le nouvel appareil
    ↓
Chiffré avec la biométrie du nouvel appareil
    ↓
Nouveau encryptedKeyBundle → sauvegardé dans Convex
    ↓
Vault accessible sur le nouvel appareil ✅
```

```typescript
// packages/crypto/recovery/phraseRecovery.ts

export async function recoverFromPhrase(
  inputPhrase: string,
  storedHash: string, // Récupéré depuis Convex
): Promise<CryptoKey | null> {
  // 1. Vérifier le hash localement
  const inputHash = await hashRecoveryPhrase(inputPhrase);
  if (inputHash !== storedHash) return null; // Phrase incorrecte

  // 2. Reconstruire le Master Key depuis la phrase
  const rawKey = phraseToKeyBytes(inputPhrase); // BIP-39 inverse

  // 3. Importer en CryptoKey
  const masterKey = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return masterKey;
  // Le Master Key est reconstruit — jamais envoyé à Convex
}
```

### 5.2 Recovery Sociale (Option B — 2 contacts minimum)

```
ÉTAPE 1 — Contact A soumet son shard
────────────────────────────────────────────────────
Contact A entre sa Recovery Phrase personnelle (client A)
    ↓
Reconstruit sa clé privée locale
    ↓
Récupère son encryptedShard depuis Convex
    ↓
Déchiffre le shard avec sa clé privée → Shard A en clair
    ↓
Shard A transmis de façon sécurisée au flux de recovery
(via canal chiffré E2E entre les deux appareils)

ÉTAPE 2 — Contact B fait la même chose
────────────────────────────────────────────────────
Shard B obtenu côté client B

ÉTAPE 3 — Reconstruction Shamir (client du user)
────────────────────────────────────────────────────
Shard A + Shard B + Shard 5 (Keeplas via ZK proof)
    ↓
Shamir reconstruct (3 shards sur 5 = seuil atteint)
    ↓
Master Key reconstruit localement ✅
    ↓
ÉTAPE 4 — Redistribution
────────────────────────────────────────────────────
Nouveau shard 1 pour le nouvel appareil
Nouveaux shards pour les contacts si nécessaire
Nouveau keeplasShard chiffré ZK
Tous les encryptedShards mis à jour dans Convex
```

```typescript
// packages/crypto/recovery/socialRecovery.ts

export async function reconstructFromShards(
  shards: Uint8Array[], // Minimum 3 shards déchiffrés
): Promise<CryptoKey> {
  // Reconstruction Shamir (côté client uniquement)
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
  encryptedShard: string, // Récupéré depuis Convex
  contactPrivateKey: CryptoKey, // Clé privée du contact — locale uniquement
): Promise<Uint8Array> {
  const shardBytes = base64ToBuffer(encryptedShard);
  return await ecdhDecrypt(shardBytes, contactPrivateKey);
  // Déchiffrement 100% local au contact — Convex n'est jamais impliqué
}
```

### 5.3 Obtention du Shard 5 Keeplas (via ZK Proof)

```typescript
// packages/crypto/recovery/keeplasShard.ts

export async function requestKeeplasShard(
  masterKey: Uint8Array, // Partiel — reconstruit depuis d'autres shards
  userId: string,
  zkVerifierKey: string,
): Promise<Uint8Array> {
  // 1. Générer la ZK Proof d'identité (côté client)
  const { proof, publicSignals } = await generateIdentityProof(
    masterKey,
    userId,
  );

  // 2. Envoyer la proof à Convex (pas le secret)
  const encryptedShard5 = await convex.mutation(
    api.zkVerification.verifyAndReleaseShard,
    { proof: bufferToBase64(proof), publicSignals, userId },
  );
  // Convex vérifie la proof mathématiquement
  // Si valide → renvoie le shard 5 chiffré

  // 3. Déchiffrer le shard 5 côté client
  const shard5 = await zkDecrypt(base64ToBuffer(encryptedShard5), masterKey);

  return shard5;
}
```

---

## 7. Logique des Convex Functions

### 6.1 Users

```typescript
// packages/convex/users.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Création du compte — reçoit uniquement les données publiques
export const createUser = mutation({
  args: {
    email: v.optional(v.string()), // Optionnel si Passkey
    authProviders: v.array(v.string()), // ["passkey"] | ["google"] | ...
    publicKey: v.string(),
    encryptedKeyBundle: v.string(), // Master Key chiffré biométrie/passkey
    recoveryPhraseHash: v.string(), // sha256 uniquement — pas la phrase
    zkVerifierKey: v.string(),
    keeplasShard: v.string(), // Shard 5 chiffré ZK
    // Passkey spécifique
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

    // Créer le vault vide
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

    // Log audit
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

// Vérification Recovery Phrase — compare les hash uniquement
export const verifyRecoveryPhrase = mutation({
  args: {
    userId: v.id("users"),
    recoveryPhraseHash: v.string(), // sha256(phrase) calculé côté client
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Comparaison de hash — Convex ne connaît jamais la phrase
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

// Update lastSeenAt — déclenché à chaque interaction app
export const recordAppActivity = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastSeenAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Enregistrer comme signal passif
    await ctx.db.insert("passive_signals", {
      userId: args.userId,
      signalType: "app_activity",
      scoreContribution: 40,
      detectedAt: Date.now(),
      validUntil: Date.now() + 15 * 24 * 60 * 60 * 1000, // 15 jours
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
    encryptedContent: v.string(), // Chiffré côté client avant envoi
    encryptionType: v.string(),
    contentHash: v.string(),
    accessLevel: v.string(),
    isCritical: v.boolean(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Vérifier que le user est bien propriétaire du vault
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

    // Mettre à jour le compteur du vault
    await ctx.db.patch(args.vaultId, {
      encryptedItemsCount: vault.encryptedItemsCount + 1,
      updatedAt: Date.now(),
    });

    // Recalculer le Vault Integrity Score
    await recalculateIntegrityScore(ctx, args.userId, args.vaultId);

    // Log audit
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
    encryptedShard: v.string(), // Chiffré côté client avec clé publique contact
    shardPublicKeyUsed: v.string(),
  },
  handler: async (ctx, args) => {
    // Vérifier qu'il n'y a pas déjà 5 contacts
    const existing = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const active = existing.filter(
      (c) =>
        c.invitationStatus !== "revoked" && c.invitationStatus !== "declined",
    );
    if (active.length >= 5) throw new Error("Maximum 5 trusted contacts");

    // Générer token d'invitation sécurisé (72h)
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

    // Envoyer email d'invitation (via scheduled function)
    await ctx.scheduler.runAfter(0, api.notifications.sendInvitationEmail, {
      contactId,
      invitationToken,
      ownerName: (await ctx.db.get(args.userId))?.name ?? "Someone",
    });

    return contactId;
  },
});

// Confirmation du shard par le contact
export const confirmShard = mutation({
  args: {
    contactId: v.id("trusted_contacts"),
    invitationToken: v.string(),
    contactPublicKey: v.string(), // Clé publique du contact
    contactRecoveryHash: v.string(), // sha256(recovery phrase contact)
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

    // Mettre à jour le Vault Integrity Score
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
    proof: v.string(), // ZK Proof générée côté client
    publicSignals: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Vérifier la proof mathématiquement
    // Convex VÉRIFIE mais ne CONNAÎT PAS le secret
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

    // Log de l'accès au shard 5
    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: "zk.shard5.released",
      resourceType: "user",
      resourceId: args.userId,
    });

    // Retourner le shard 5 chiffré — le client le déchiffre avec sa ZK proof
    return user.keeplasShard;
  },
});
```

### 6.5 Access Requests

```typescript
// packages/convex/accessRequests.ts

// Mode B1 — Trusted Contact demande l'accès
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

    // Vérifier que le mode est autorisé pour ce contact
    if (!contact.accessModes.includes(args.accessMode as any)) {
      throw new Error("Access mode not permitted for this contact");
    }

    // Délai de refus automatique selon config du user
    const autoResponseHours = 24; // Configurable par le user
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

    // Notifier le propriétaire immédiatement
    await ctx.db.insert("notifications", {
      userId: args.vaultUserId,
      type: "access_request",
      title: `${contact.name} demande accès à votre vault`,
      body: args.reason ?? "Aucune raison précisée",
      actionUrl: `/access-requests/${requestId}`,
      channels: ["push", "email"],
      isRead: false,
      relatedId: requestId,
      relatedType: "access_request",
      createdAt: Date.now(),
    });

    // Programmer le refus automatique si pas de réponse
    await ctx.scheduler.runAt(autoResponseAt, api.accessRequests.autoDecline, {
      requestId,
    });

    return requestId;
  },
});

// Réponse du propriétaire du vault
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

    // Notifier le contact de la décision
    const contact = await ctx.db.get(request.requestedBy);
    if (contact?.contactUserId) {
      await ctx.db.insert("notifications", {
        userId: contact.contactUserId,
        type: "access_request",
        title: args.decision === "deny" ? "Accès refusé" : "Accès accordé",
        body:
          args.decision === "deny"
            ? "Le propriétaire a refusé votre demande d'accès."
            : "Vous avez maintenant accès au vault.",
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

### 7.1 Cron principal

```typescript
// packages/convex/crons.ts

import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Toutes les heures — vérifier les Life Checks dus
crons.interval(
  "life-check-scheduler",
  { hours: 1 },
  api.lifeCheck.processScheduledChecks,
);

// Toutes les 4 heures — escalade des cycles en cours
crons.interval(
  "life-check-escalation",
  { hours: 4 },
  api.lifeCheck.processEscalations,
);

// Toutes les 15 minutes — signaux passifs
crons.interval(
  "passive-signals-collector",
  { minutes: 15 },
  api.lifeCheck.collectPassiveSignals,
);

// Chaque jour — nettoyage des signaux expirés
crons.daily(
  "cleanup-expired-signals",
  { hourUTC: 2, minuteUTC: 0 },
  api.lifeCheck.cleanupExpiredSignals,
);

export default crons;
```

### 7.2 Logique principale du Life Check

```typescript
// packages/convex/lifeCheck.ts

// Déclenché toutes les heures
export const processScheduledChecks = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    // Trouver tous les Life Checks dus
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

// Démarrer un cycle
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

    // Étape 1 : Calculer le score passif immédiatement
    await ctx.scheduler.runAfter(0, api.lifeCheck.evaluatePassiveSignals, {
      cycleId,
      userId: args.userId,
    });

    return cycleId;
  },
});

// Niveau 0 — Évaluation des signaux passifs
export const evaluatePassiveSignals = internalAction({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Récupérer tous les signaux valides
    const signals = await ctx.runQuery(api.lifeCheck.getValidSignals, {
      userId: args.userId,
      validAt: now,
    });

    // Calculer le score total
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
      // Score suffisant → validation silencieuse ✅
      await ctx.runMutation(api.lifeCheck.validateCycle, {
        cycleId: args.cycleId,
        validatedBy: "passive",
        passiveScore: totalScore,
        passiveSignalUsed: bestSignal,
      });
    } else {
      // Score insuffisant → passer au niveau 1
      await ctx.runMutation(api.lifeCheck.updateCycleScore, {
        cycleId: args.cycleId,
        passiveScore: totalScore,
      });

      // Délai avant niveau 1 selon fréquence
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

// Niveau 1 — Push notification simple
export const triggerLevel1 = internalAction({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Vérifier que le cycle est encore "running"
    const cycle = await ctx.runQuery(api.lifeCheck.getCycle, {
      cycleId: args.cycleId,
    });
    if (cycle?.status !== "running") return; // Déjà validé

    await ctx.runMutation(api.lifeCheck.updateCycleLevel, {
      cycleId: args.cycleId,
      level: 1,
    });

    // Envoyer push notification "Tout va bien ? 👍"
    await ctx.runMutation(api.notifications.sendLifeCheckPush, {
      userId: args.userId,
      cycleId: args.cycleId,
      message: "Tout va bien ?",
    });

    // Récupérer config pour délai suivant
    const config = await ctx.runQuery(api.lifeCheck.getConfig, {
      userId: args.userId,
    });
    const nextChannelDelay = getNextChannelDelay(config, 1);

    // Programmer niveau 2 si pas de réponse
    await ctx.scheduler.runAfter(
      nextChannelDelay,
      api.lifeCheck.triggerNextChannel,
      { cycleId: args.cycleId, userId: args.userId, channelIndex: 0 },
    );
  },
});

// Niveaux 2+ — Escalade canal par canal
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
      // Tous les canaux épuisés → déclencher urgence
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

    // Envoyer via le canal approprié
    await ctx.runMutation(api.notifications.sendViaChannel, {
      userId: args.userId,
      cycleId: args.cycleId,
      channelType: channel.type,
    });

    // Programmer le canal suivant
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

// Validation d'un cycle (par n'importe quel niveau)
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

    // Programmer le prochain cycle
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

// Déclenchement de l'urgence
export const triggerEmergency = internalMutation({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const gracePeriodEndsAt = now + 72 * 3600 * 1000; // 72h de grâce

    await ctx.db.patch(args.cycleId, {
      status: "triggered",
      completedAt: now,
    });

    // Notifier TOUS les trusted contacts
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
          title: "Life Check — Aucune réponse détectée",
          body: "Le propriétaire du vault n'a pas répondu. Une période de grâce de 72h est en cours.",
          channels: ["push", "email"],
          isRead: false,
          relatedId: args.cycleId,
          relatedType: "life_check_cycle",
          createdAt: now,
        });
      }
    }

    // Log audit immuable
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

### 7.3 Audit Log immuable

```typescript
// packages/convex/auditLogs.ts

let lastLogHash = "genesis"; // Hash initial

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

  // Récupérer le dernier log pour la chaîne
  const lastLog = await ctx.db
    .query("audit_logs")
    .withIndex("by_created", (q) => q.eq("userId", params.userId))
    .order("desc")
    .first();

  const previousHash = lastLog?.logHash ?? "genesis";

  // Construire le hash de ce log
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
    // Pas de updatedAt — jamais modifié
  });
}
```

---

## 9. Structure des fichiers Convex

```
packages/convex/
├── schema.ts                   ← Schema complet (section 3)
├── _generated/                 ← Auto-généré par Convex CLI
├── crons.ts                    ← Scheduled functions
│
├── users.ts                    ← CRUD + recovery verification
├── vault.ts                    ← CRUD vault items
├── trustedContacts.ts          ← Invitations + confirmations shards
├── lifeCheck.ts                ← Cycles + escalade + signaux passifs
├── accessRequests.ts           ← Modes A/B
├── conditionalMessages.ts      ← Dead Man Switch messages
├── scenarios.ts                ← Scenario Engine
├── emergencyCards.ts           ← Emergency Card + QR
├── zkVerification.ts           ← Vérification ZK Proofs
├── notifications.ts            ← Envoi multi-canaux
├── auditLogs.ts                ← Log immuable + chaîne de hash
│
└── _helpers/
    ├── integrityScore.ts       ← Calcul Vault Integrity Score
    ├── secureToken.ts          ← Génération tokens sécurisés
    └── syncHash.ts             ← Hash de synchronisation vault

packages/crypto/
├── passkey/                    ← WebAuthn (NOUVEAU)
│   ├── register.ts             ← Création Passkey + chiffrement Master Key
│   ├── authenticate.ts         ← Auth Passkey + déchiffrement Master Key
│   └── multiDevice.ts          ← Ajout / révocation appareils
├── zk/
│   ├── circuits/
│   │   └── keeplas_identity.json ← Circuit Noir compilé
│   └── keeplasShard.ts         ← Génération + vérification ZK Proofs
├── aes/
│   ├── masterKey.ts            ← Génération Master Key
│   └── encrypt.ts              ← Chiffrement / déchiffrement vault items
├── shamir/
│   ├── split.ts                ← Shamir split 3-of-5
│   ├── combine.ts              ← Reconstruction depuis shards
│   └── encryptShards.ts        ← Chiffrement shards pour contacts + Keeplas
└── recovery/
    ├── bip39.ts                ← Génération Recovery Phrase 24 mots
    ├── phraseRecovery.ts       ← Recovery depuis Recovery Phrase
    └── socialRecovery.ts       ← Recovery sociale (2 contacts min)
```

---

_Document technique — Keeplas v1 — Avril 2026 — v2_
_Prochaine étape : Implémentation packages/crypto/ (Passkey + ZK circuits Noir)_
