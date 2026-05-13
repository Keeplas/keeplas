# Keeplas — Architecture, Sécurité & Décisions Produit

> Document récapitulatif complet — Mai 2026 — v5.1
>
> **Changements v5 → v5.1** : modèle d'accès simplifié (suppression des modes B1–B4 et du rôle First Responder, fusion Medical Contact / Legal Authority dans le `role` standard), threshold Shamir configurable (2-of-5 par défaut, 5 max), flux de distribution + soumission peer-to-peer ML-KEM décrits.

---

## Table des matières

1. [Présentation du Projet](#1-présentation-du-projet)
2. [Écrans Principaux](#2-écrans-principaux)
3. [Stack Technique Finale](#3-stack-technique-finale)
4. [Structure du Monorepo](#4-structure-du-monorepo)
5. [Architecture Sécurité & Contributions](#5-architecture-sécurité--contributions)
6. [Cryptographie — Zero Knowledge](#6-cryptographie--zero-knowledge)
7. [Authentification & Recovery](#7-authentification--recovery)
8. [Life Check — Système de Vérification de Survie](#8-life-check--système-de-vérification-de-survie)
9. [Life Check — Signaux Passifs & Score de Confiance](#9-life-check--signaux-passifs--score-de-confiance)
10. [Life Check — Affichage du Dernier Check](#10-life-check--affichage-du-dernier-check)
11. [Accès des Trusted Contacts](#11-accès-des-trusted-contacts)
12. [Onboarding — UX Optimale](#12-onboarding--ux-optimale)
13. [Scripts d'Installation](#13-scripts-dinstallation)
14. [Licence & Gouvernance](#14-licence--gouvernance)
15. [Standards de Contribution](#15-standards-de-contribution)
16. [Récapitulatif des Décisions Clés](#16-récapitulatif-des-décisions-clés)

---

## 1. Présentation du Projet

**Keeplas** est une **Life Continuity Platform** — une plateforme qui permet aux utilisateurs de sécuriser, organiser et transmettre leurs informations vitales (assets, directives médicales, legacy légal, contacts de confiance) de manière chiffrée et décentralisée.

|                        |                                             |
| ---------------------- | ------------------------------------------- |
| **CEO / Co-fondateur** | Prince (51%)                                |
| **CTO / Co-fondateur** | Ghislain MITAHI (49%)                       |
| **Marché cible**       | Kenya, Cameroun, Diaspora française, RDC    |
| **Modèle business**    | Freemium + Lifetime Deal Beta à $49         |
| **Approche**           | Open source (AGPL v3 + CLA) + self-hostable |

### Proposition de valeur

Keeplas résout trois problèmes fondamentaux :

- **Continuité** — s'assurer que les proches ont accès aux informations vitales si le user devient incapable ou décède
- **Sécurité** — aucune entité (pas même Keeplas) ne peut accéder au vault sans le consentement du user
- **Contrôle** — le user définit précisément qui accède à quoi, quand et dans quelles conditions

---

## 2. Écrans Principaux

L'application comprend 4 écrans principaux identifiés dans les maquettes :

### Life Map / Dashboard

Vue holistic du legacy avec "central node" au centre, continuity score (ex: 75% — Strong Protection), AI Completeness Analyzer, et Protected Zones (Financial Redundancy, Trusted Node Mesh, Real Estate Chain, Healthcare Directive Gap).

### AI Assistant

Interface chat pour la curation du vault. L'assistant analyse la complétude du vault, pose des questions ciblées, propose des quick replies, et génère un Family Guide exportable en PDF chiffré. Indicateur "END-TO-END ENCRYPTED SESSION" visible en permanence.

### Legal Legacy — Entrepreneur Portal

Portail dédié aux entrepreneurs : procédures professionnelles (SOPs, succession plan), Operational Access Keys (credentials chiffrés), Business Associates, Contingency Instructions (actions 24h, equity distribution), Operational Asset Registry avec export CSV.

### Emergency Card

Carte d'identité d'urgence publique avec Privacy Controls (Full Name, Blood Type, Allergies, Emergency Contact). Accessible aux secouristes même vault verrouillé. Options : Save to Wallet, Print Physical Card.

---

## 3. Stack Technique Finale

```
Next.js (App Router)        ← Web-first + PWA ready
├── ShadCN UI               ← Composants dans le repo (pas une black box)
├── Tailwind CSS            ← Styling natif
├── Convex                  ← Backend realtime + DB (Cloud ou Self-hosted)
├── Convex Auth             ← Authentification intégrée
├── WebAuthn (Passkey)      ← Auth recommandée — biométrie locale
├── React Flow              ← Visualisation graph (Life Map uniquement)
└── packages/crypto/        ← ZK + AES + Shamir (isolé et auditable)
```

### Justification des choix

**Next.js App Router**

- Web-first avec PWA possible via `next-pwa` si besoin
- Pas de React Native au départ — évite la complexité du monorepo mobile
- SSR/SSG natif, performant, bien connu des contributeurs open source
- Responsive natif — fonctionne sur mobile via le browser

**ShadCN UI**

- Les composants sont copiés dans le repo (`components/ui/`) — pas une dépendance externe
- Un contributeur ouvre `button.tsx` et voit du Tailwind pur, pas de magie
- Standard de l'écosystème Next.js — la majorité des contributeurs le connaissent
- Accessible par défaut (Radix UI underneath) — important pour un produit de confiance
- Theming via CSS variables : palette teal/dark navy des maquettes facilement configurable

**Composants ShadCN utilisés**
| Élément UI | Composant ShadCN |
|---|---|
| Toggles Privacy Controls | `Switch` |
| Progress bars Guide Readiness | `Progress` |
| Badges ENCRYPTED, PROTECTED | `Badge` |
| Tables Asset Registry | `Table` |
| Cards Life Map nodes | `Card` |
| Chat input + quick replies | `Input` + `Button` |
| Dropdown actions (⋮) | `DropdownMenu` |
| Sidebar navigation | Layout custom |

**Convex Auth + WebAuthn (Passkey)**

- Passkey recommandé par défaut — biométrie locale, clé privée jamais transmise
- Alignement parfait avec la philosophie ZK : rien de secret ne quitte l'appareil
- Résistant au phishing (lié au domaine keeplas.com uniquement)
- Multi-device via iCloud Keychain / Google Password Manager
- Fallback : Google OAuth, Apple OAuth, Email + mot de passe
- Dans tous les cas, la Recovery Phrase reste le backup ultime
- Realtime out of the box
- Disponible en Cloud (managed) ou Self-hosted (Docker) au choix du user
- S'intègre proprement dans un monorepo Turborepo

**pnpm + Turborepo**

- Plus rapide que npm, store centralisé (pas de duplication `node_modules`)
- Monorepo natif avec workspaces
- Bloque les phantom dependencies — réduit les risques de supply chain attacks
- Standard open source moderne

**React Flow** (Life Map uniquement)

- ShadCN ne couvre pas les visualisations graph/node
- Nécessaire pour le "central node" et les connexions du dashboard

---

## 4. Structure du Monorepo

```
keeplas/
├── apps/
│   └── web/                        ← Next.js app (Web + PWA)
│       ├── app/                    ← App Router pages
│       ├── components/
│       │   ├── ui/                 ← ShadCN components
│       │   ├── vault/
│       │   ├── life-check/
│       │   ├── trusted-contacts/
│       │   └── emergency-card/
│       └── lib/
├── packages/
│   ├── crypto/                     ← Zone RESTRICTED ⚠️
│   │   ├── zk/                     ← Circuits Noir/Barretenberg
│   │   ├── aes/                    ← AES-256-GCM (Web Crypto API)
│   │   ├── shamir/                 ← Secret Sharing threshold-of-5 (configurable, 2 par défaut)
│   │   └── __tests__/              ← Tests unitaires isolés
│   ├── convex/                     ← Schema + Functions Convex
│   └── ui/                         ← Composants ShadCN partagés
├── scripts/
│   ├── install.sh                  ← Script d'installation universel
│   ├── setup-dev.sh                ← Setup environnement dev
│   ├── setup-convex.sh             ← Installation Convex (Cloud ou Self-hosted)
│   ├── setup-crypto.sh             ← Installation Noir/Barretenberg
│   └── health-check.sh             ← Vérification que tout tourne
├── security/
│   └── audits/                     ← Rapports d'audit publics
├── docker-compose.yml              ← Self-hosting production
├── docker-compose.dev.yml          ← Développement local
├── .env.example                    ← Toutes les variables documentées
├── turbo.json                      ← Configuration Turborepo
├── pnpm-workspace.yaml             ← Workspaces pnpm
├── .github/
│   ├── CODEOWNERS
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── security.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── security_vulnerability.md  ← Redirige vers email privé
│   └── PULL_REQUEST_TEMPLATE.md
├── LICENSE                         ← AGPL v3
├── CONTRIBUTOR_LICENSE_AGREEMENT.md
├── CONTRIBUTING.md
├── SECURITY.md
└── CODE_OF_CONDUCT.md
```

---

## 5. Architecture Sécurité & Contributions

### Séparation stricte des zones

| Zone               | Périmètre                  | Accès                    |
| ------------------ | -------------------------- | ------------------------ |
| `apps/web/`        | UI, pages, composants      | ✅ Tout le monde         |
| `packages/ui/`     | ShadCN components          | ✅ Tout le monde         |
| `packages/convex/` | Schema, queries, functions | ✅ Tout le monde         |
| `packages/crypto/` | ZK, AES, Shamir            | ⚠️ Fondateurs uniquement |
| `security/`        | Audits, rapports           | ⚠️ Fondateurs uniquement |

### CODEOWNERS

```
# .github/CODEOWNERS
/packages/crypto/     @prince-keeplas @ghislain-keeplas
/security/            @prince-keeplas @ghislain-keeplas
/apps/web/            *
/packages/ui/         *
/packages/convex/     *
```

Toute PR touchant `/crypto` ne peut pas être mergée sans approbation explicite des deux fondateurs.

### Pipeline CI/CD de sécurité

```yaml
# .github/workflows/security.yml
- CodeQL              ← Analyse statique du code
- Dependabot          ← Vulnérabilités des dépendances
- pnpm audit          ← Audit des packages
- Tests crypto        ← Obligatoires avant tout merge sur /crypto
- Snyk / Socket.dev   ← Supply chain attacks
```

### Ce qu'on ne met JAMAIS dans le repo public

- Fichiers `.env` avec de vraies valeurs
- Scripts d'infra interne de production
- Audits de sécurité internes
- Clés de chiffrement (jamais, sous aucune forme)
- Credentials de comptes (Convex, email, backup)

---

## 6. Cryptographie — Zero Knowledge

### Stack cryptographique

| Composant              | Technologie                          | Rôle                                                                                        |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Zero-Knowledge Proofs  | Noir + Barretenberg                  | Preuves ZK côté client — auditables                                                         |
| Chiffrement symétrique | AES-256-GCM (Web Crypto API)         | Chiffrement vault côté client                                                               |
| Secret Sharing         | Shamir threshold-of-5 (configurable) | Distribution et recovery des clés. Threshold choisi à l'onboarding (2-5) ; défaut 2-of-5.   |
| ML-KEM-768 (FIPS 203)  | @noble/post-quantum                  | Wrap des shards et DEKs vers les clés publiques recipient (post-quantum, remplace RSA-OAEP) |

### Principe d'isolation

Le package `packages/crypto/` est entièrement isolé pour que :

- Les auditeurs de sécurité peuvent le reviewer indépendamment de l'app
- Les tests unitaires sont séparés et exhaustifs
- Le versioning est indépendant
- Les contributeurs non-crypto peuvent contribuer sans y toucher

### Vocabulaire utilisateur (jamais de jargon technique dans l'UI)

| Terme technique       | Terme UI                                                  |
| --------------------- | --------------------------------------------------------- |
| Shard Shamir          | Fragment de clé                                           |
| ZK Proof              | Preuve d'identité sécurisée                               |
| Master Key            | Clé secrète personnelle                                   |
| AES-256-GCM           | Chiffrement de bout en bout                               |
| Quorum threshold-of-5 | "X contacts sur 5 requis" (X dépend du choix utilisateur) |

---

## 7. Authentification & Recovery

### Génération à l'inscription

```
Master Key (256 bits) — généré localement, jamais transmis
      ↓
AES-256-GCM chiffre l'intégralité du vault
      ↓
Shamir Secret Sharing → split en 5 shards (seuil : 3)
      ↓
Distribution des 5 shards
```

### Distribution des shards

```
Shard 1 → Appareil du user      (chiffré biométrie/PIN local)
Shard 2 → Trusted Contact A     (stocké dans son app Keeplas)
Shard 3 → Trusted Contact B     (stocké dans son app Keeplas)
Shard 4 → Trusted Contact C     (stocké dans son app Keeplas)
Shard 5 → Keeplas               (chiffré, inaccessible sans ZK proof)
```

Pour déchiffrer le vault : **3 shards sur 5 sont nécessaires**. Aucune entité seule (ni Keeplas, ni un seul contact) ne peut ouvrir le vault.

### Recovery du user (perte d'appareil)

**Option A — Social Recovery**

```
Minimum 2 trusted contacts confirment l'identité du user
Chacun soumet son shard via sa propre Recovery Phrase
Quorum atteint → nouveau shard généré pour le nouvel appareil
```

**Option B — Recovery Phrase personnelle**

```
24 mots générés à l'inscription (BIP-39)
Permettent de reconstruire le Master Key sans les contacts
À noter sur papier — ne jamais photographier
```

### Recovery des Trusted Contacts

Chaque trusted contact reçoit à son onboarding :

- Son shard Shamir (stocké dans l'app Keeplas sur son appareil)
- Sa propre Recovery Phrase de 24 mots pour retrouver son shard si il perd son appareil

**Cas critique** : si un trusted contact perd son shard ET sa Recovery Phrase, le user doit le remplacer manuellement et redistribuer les shards concernés.

### Remplacement d'un Trusted Contact

```
User initie le remplacement depuis son vault
      ↓
Nouveau contact invité et onboardé
      ↓
Nouveaux shards générés et redistribués
      ↓
Ancien shard révoqué et invalidé
      ↓
Notification à tous les contacts du changement
```

---

## 8. Life Check — Système de Vérification de Survie

### Philosophie anti-faux-positifs

> Ne jamais déclencher l'accès d'urgence sur un seul signal manqué. Toujours escalader progressivement à travers tous les canaux configurés.

### Fréquences configurables par le user

| Fréquence         | Profil recommandé                       | Délai total avant déclenchement |
| ----------------- | --------------------------------------- | ------------------------------- |
| **Hebdomadaire**  | Situation à risque élevé, maladie grave | ~5 jours                        |
| **Mensuelle**     | Standard — recommandé par défaut        | ~5 jours                        |
| **Trimestrielle** | Jeune, bonne santé                      | ~14 jours minimum               |

### Canaux configurables (ordonnés par le user)

Le user définit son ordre d'escalade parmi ces canaux :

```
□ In-app notification (push)
□ Email
□ WhatsApp / SMS
□ Appel automatisé (IVR)
```

Le drag & drop dans l'interface permet de réordonner les canaux librement. La validation humaine en dernier recours est désormais portée par **tous** les trust contacts via leur action `Mark as unreachable` (voir section 11) — il n'existe plus de rôle "First Responder" séparé.

### Workflow Mensuel (Standard)

```
Jour J — 09:00
├── Canal 1 : Push notification
│   "Keeplas Life Check — Confirmez que vous allez bien"
│   [Je suis en vie ✅]  [Reporter 48h]
│
│   ← Pas de réponse après 24h
│
├── Jour J+1 — Canal 2 : Email + Canal 3 : WhatsApp (simultanés)
│   Lien de confirmation unique (token 72h)
│   [Je suis en vie ✅]  [Je suis hospitalisé — reporter 7j]
│
│   ← Pas de réponse après 48h supplémentaires
│
├── Jour J+3 — Canal 4 : Appel automatisé IVR
│   "Appuyez sur 1 si vous êtes en vie"
│   "Appuyez sur 2 pour reporter de 7 jours"
│   3 tentatives espacées de 4h
│
│   ← Pas de réponse
│
├── Jour J+4 — cycle.status = "escalating"
│   Tous les trust contacts notifiés.
│   ≥threshold contacts cliquent "Mark as unreachable"
│   pour confirmer l'injoignabilité humaine.
│
│   ← Quorum atteint
│
└── Jour J+5 → Déclenchement protocole accès d'urgence (grace 72h)
```

### Workflow Hebdomadaire (Accéléré)

```
Jour J     Canal 1                  → 12h sans réponse
Jour J+0.5 Canal 2+3                → 24h sans réponse
Jour J+1.5 Canal 4 (IVR)            → 36h sans réponse
Jour J+2   Escalating (contacts)    → quorum humain
Jour J+2.5 → Déclenchement
```

### Workflow Trimestriel (Exhaustif — règle stricte)

```
⚠️ TOUS les canaux configurés doivent être épuisés
   avant tout déclenchement — sans exception.

Jour J      Canal 1           → 72h sans réponse
Jour J+3    Canal 2+3         → 5 jours sans réponse
Jour J+8    Canal 4 (IVR)    → 7 jours sans réponse
Jour J+13   Canal 5 (FR)      → confirmation humaine obligatoire
Jour J+14   → Déclenchement (minimum J+14)
```

### Cas particuliers

**Voyage / Expédition**

```
User suspend le Life Check (max 90 jours)
Confirmation de date de reprise obligatoire
Mode "expédition" pour zones sans réseau :
  → Délais automatiquement étendus
  → Premier canal = SMS (plus fiable hors réseau)
```

**Hospitalisation**

```
Déclenché par le user avant l'hospitalisation (mode pause)
OU par un Trusted Contact médical désigné
Date de reprise automatique configurable
```

**Faux positif post-déclenchement**

```
Fenêtre de grâce de 72h après déclenchement
Le user peut annuler l'accès d'urgence dans ce délai
Log de l'annulation visible par tous les trusted contacts
Notification immédiate à tous les contacts en cas d'annulation
```

**Reporter manuellement**

```
Options disponibles à chaque canal :
  → Reporter 48h (une seule fois par cycle)
  → Reporter 7 jours (mode hospitalisation)
  → Suspendre jusqu'à [date] (mode voyage)
```

---

## 9. Life Check — Signaux Passifs & Score de Confiance

### Principe : "Passive First, Active Only If Needed"

La vérification passive est la première ligne de défense. Le user n'est sollicité activement que si les signaux passifs sont insuffisants. Objectif : zéro friction pour le user vivant et actif.

```
Niveau 0 — Signaux passifs automatiques    ← Zéro action du user
Niveau 1 — Confirmation légère (un tap)    ← Seulement si niveau 0 échoue
Niveau 2 — Canaux actifs (email, SMS...)   ← Seulement si niveau 1 échoue
Niveau 3 — Trust contacts confirment       ← Action humaine collective
Niveau 4 — Déclenchement accès d'urgence (grace 72h puis quorum Shamir)
```

---

### Niveau 0 — Signaux passifs disponibles

**Via l'app Keeplas**

```
Dernière ouverture de l'app
Dernière interaction (scroll, tap, navigation)
Dernière modification du vault
Dernière session active
```

**Via le système mobile / browser**

```
Activité de l'appareil (screen unlock)
→ Android : permission "Usage Stats"
→ iOS : dernière session app détectable

Localisation GPS (optionnel, si user l'autorise)
→ Mouvement détecté = signal positif
→ Position habituelle = signal positif

Santé / activité physique (optionnel)
→ Apple Health / Google Fit
→ Pas de mouvement 48h = signal d'alerte
→ Rythme cardiaque anormal = signal d'alerte
```

**Via services tiers (optionnel, consentement explicite)**

```
WhatsApp Business API
→ Détection de présence "en ligne" récente
→ Pas de message envoyé — juste détection passive

Google Activity
→ Dernière activité Gmail, Drive, Search
→ Signal fort de vie active

Calendrier (Google / Apple)
→ Événements futurs créés récemment
→ Réunions acceptées = signal de vie

Apple Watch / Wear OS
→ Rythme cardiaque, activité, sommeil
→ Intégration via Health API
```

---

### Score de Confiance

Chaque signal a un poids. Le score détermine si le niveau 0 valide le cycle ou s'il faut passer au niveau 1.

| Signal                         | Poids  | Fenêtre de détection |
| ------------------------------ | ------ | -------------------- |
| Ouverture app Keeplas          | 40 pts | 15 jours             |
| Interaction vault              | 30 pts | 15 jours             |
| Activité appareil (unlock)     | 20 pts | 7 jours              |
| Mouvement GPS                  | 20 pts | 7 jours              |
| Activité WhatsApp              | 15 pts | 10 jours             |
| Activité Google / Calendar     | 15 pts | 10 jours             |
| Données santé normales         | 25 pts | 3 jours              |
| Apple Watch / rythme cardiaque | 35 pts | 24h                  |

**Seuil de validation passive : ≥ 50 points**
En dessous du seuil → passage automatique au niveau 1.

---

### Workflow mensuel révisé avec signaux passifs

```
Jour J — Vérification due
│
├── NIVEAU 0 : Collecte silencieuse (automatique)
│   Score ≥ 50 pts → ✅ Cycle validé silencieusement
│                     Prochain check dans 30 jours
│                     Aucune action demandée au user
│
│   Score < 50 pts → Niveau 1
│
├── NIVEAU 1 : Confirmation légère (J+1)
│   Push notification discrète :
│   "Tout va bien ? [👍]"  ← un seul tap, pas d'écran
│   Réponse dans 24h → ✅ Cycle validé
│   Pas de réponse → Niveau 2
│
├── NIVEAU 2 : Canaux actifs (J+2 à J+4)
│   Email → WhatsApp → IVR (ordre configuré par le user)
│   Chaque canal : délai configurable
│   Pas de réponse → Niveau 3
│
├── NIVEAU 3 : Trust contacts confirment (J+4)
│   Tous les trust contacts notifiés "We can't reach [user]"
│   ≥threshold cliquent "Mark as unreachable" depuis leur dashboard
│   Pas de quorum → cycle reste pending sans déclenchement
│
└── NIVEAU 4 : Déclenchement accès d'urgence (J+5)
    Grace 72h démarre. À expiration : phase Shamir (soumission shards
    + reconstruction MasterKey côté contact, jamais côté serveur).
```

---

### Impact des signaux passifs sur les fréquences

```
Hebdomadaire
→ Niveau 0 vérifié chaque semaine silencieusement
→ User sollicité seulement si 0 signal sur 7 jours
→ Friction quasi nulle en pratique

Mensuel
→ Niveau 0 vérifié à J, J+3, J+7 (3 tentatives passives)
→ Si insuffisant → Niveau 1 (un tap)
→ Friction minimale

Trimestriel
→ Niveau 0 vérifié plusieurs fois sur 2 semaines
→ Tous les canaux actifs obligatoires si niveau 0 échoue
→ Déclenchement urgence quasi impossible sans vraie absence
```

---

### Configuration des signaux passifs par le user

```
Signaux passifs — Paramètres
─────────────────────────────────────────────────────
✅ Activité dans l'app Keeplas        (toujours actif)
✅ Activité de l'appareil             (recommandé)
□  Localisation GPS                   (optionnel)
□  Activité WhatsApp                  (optionnel)
□  Activité Google / Calendar         (optionnel)
□  Apple Health / Google Fit          (optionnel)
□  Apple Watch / Wear OS              (optionnel)
```

Indicateur d'encouragement dans l'app :

```
"Avec vos paramètres actuels :
 Probabilité d'être sollicité manuellement : Élevée

 Activez la localisation GPS pour réduire
 les vérifications manuelles"
```

---

### Règles de vie privée sur les signaux passifs

- Consentement explicite pour chaque signal (opt-in uniquement)
- Données traitées localement sur l'appareil si possible (on-device)
- Jamais vendues ni utilisées à d'autres fins que le Life Check
- Supprimables à tout moment depuis les paramètres
- Transparence totale : le user voit exactement quel signal a validé son cycle

---

### Limites et faux positifs des signaux passifs

Certains signaux peuvent être trompeurs — d'où le scoring multi-signaux :

```
GPS actif mais user inconscient dans ambulance → faux positif
Appareil déverrouillé par quelqu'un d'autre   → faux positif
Apple Watch portée par quelqu'un d'autre       → faux positif
```

Un seul signal fort ne suffit jamais. Le seuil de 50 pts impose la combinaison de plusieurs sources indépendantes.

---

## 10. Life Check — Affichage du Dernier Check

### Principe de transparence

Le user et ses trusted contacts doivent toujours savoir quand le dernier check a eu lieu et comment il a été validé. C'est un élément de confiance fondamental dans le produit.

---

### Informations affichées

```
Dernier check     : 12 Avril 2026 à 09:14
Type              : Automatique (activité app)
Prochain check    : 12 Mai 2026
Statut            : ✅ Actif — Protection en cours
```

### Granularité par type de signal

Chaque check indique précisément comment il a été validé :

| Icône | Type        | Description                           |
| ----- | ----------- | ------------------------------------- |
| ✅    | Automatique | Activité dans l'app Keeplas           |
| ✅    | Automatique | Activité de l'appareil                |
| ✅    | Automatique | Mouvement GPS détecté                 |
| ✅    | Automatique | Activité WhatsApp                     |
| ✅    | Automatique | Activité Google / Calendar            |
| ✅    | Automatique | Données santé normales                |
| 👆    | Manuel      | Confirmation par tap                  |
| 📧    | Manuel      | Confirmation par email                |
| 📞    | Manuel      | Confirmation par appel                |
| 👤    | Manuel      | Confirmé par quorum de trust contacts |

---

### Où afficher cette information

**Dashboard / Life Map — Widget Life Check**

```
┌─────────────────────────────────────────┐
│ 🛡️  Life Check                           │
│                                         │
│ Dernier check    12 Avr 2026  09:14     │
│ Via              Automatique (app)      │
│ Prochain check   12 Mai 2026            │
│                                         │
│ [Voir l'historique]                     │
└─────────────────────────────────────────┘
```

**Page Life Check — Historique complet**

```
Avril 2026
──────────────────────────────────────────────
✅ 12 Avr  09:14   Automatique (app)
✅ 12 Mar  14:32   Automatique (GPS)
👆 10 Fév  11:05   Manuel (tap)
✅ 10 Jan  —       Automatique (WhatsApp)

[Charger plus]
```

**Vue Trusted Contact — Information limitée**

Les contacts voient le statut mais pas le détail du signal (vie privée du user) :

```
[Nom du user]
Dernier check  : Il y a 3 jours  ✅
Statut         : Actif
Prochain check : Dans 27 jours
```

---

## 11. Accès des Trusted Contacts

### Modèle simplifié — un seul flux, deux rôles

Le modèle a été délibérément simplifié pour aligner promesse zero-knowledge et UX. **Trusted Contact** est l'unique rôle actif (validation + détention de shard + ouverture du vault). **Recipient** est le rôle passif (réception de contenu pré-assigné après ouverture). Plus de modes B1/B2/B3/B4, plus de First Responder, plus de Medical Contact ni Legal Authority comme rôles distincts.

```
TRUSTED CONTACT (actif) — détient 1 shard Shamir
  ① Confirme l'injoignabilité du user (validation humaine)
  ② Soumet son shard une fois la grâce expirée
  ③ Participe au quorum cryptographique (threshold-of-5)

RECIPIENT (passif) — pas de shard, pas de validation
  Reçoit son contenu pré-assigné après ouverture du vault
```

---

### Threshold configurable

Le user choisit son threshold à l'onboarding (entre 2 et 5). Stocké dans `users.vaultThreshold`. Le défaut **2-of-5** maximise la facilité de récupération ; un threshold plus élevé renforce la résistance à la collusion mais demande plus de contacts joignables au moment de la recovery. Changer le threshold après distribution implique une re-distribution complète des shards.

| Threshold           | Trade-off                                                                          |
| ------------------- | ---------------------------------------------------------------------------------- |
| **2-of-5** (défaut) | Recovery facile. 2 contacts suffisent. Moins résistant à la collusion d'une paire. |
| **3-of-5**          | Résiste à une paire compromise.                                                    |
| **4-of-5**          | Forte sécurité. Recovery peut bloquer si ≥2 contacts indisponibles.                |
| **5-of-5**          | Aucune collusion possible. Un seul contact manquant = vault verrouillé.            |

---

### Flux d'accès post-mortem (unique)

```
1. DÉTECTION
   Life Check passif KO (signaux insuffisants)
       ↓
   Canaux actifs (push → email → WhatsApp → SMS → IVR) tentent
   de joindre le user. Tous échouent → cycle.status = "escalating"

2. NOTIFICATION
   Tous les trusted contacts notifiés :
   "Nous n'arrivons pas à joindre [user]"

3. CONFIRMATION SOCIALE
   ≥threshold contacts cliquent "Mark as unreachable" depuis
   /shared-with-me (bouton visible uniquement quand le cycle
   du owner est en escalating).
       ↓
   access_request.contactsInitiated.length atteint le quorum
       ↓
   Notification au user + démarrage du compte à rebours 72h

4. GRACE PERIOD 72H
   Le user a une dernière fenêtre pour réapparaître. Sign-in +
   "I am well" → cycle annulé, request fermée, contacts notifiés.
   Aucun contenu ne quitte jamais le vault dans ce scénario.

5. SOUMISSION CRYPTOGRAPHIQUE
   Après les 72h, chaque trust contact peut soumettre son shard.
   Le shard brut est lu depuis IndexedDB local, puis wrappé en
   ML-KEM-768 vers la clé publique de chaque autre trust contact
   (fan-out wrap). Le serveur stocke uniquement les enveloppes.

6. RECONSTRUCTION CLIENT-SIDE
   Quand ≥threshold contacts ont soumis leur shard, n'importe
   quel submitter peut :
     - fetch les enveloppes adressées à lui
     - les unwrap avec sa clé privée ML-KEM
     - combiner avec son propre shard local
     - reconstruire la MasterKey via Shamir (côté client uniquement)

7. DISTRIBUTION
   Avec la MasterKey, le contact ouvre le vault en mode lecture
   "memorial". Les recipients reçoivent le contenu pré-assigné
   selon les recipient_groups + sharedWithContacts définis par
   le user de son vivant.
```

---

### Garde-fous

- **Fail-closed sur la validation** : si aucun trust contact ne confirme l'injoignabilité, le vault reste fermé indéfiniment. Pas de timeout automatique côté serveur qui ouvrirait le vault sans intervention humaine.
- **72h de grâce** : le user peut toujours annuler tant que la fenêtre n'est pas écoulée. La cancellation notifie tous les contacts.
- **Zero-knowledge strict** : le serveur ne voit jamais un shard en clair. Distribution = wrap ML-KEM ; soumission = wrap ML-KEM peer-to-peer (fan-out) ; reconstruction = client-side uniquement.
- **Trade-off de collusion** : avec threshold = 2, deux contacts complices peuvent à la fois confirmer l'injoignabilité ET ouvrir le vault. Le Life Check (échec sur tous les canaux) + les 72h de grâce restent les seuls garde-fous additionnels. Le user peut élever le threshold s'il anticipe ce risque.
- **Audit immuable** : chaque action (mark unreachable, submit shard, reconstruction) est tracée dans `audit_logs` avec hash-chaining tamper-evident.

---

### Ce qui a été supprimé du modèle initial

| Concept supprimé                             | Raison                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modes B1/B2/B3/B4**                        | Dispersion produit. La promesse Keeplas v1 est la succession numérique, pas une plateforme de partage généraliste.                                                                                            |
| **First Responder**                          | Doublonnait la confirmation sociale par les trust contacts. La fonction (validation humaine) est conservée mais portée par tous les trust contacts via `markUserUnreachable`.                                 |
| **Medical Contact / Legal Authority**        | Rôles distincts inutiles. Le `role` de chaque contact (lawyer, doctor, family, friend, other) suffit pour la sémantique métier ; aucun privilège crypto associé.                                              |
| **Recovery du vivant via demande on-demand** | Le user vivant utilise sa phrase 24 mots (path A). En cas de perte de la phrase, il peut déclencher manuellement une recovery via les contacts (path B), qui suit exactement le même flux Shamir post-mortem. |

---

### Récupération du vivant

Si le user perd l'accès à son device mais possède toujours sa phrase 24 mots :

- Argon2id(24 mots, phraseSalt) → RootKey → unwrap(encryptedKeyBundle) → MasterKey. Aucun contact impliqué.

Si le user perd la phrase 24 mots :

- Les trust contacts peuvent collaborer (≥threshold) pour reconstruire la MasterKey, exactement comme en post-mortem. Le user peut ensuite générer une nouvelle phrase et re-wrapper la MasterKey sous une nouvelle RootKey. Le vault reste inchangé ; seule la phrase d'accès change.

Les 24 mots eux-mêmes ne sont jamais récupérables — c'est une dérivation à sens unique. Aucune entité (Keeplas, contacts, autre device) ne peut les reproduire.

---

## 12. Onboarding — UX Optimale

### Philosophie générale

> L'app est le guide. Pas de tunnel, pas de démo forcée. Le user arrive dans le produit et comprend naturellement quoi faire grâce au score, aux nudges contextuels et à l'assistant.

Deux seules étapes bloquantes — tout le reste est découverte progressive.

```
BLOQUANT  → Étape 0 : Inscription (2 min)
BLOQUANT  → Étape 1 : Recovery Phrase (90 secondes)
PROGRESSIF → Tout le reste via Vault Integrity Score + nudges
```

---

### Étape 0 — Inscription (2 minutes max)

Écran minimaliste. On ne demande que le strict nécessaire. Le Passkey est proposé en premier — c'est le choix le plus sécurisé et le plus fluide.

```
┌─────────────────────────────────────────┐
│           🔐 Keeplas                    │
│                                         │
│   Sécurisez votre legacy en 2 minutes  │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  🪪 Créer avec Passkey  ★       │   │
│   │     Face ID / Empreinte         │   │
│   │     Le plus sécurisé            │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ──────────── ou ────────────          │
│                                         │
│   [Continuer avec Google]               │
│   [Continuer avec Apple]                │
│                                         │
│   ──────────── ou ────────────          │
│                                         │
│   Email                                 │
│   Mot de passe                          │
│                                         │
│   [Créer mon vault →]                   │
└─────────────────────────────────────────┘
```

Tooltip ℹ️ au clic sur "Passkey" :

```
"Un Passkey utilise votre biométrie (Face ID, empreinte)
 à la place d'un mot de passe. Votre clé reste sur votre
 appareil — ni Keeplas ni personne d'autre ne peut y accéder.
 Si vous changez d'appareil, votre Passkey se synchronise
 automatiquement via iCloud ou Google."
```

**Ordre de priorité recommandé :**

```
1. 🥇 Passkey          ← Recommandé — le plus sécurisé, zéro friction
2. 🥈 Google / Apple   ← Simple, familier
3. 🥉 Email + mdp      ← Toujours disponible, moins sécurisé
```

Ce qu'on ne demande PAS à cette étape : nom complet, téléphone, date de naissance, plan tarifaire. Tout ça vient naturellement plus tard quand le contexte l'exige.

---

### Étape 1 — Recovery Phrase (BLOQUANTE — 90 secondes)

Seul moment où on force le user à s'arrêter. Présentée comme une protection, jamais comme une contrainte.

```
┌─────────────────────────────────────────────┐
│                                             │
│  🔑 Votre clé secrète personnelle           │
│                                             │
│  Avant d'accéder à votre vault, nous        │
│  générons une clé unique qui ne quitte      │
│  jamais cet appareil.                       │
│                                             │
│  Si vous perdez accès à votre compte,       │
│  ces 24 mots sont votre seul recours.       │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 1. harbor   2. crystal  3. motion   │    │
│  │ 4. legacy   5. breach   6. silent   │    │
│  │ ...         ...         ...         │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ⚠️  Écrivez ces mots sur papier.           │
│      Ne les photographiez jamais.           │
│                                             │
│  [📋 Copier]   [🖨️ Imprimer]               │
│                                             │
│  [J'ai noté mes 24 mots →]                 │
└─────────────────────────────────────────────┘
```

Vérification rapide immédiate :

```
Confirmez 3 mots pour continuer :

Le mot n°7 est :  [          ]
Le mot n°14 est : [          ]
Le mot n°21 est : [          ]

[Confirmer et accéder à mon vault →]
```

Le mot "shard", "ZK" ou "Shamir" n'apparaît jamais dans cet écran.

---

### Étape 2 — Arrivée dans le Dashboard (premier accès)

Le user arrive directement dans l'app. Pas de slides, pas de tutorial pop-up, pas d'overlay.

```
┌──────────────────────────────────────────────────────────────┐
│ Keeplas          Vault   Life Check   Emergency   Contacts   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Bienvenue. Votre vault est prêt.                            │
│  Commencez à sécuriser votre legacy à votre rythme.          │
│                                [🔒 VAULT CHIFFRÉ & SÉCURISÉ] │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │                  │  │  📁 Documents personnels          │  │
│  │      0%          │  │  Aucun document ajouté            │  │
│  │   VAULT          │  ├──────────────────────────────────┤  │
│  │   INTEGRITY      │  │  💰 Assets financiers             │  │
│  │                  │  │  Aucun asset ajouté               │  │
│  │  Ajoutez votre   │  ├──────────────────────────────────┤  │
│  │  premier document│  │  🏢 Business Continuity           │  │
│  │  pour démarrer   │  │  Non configuré                    │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
│                                                              │
│  ACTIONS PRIORITAIRES                                        │
│  ┌──────────────────────────────────┐                        │
│  │ ➕ Ajouter un premier document   │ ›                      │
│  ├──────────────────────────────────┤                        │
│  │ 👤 Inviter un contact            │ ›                      │
│  ├──────────────────────────────────┤                        │
│  │ 🪪 Créer ma carte d'urgence      │ ›                      │
│  └──────────────────────────────────┘                        │
│                                                              │
│  ⚠️  Votre vault n'est pas encore partageable en urgence.   │
│     [Inviter un contact →]   [Me rappeler dans 48h]         │
└──────────────────────────────────────────────────────────────┘
```

Ce qui est intentionnel : le 0% n'est pas alarmant — il y a un message positif. Le banner ⚠️ est la seule vraie urgence signalée. Les Priority Actions changent dynamiquement selon ce qui a été fait.

---

### Nudges dynamiques — Le cœur de l'onboarding

Le Vault Integrity Score pilote tous les nudges. Chaque palier débloque un message différent et des Priority Actions adaptées.

**0% — Vault vide**

```
Message sidebar   : "Votre vault est vide. Commencez par un document."
Priority Action   : [➕ Ajouter mon premier document]
Banner ⚠️         : "Aucun contact de confiance — vault inaccessible en urgence"
```

**25% — Premiers documents ajoutés**

```
Message sidebar   : "Bon début. Ajoutez vos directives médicales."
Priority Action   : [🏥 Configurer mes Health Directives]
Banner ⚠️         : "Aucun contact de confiance — vault inaccessible en urgence"
AI Suggestion     : "Voulez-vous que je vous aide à rédiger
                     vos directives médicales ? (5 min)"
```

**55% — Contenus bien remplis, pas encore de contacts**

```
Message sidebar   : "Invitez vos contacts de confiance pour
                     sécuriser l'accès à votre vault."
Priority Action   : [👥 Inviter mes contacts de confiance]
Banner ⚠️         : disparaît dès que le 1er contact confirme
Banner Life Check : "Configurez votre Life Check pour activer
                     la protection complète"
```

**70% — Contacts invités, Life Check non configuré**

```
Message sidebar   : "Configurez votre Life Check pour activer
                     la surveillance automatique."
Priority Action   : [⏱️ Configurer le Life Check]
AI Suggestion     : "Votre vault est bien rempli mais votre protection
                     n'est pas encore active. 3 minutes suffisent."
```

**88% — Presque complet**

```
Message sidebar   : "Ajoutez vos assets digitaux pour débloquer
                     la recovery premium."
Priority Action   : [💎 Ajouter mes assets digitaux]
```

**97% — Vault complet**

```
Message sidebar   : "Protection quasi-complète.
                     Testez votre workflow d'urgence."
Priority Action   : [🧪 Simuler une urgence]
```

---

### Le Banner Persistant — Seule vraie friction

Visible sur toutes les pages tant qu'aucun Trusted Contact n'a confirmé.

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Vault non protégé en cas d'urgence                      │
│     Sans contact de confiance, personne ne peut accéder     │
│     à votre vault si quelque chose vous arrive.             │
│     [Inviter maintenant]   [Me rappeler dans 48h]           │
└─────────────────────────────────────────────────────────────┘
```

Après 48h sans action, le rappel devient plus urgent :

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 Vault toujours non protégé — 48h sans action             │
│    [Inviter un contact maintenant →]                        │
└─────────────────────────────────────────────────────────────┘
```

---

### L'AI Assistant — Guide Contextuel

Accessible depuis le sidebar à tout moment. Jamais intrusif — se manifeste dans deux cas uniquement.

**Cas 1 — Suggestion proactive (après 3 min d'inactivité sur une page complexe)**

```
┌────────────────────────────────────────────┐
│ 🤖 Assistant                               │
│                                            │
│ "Je vois que vous êtes sur les Health      │
│  Directives. Voulez-vous que je vous pose  │
│  quelques questions pour les compléter ?"  │
│                                            │
│  [Oui, allons-y]   [Non merci]             │
└────────────────────────────────────────────┘
```

**Cas 2 — Réponse à une question du user**

```
User      : "C'est quoi un contact de confiance ?"

Assistant : "Un contact de confiance est une personne
             que vous désignez pour accéder à votre
             vault si quelque chose vous arrive.
             Vous choisissez ce qu'ils peuvent voir
             et dans quelles conditions.
             Voulez-vous en inviter un maintenant ?"

             [Inviter un contact →]   [En savoir plus]
```

L'assistant connaît l'état du vault du user et adapte ses réponses en conséquence.

---

### Documentation In-App — Principe "Explain on Demand"

Pas de page de doc externe. Chaque concept a une explication intégrée, accessible au clic via une icône ℹ️.

| Terme affiché              | Tooltip au clic                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Vault Integrity ℹ️         | "Score basé sur la complétude de votre vault et le nombre de contacts actifs."                                   |
| Zero-Knowledge ℹ️          | "Vos données sont chiffrées localement. Ni Keeplas ni personne ne peut les lire sans votre autorisation."        |
| Dead Man Switch ℹ️         | "Si vous ne répondez pas à vos checks pendant X jours, vos contacts désignés reçoivent accès selon vos règles."  |
| 3 contacts sur 5 requis ℹ️ | "Pour ouvrir votre vault en urgence, 3 de vos 5 contacts doivent agir ensemble. Aucun ne peut le faire seul."    |
| Heartbeat ℹ️               | "Signal silencieux détecté automatiquement. Tant que vous utilisez votre appareil, aucune action n'est requise." |

---

### Rappels Contextuels dans les Settings

Les paramètres importants non configurés apparaissent directement dans les sections concernées.

**Page Life Check — si non configuré**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Life Check non activé                                     │
│    Votre protection n'est pas encore opérationnelle.        │
│    [Configurer en 3 minutes →]                              │
└─────────────────────────────────────────────────────────────┘
```

**Page Trusted Contacts — si moins de 3 contacts**

```
┌─────────────────────────────────────────────────────────────┐
│ ℹ️  Vous avez 1 contact sur 3 minimum recommandés           │
│    Avec 3 contacts, votre vault peut être récupéré          │
│    même si l'un d'eux est injoignable.                      │
│    [Inviter un deuxième contact →]                          │
└─────────────────────────────────────────────────────────────┘
```

**Page Vault — si Recovery Phrase non vérifiée**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔑 Recovery Phrase non confirmée                            │
│    Si vous perdez accès à cet appareil, vous ne pourrez     │
│    pas récupérer votre vault.                               │
│    [Vérifier ma Recovery Phrase →]                          │
└─────────────────────────────────────────────────────────────┘
```

---

### Parcours complet type — Premier utilisateur

```
J0 — Inscription
  → Recovery Phrase notée et vérifiée (90 secondes)
  → Arrivée dashboard — vault à 0%
  → Voit les Priority Actions
  → Ajoute un premier document → vault à 15%
  → Ferme l'app

J1 — Retour naturel
  → Voit le banner ⚠️ contact manquant
  → Invite son conjoint comme premier contact
  → Vault à 30%
  → L'assistant suggère les Health Directives

J3 — Revient pour compléter
  → Complète les Health Directives avec l'assistant
  → Vault à 55%
  → Configure le Life Check (3 minutes)
  → Vault à 70%

J7 — Notification Life Check
  → Validé automatiquement via signal passif (app ouverte)
  → Aucune action requise
  → Vault reste à 70%

J14 — Revient spontanément
  → Voit le nudge "Ajoutez vos assets digitaux"
  → Ajoute crypto wallet recovery seed
  → Vault à 85%

J30 — Vault bien établi
  → Life Check validé silencieusement
  → Vault à 85-95%
  → Reçoit suggestion de simuler une urgence
```

---

### Ce qu'on n'a PAS dans l'onboarding

```
❌ Slides de présentation (skip possible ou non)
❌ Tutorial obligatoire avec overlay
❌ Checklist d'onboarding visible en permanence
❌ Emails d'onboarding agressifs
❌ Popup "Avez-vous besoin d'aide ?" au chargement
❌ Jargon technique visible dans l'UI
❌ Demande d'informations prématurées (téléphone, nom)
❌ Tunnel de 4 sessions obligatoires
```

---

### Règles UX globales

```
✓ L'app explique le POURQUOI avant le QUOI à chaque étape
✓ Vocabulaire simple — "shard", "ZK", "Shamir" bannis de l'UI
✓ Score visible en permanence comme motivateur naturel
✓ Sauvegarde automatique à chaque action
✓ Tout est repris où on s'est arrêté
✓ Mode "simuler une urgence" pour tester sans conséquences
✓ Explain on Demand via tooltips ℹ️ — jamais imposé
✓ L'assistant répond, il ne pousse pas
```

---

## 13. Scripts d'Installation

### Philosophie

> Un seul fichier pour avoir Keeplas qui tourne. L'user n'a jamais besoin de comprendre la stack technique.

### Deux niveaux d'utilisateurs

**Développeurs / Contributeurs**

```bash
git clone https://github.com/keeplas/keeplas.git
cd keeplas
cp .env.example .env
pnpm install
pnpm dev
```

**Users self-hosting**

```bash
curl -fsSL https://install.keeplas.com | bash
# ou
docker compose up -d
```

### Ordre d'exécution de `install.sh`

```
1. check_requirements     ← Docker, pnpm, Node.js
2. setup_env              ← Domaine, email admin, génération secrets locaux
3. setup-convex.sh        ← Convex Cloud ou Self-hosted (choix interactif)
4. setup-crypto.sh        ← Noir/Barretenberg
5. start_services         ← Docker Compose
6. health-check.sh        ← Vérification finale de tous les services
```

### Setup Convex — deux modes interactifs

**Mode Cloud**

```
→ L'user va sur dashboard.convex.dev
→ Crée un projet "keeplas"
→ Copie l'URL et la deploy key
→ Le script injecte dans .env et déploie les fonctions automatiquement
```

**Mode Self-hosted**

```
→ Lance le container convex-local-backend via Docker
→ Configure le port (défaut : 3210)
→ Déploie les fonctions Convex sur l'instance locale
→ Vérifie que le service répond (health check avec retry)
```

### Variables d'environnement (`.env.example`)

```bash
# ================================
# KEEPLAS CONFIGURATION
# ================================

# App
DOMAIN=keeplas.yourdomain.com
NODE_ENV=production
ADMIN_EMAIL=admin@yourdomain.com

# Convex — rempli automatiquement par setup-convex.sh
CONVEX_MODE=cloud             # "cloud" ou "selfhosted"
CONVEX_URL=
CONVEX_DEPLOY_KEY=
CONVEX_PORT=3210              # Utilisé uniquement en selfhosted

# Encryption — généré automatiquement, NE PAS PARTAGER
ENCRYPTION_KEY=
ZK_CIRCUIT_PATH=./packages/crypto/zk/circuits

# Notifications — Life Check
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
WHATSAPP_API_KEY=             # Twilio ou Meta API
TWILIO_SID=                   # Appels IVR
TWILIO_TOKEN=

# Optional — Backup
BACKUP_ENABLED=false
BACKUP_S3_BUCKET=
BACKUP_S3_KEY=
BACKUP_S3_SECRET=
```

---

## 14. Licence & Gouvernance

### Licence : AGPL v3 + CLA

**Pourquoi AGPL v3**

AGPL v3 est la licence la plus protectrice pour un SaaS open source :

- Si quelqu'un modifie le code et le déploie comme service, il doit publier ses modifications
- Protection maximale contre les forks commerciaux concurrents
- Bien établie juridiquement — utilisée par MongoDB, GitLab, Grafana
- Respectée et comprise par la communauté open source

**Pourquoi le CLA en plus**

Le CLA (Contributor License Agreement) donne à Keeplas Ltd la propriété intellectuelle de toutes les contributions externes. Clauses obligatoires :

```
1. Le contributeur cède tous les droits patrimoniaux à Keeplas Ltd
2. Keeplas Ltd peut relicencier le code sous toute autre licence
3. Keeplas Ltd peut vendre ou transférer ces droits à un tiers
```

**Modèle Open Core**

```
AGPL v3          ← Licence du repo public
CLA              ← Keeplas Ltd garde la propriété IP complète
Keeplas Pro      ← Licence commerciale (SSO, audit logs, support entreprise)
```

### Impact sur un rachat éventuel

Grâce au CLA, les fondateurs détiennent 100% de l'IP, y compris les contributions externes. En cas de rachat :

- L'acquéreur hérite de tous les droits IP via le CLA
- Il peut changer la licence du code futur
- Il peut commercialiser sans contrainte AGPL
- La communauté open source est un asset valorisant, pas un risque

**Précaution importante** : le CLA doit être rédigé par un avocat spécialisé IP avant le premier contributeur externe.

---

## 15. Standards de Contribution

### Niveaux de contributeurs

| Niveau                | Périmètre            | Prérequis                         |
| --------------------- | -------------------- | --------------------------------- |
| **Contributor**       | UI, docs, tests      | PR + review standard + CLA signé  |
| **Core Contributor**  | Convex, API          | Track record de PRs mergées       |
| **Security Reviewer** | `/crypto` uniquement | Fondateurs + audit externe requis |

### Standards techniques non-négociables

- **TypeScript strict mode** — pas de `any`, jamais
- **ESLint + Prettier** — CI bloque si violation
- **Conventional Commits** — `feat:`, `fix:`, `security:`, `docs:`, `chore:`
- **Husky + lint-staged** — vérification avant chaque commit local
- **Tests crypto obligatoires** — avant tout merge touchant `/crypto`
- **Pas de secrets dans le code** — détection automatique via truffleHog

### Templates GitHub

```
PULL_REQUEST_TEMPLATE.md :
  [ ] Tests ajoutés ou mis à jour
  [ ] Pas de modification /crypto sans discussion préalable en issue
  [ ] CLA signé (premier PR uniquement)
  [ ] Documentation mise à jour si nécessaire
  [ ] Conventional commit respecté
```

### Reporting de vulnérabilités

```
⚠️ NE PAS ouvrir une GitHub Issue pour une vulnérabilité de sécurité.

Email : security@keeplas.com
Délai de réponse : 48h maximum
Canal chiffré : clé PGP disponible sur le site
```

---

## 16. Récapitulatif des Décisions Clés

### Stack & Architecture

| Sujet           | Décision                         | Raison                                     |
| --------------- | -------------------------------- | ------------------------------------------ |
| Approche        | Web-first + PWA                  | Éviter complexité React Native au départ   |
| UI Framework    | ShadCN + Tailwind                | Composants dans le repo, standard Next.js  |
| Backend         | Convex                           | Realtime, TypeScript natif, self-hostable  |
| Auth            | Passkey (WebAuthn) + Convex Auth | Biométrie locale, aligné ZK, zéro friction |
| Auth fallback   | Google / Apple / Email+mdp       | Couverture maximale des cas                |
| Graph UI        | React Flow                       | Life Map central node                      |
| Package manager | pnpm                             | Performance, sécurité, monorepo natif      |
| Monorepo        | Turborepo                        | Séparation claire app/crypto/ui            |
| Installation    | Script bash + Docker Compose     | One-command pour les users                 |
| Convex mode     | Cloud ou Self-hosted             | Choix interactif à l'installation          |

### Sécurité & Licence

| Sujet            | Décision                  | Raison                                        |
| ---------------- | ------------------------- | --------------------------------------------- |
| Licence          | AGPL v3 + CLA             | Max protection + rachat possible + communauté |
| Crypto isolation | `packages/crypto/` séparé | Auditabilité indépendante                     |
| Accès crypto     | CODEOWNERS strict         | Fondateurs uniquement                         |
| Secrets          | Générés localement        | Ne transitent jamais par les serveurs Keeplas |
| Vulnérabilités   | Email privé               | Pas de GitHub Issues publics                  |

### Produit & UX

| Sujet               | Décision                                             | Raison                                                           |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Recovery            | Social (≥threshold contacts) + Recovery Phrase       | Double sécurité sans dépendance serveur                          |
| Shards              | Shamir threshold-of-5 (configurable, 2 par défaut)   | User choisit son curseur sécurité ↔ accessibilité à l'onboarding |
| Distribution shards | ML-KEM-768 wrap par contact, fan-out à la soumission | Zero-knowledge strict — serveur ne voit jamais un shard en clair |
| Life Check          | Passive First, Active Only If Needed                 | Zéro friction pour le user vivant                                |
| Signaux passifs     | Score ≥ 50 pts = validation silencieuse              | Multi-sources pour éviter faux positifs                          |
| Signaux passifs     | Opt-in uniquement, traitement local                  | Vie privée et transparence                                       |
| Fréquence           | Configurable (hebdo / mensuel / trimestriel)         | Adapté à chaque profil                                           |
| Trimestriel         | Tous les canaux actifs obligatoires                  | Anti-faux-positifs maximal                                       |
| Dernier check       | Affiché avec type de signal                          | Transparence totale pour le user                                 |
| Vue contacts        | Statut sans détail du signal                         | Vie privée du user préservée                                     |
| Rôles contacts      | Trust (actif, holds shard) + Recipient (passif)      | Modèle simplifié — supprimé B1/B2/B3/B4 et First Responder       |
| Validation          | ≥threshold trust contacts confirment "unreachable"   | Fail-closed — sans confirmation humaine, vault reste fermé       |
| Grace period        | 72h après quorum atteint                             | User peut encore annuler s'il réapparaît                         |
| Onboarding          | Discover as You Go                                   | Pas de tunnel — score + nudges + assistant                       |
| Banner ⚠️           | Persistant jusqu'au 1er contact                      | Seule vraie friction acceptée                                    |
| Explain on Demand   | Tooltips ℹ️ partout                                  | Doc intégrée, jamais imposée                                     |
| Jargon technique    | Banni de l'UI                                        | Accessibilité à tous les profils                                 |

---

_Document généré lors des sessions de conception — Keeplas v1 — Avril 2026 — v5_
_Prochaine étape : Implémentation packages/crypto/ (ZK circuits Noir)_
