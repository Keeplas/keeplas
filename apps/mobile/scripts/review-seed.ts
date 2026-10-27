// Seeds the App Store / Google Play review demo accounts on PROD
// (runbook: apps/mobile/APP_REVIEW.md → Demo accounts):
//
//   pnpm review:seed
//
// It runs the app's own code, so a reviewer's phone opens everything:
// vault keys (crypto/vault-keys.ts), items (features/capture/seal.ts and the
// outbox), contact key checks (crypto/contact-keys.ts). The sign-up
// attestation comes from the internal `attestation:grantSignup`, run with
// the operator's Convex login, so no phone is needed. The three accounts
// share one set of 24 words, REVIEW_KIT in Infisical prod /keeplas_mobile:
// kept from the last run (so the review notes stay valid), or created and
// stored before any vault exists. They are never printed. Each vault still
// gets its own salt and MasterKey. The three numbers must be free:
// `pnpm review:reset <number>`. It ends by opening every account again like
// a new phone.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import {
  decryptFile,
  decryptText,
  encryptText,
  importAesKey,
  memorySink,
  memorySource,
} from "@/crypto/envelope";
import { CUSTOM_FALLBACK } from "@/crypto/item-meta";
import { loadOwnerKeys, unwrapOwnerDek } from "@/crypto/owner-keys";
import {
  createVaultMaterial,
  importMasterKey,
  openKeyBundle,
  type VaultMaterial,
} from "@/crypto/vault-keys";
import {
  sealCapture,
  type CaptureDraft,
  type SealIO,
} from "@/features/capture/seal";
import {
  memoryStore,
  uploadEntry,
  type OutboxDeps,
} from "@/features/outbox/outbox";
import { openSealedItem } from "@/features/vault/open-sealed-item";
import { generatePhrase } from "@keeplas/crypto/recovery";

const OWNER = { phone: "+447700900101", name: "Demo Owner" };
const ALEX = { phone: "+447700900102", name: "Alex Demo" };
const SAM = { phone: "+447700900103", name: "Sam Demo" };
const KIT = "REVIEW_KIT";
const ASSETS = resolve("apps/mobile/scripts/review-seed");
const DAY_MS = 86_400_000;

type Person = typeof OWNER;

interface Account {
  person: Person;
  client: ConvexHttpClient;
  material: VaultMaterial;
}

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run pnpm review:seed`);
  return value;
}

/** A CLI on the operator's machine; throws with its stderr on failure. */
function run(command: string, args: string[]): string {
  const res = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.status !== 0) {
    throw new Error(`${command} ${args[0]} failed: ${res.stderr.trim()}`);
  }
  return res.stdout;
}

/** Internal function on prod, with the operator's Convex CLI login. */
function admin(fn: string, args: Record<string, unknown>): unknown {
  const out = run("npx", [
    "--no-install",
    "convex",
    "run",
    "--prod",
    fn,
    JSON.stringify(args),
  ]).trim();
  return out ? JSON.parse(out) : null;
}

const KIT_PATH = ["--env=prod", "--path=/keeplas_mobile", "--silent"];
const readKit = () =>
  run("infisical", ["secrets", "get", KIT, ...KIT_PATH, "--plain"])
    .trim()
    .split(/\s+/);

/** REVIEW_KIT from the last run, or new words stored before any vault. */
async function sharedKit(): Promise<string[]> {
  try {
    const words = readKit();
    if (words.length === 24) return words;
  } catch {
    // Not stored yet.
  }
  const words = await generatePhrase();
  run("infisical", [
    "secrets",
    "set",
    ...KIT_PATH,
    `${KIT}=${words.join(" ")}`,
  ]);
  return words;
}

if (!(process.env.CONVEX_DEPLOYMENT ?? "").startsWith("prod:")) {
  throw new Error("Not pointed at prod: run pnpm review:seed");
}
const CONVEX_URL = need("NEXT_PUBLIC_CONVEX_URL");
const APP_URL = need("NEXT_PUBLIC_APP_URL");
const REVIEW_CODE = need("REVIEW_CODE");

interface AuditContext {
  ip: string;
  country: string;
  ts: number;
  sig: string;
  city?: string;
}

let auditCache: AuditContext | undefined;

/** The sealed `_audit` context, fetched like the app (valid 24 h). */
async function auditContext(): Promise<AuditContext> {
  if (auditCache) return auditCache;
  const res = await fetch(new URL("/api/context", APP_URL), {
    headers: { Accept: "application/json" },
  });
  if (res.status !== 200) throw new Error(`/api/context: HTTP ${res.status}`);
  auditCache = (await res.json()) as AuditContext;
  return auditCache;
}

/** Review-code session, as the app's phone screen + verify screen do. */
async function session(
  phoneNumber: string,
  flow: "signUp" | "signIn",
  name?: string,
): Promise<ConvexHttpClient> {
  const anonymous = new ConvexHttpClient(CONVEX_URL);
  await anonymous.mutation(api.phone_auth.requestPhoneAuthOtp, {
    phoneNumber,
    intent: flow === "signUp" ? "signup" : "signin",
    language: "en-US",
  });
  const { tokens } = await anonymous.action(api.auth.signIn, {
    provider: "phone-otp",
    params: {
      phoneNumber,
      code: REVIEW_CODE,
      flow,
      language: "en-US",
      ...(name ? { name } : {}),
    },
  });
  if (!tokens) throw new Error(`${phoneNumber}: sign-in returned no session`);
  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(tokens.token);
  return client;
}

/** Sign-up + "Create my vault" (lib/use-create-vault.ts), no device. */
async function createAccount(person: Person, kit: string[]): Promise<Account> {
  admin("attestation:grantSignup", {
    phoneNumber: person.phone,
    platform: "ios",
  });
  const client = await session(person.phone, "signUp", person.name);
  const material = await createVaultMaterial(kit);
  await client.mutation(api.onboarding.storeRecoveryPhraseHash, {
    recoveryPhraseHash: material.recoveryPhraseHash,
    phraseSalt: material.phraseSalt,
  });
  await client.mutation(api.onboarding.storeKeyBundle, {
    encryptedKeyBundle: material.encryptedKeyBundle,
    phraseSalt: material.phraseSalt,
  });
  await client.mutation(api.users.setPublicKey, {
    ...material.publicKeys,
    _audit: await auditContext(),
  });
  return { person, client, material };
}

/** Invite by phone only (no message reaches anyone), then accept. */
async function addContact(owner: Account, contact: Account): Promise<string> {
  const _audit = await auditContext();
  // Audited mutations come back untyped on the client.
  const { contactId, invitationToken } = (await owner.client.mutation(
    api.trusted_contacts.inviteContact,
    {
      name: contact.person.name,
      phoneNumber: contact.person.phone,
      role: "friend",
      _audit,
    },
  )) as { contactId: Id<"trusted_contacts">; invitationToken: string };
  const { contactRecordId } = (await contact.client.mutation(
    api.trusted_contacts.acceptInvitation,
    {
      token: invitationToken,
      contactPublicKey: contact.material.publicKeys.publicKey,
      _audit,
    },
  )) as { contactRecordId: Id<"trusted_contacts"> };
  // What the contact's phone does on unlock: no weekly "still there?" message.
  await contact.client.mutation(api.trusted_contacts.confirmAvailability, {
    contactId: contactRecordId,
    _audit,
  });
  return contactId;
}

/** Verify-before-wrap and the TOFU pin, as the phone does. */
async function verifiedKeys(owner: Account): Promise<Map<string, string>> {
  const _audit = await auditContext();
  const keys = new Map<string, string>();
  for (const row of await owner.client.query(
    api.trusted_contacts.getContacts,
    {},
  )) {
    keys.set(
      row._id,
      await requireVerifiedKey(
        contactKeyMaterial(row),
        (contactId, fingerprint) =>
          owner.client.mutation(api.trusted_contacts.pinContactIdentity, {
            contactId: contactId as Id<"trusted_contacts">,
            fingerprint,
            _audit,
          }),
      ),
    );
  }
  return keys;
}

/** Seal + upload one capture through the phone's outbox code. */
async function addItem(
  account: Account,
  userId: string,
  vaultId: string,
  draft: CaptureDraft,
) {
  const { client } = account;
  const _audit = await auditContext();
  const written = new Map<string, Uint8Array>();
  const io: SealIO = {
    open: (uri) => ({
      ...memorySource(new Uint8Array(readFileSync(uri))),
      close: () => undefined,
    }),
    create: (entryId, index) => {
      const sink = memorySink();
      const path = `mem://${entryId}-${index}`;
      return {
        path,
        write: sink.write,
        close: () => {
          written.set(path, sink.bytes());
          return written.get(path)!.byteLength;
        },
      };
    },
  };
  const entryId = crypto.randomUUID();
  const { item, files } = await sealCapture(
    entryId,
    draft,
    account.material.publicKeys.publicKey,
    io,
  );
  const deps: OutboxDeps = {
    vaultId: async () => vaultId,
    generateUploadUrl: () =>
      client.mutation(api.vault_items.generateUploadUrl, {
        _audit,
      }) as Promise<string>,
    upload: async (url, path, onProgress) => {
      const body = new Uint8Array(written.get(path)!);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body,
      });
      if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
      onProgress(body.byteLength);
      return ((await res.json()) as { storageId: string }).storageId;
    },
    createItem: (args) =>
      client.mutation(api.vault_items.createItem, {
        ...(args as unknown as FunctionArgs<typeof api.vault_items.createItem>),
        _audit,
      }) as Promise<string>,
    addItemFiles: () => Promise.reject(new Error("Not used")),
    deleteLocalFile: (path) => written.delete(path),
    canStore: async (bytes) =>
      (await client.query(api.vaults.canStore, { bytes })).fits,
    discardUploads: async (storageIds) => {
      await client.mutation(api.vault_items.discardUploads, {
        storageIds: storageIds as Id<"_storage">[],
        _audit,
      });
    },
  };
  await uploadEntry(
    {
      id: entryId,
      userId,
      createdAt: Date.now(),
      item,
      files,
      status: "waiting",
      attempts: 0,
    },
    memoryStore(),
    deps,
  );
}

async function fillVault(account: Account, drafts: CaptureDraft[]) {
  const viewer = await account.client.query(api.users.viewer, {});
  const vaultId = await account.client.mutation(
    api.vaults.getOrCreateVault,
    {},
  );
  for (const draft of drafts)
    await addItem(account, viewer!._id, vaultId, draft);
}

/** A file from scripts/review-seed/, named as the reviewer will see it. */
const file = (
  name: string,
  asset: string,
  mimeType: string,
  kind: "image" | "audio" | "document",
  durationSec?: number,
) => ({
  uri: resolve(ASSETS, asset),
  name,
  mimeType,
  kind,
  durationSec,
});

async function seed() {
  const status = admin("store_review:status", {}) as {
    accounts: { phoneNumber: string; account: unknown }[];
  };
  for (const person of [OWNER, ALEX, SAM]) {
    const row = status.accounts.find((a) => a.phoneNumber === person.phone);
    if (!row) throw new Error(`${person.phone} is not in REVIEW_PHONES`);
    if (row.account) {
      throw new Error(
        `${person.phone} already has an account: pnpm review:reset ${person.phone}`,
      );
    }
  }
  for (const file of ["photo.jpg", "tune.m4a", "insurance-policy.pdf"]) {
    if (!existsSync(resolve(ASSETS, file)))
      throw new Error(`Missing ${ASSETS}/${file}: run from the repo root`);
  }

  console.log("Creating the accounts…");
  const kit = await sharedKit();
  const alex = await createAccount(ALEX, kit);
  const sam = await createAccount(SAM, kit);
  const owner = await createAccount(OWNER, kit);

  console.log("Adding and accepting the two contacts…");
  const alexId = await addContact(owner, alex);
  const samId = await addContact(owner, sam);
  const keys = await verifiedKeys(owner);
  const recipient = (contactId: string) => ({
    contactId,
    publicKey: keys.get(contactId)!,
  });
  // After a confirmed death: Family goes to Alex only, the rest to both.
  const alexOnly = {
    recipients: [recipient(alexId)],
    pending: [],
    contactIds: [alexId],
  };
  const both = {
    recipients: [recipient(alexId), recipient(samId)],
    pending: [],
  };

  console.log("Adding categories and items…");
  const masterKey = await importAesKey(owner.material.rawMasterKey);
  const category = async (name: string) => ({
    category: CUSTOM_FALLBACK,
    categoryId: await owner.client.mutation(api.vault_categories.create, {
      encryptedName: await encryptText(name, masterKey),
      _audit: await auditContext(),
    }),
  });
  const family = await category("Family");
  const paperwork = await category("Paperwork");
  await fillVault(owner, [
    {
      title: "Summer at the lake",
      note: "",
      files: [
        file("Summer at the lake.jpg", "photo.jpg", "image/jpeg", "image"),
      ],
      ...family,
      share: alexOnly,
    },
    {
      title: "A tune for the kids",
      note: "",
      files: [file("Voice note.m4a", "tune.m4a", "audio/mp4", "audio", 7)],
      ...family,
      share: alexOnly,
    },
    {
      title: "Where the house keys are",
      note: "Spare house keys: the blue box on the top shelf of the hall cupboard.\nGarage remote: kitchen drawer, on the left.\nThis is demo content: no real address or key.",
      files: [],
      ...family,
      share: alexOnly,
    },
    {
      title: "Home insurance policy",
      note: "",
      files: [
        file(
          "Home insurance policy.pdf",
          "insurance-policy.pdf",
          "application/pdf",
          "document",
        ),
      ],
      ...paperwork,
      share: both,
    },
    {
      title: "Insurance contacts",
      note: "Home insurance: Example Mutual, policy DEMO-2026-0001, claims line +44 7700 900199.\nCar insurance: Sample Auto Cover, policy DEMO-CAR-0002.\nAll names and numbers here are made up.",
      files: [],
      ...paperwork,
      share: both,
    },
    {
      title: "Email account",
      note: "Login: demo.owner@example.com\nPassword: kept in my password manager (demo entry, not a real account).",
      files: [],
      category: "credential",
      share: both,
    },
  ]);
  // The contacts' own vaults: a reviewer signed in as one sees a few items
  // too. They have no trusted contacts, so nothing is shared.
  await fillVault(alex, [
    {
      title: "Holiday photo",
      note: "",
      files: [file("Holiday photo.jpg", "photo.jpg", "image/jpeg", "image")],
      category: "other",
    },
    {
      title: "Bank account",
      note: "Bank: Example Bank, current account ending 0000.\nThis is demo content: no real account.",
      files: [],
      category: "credential",
    },
  ]);
  await fillVault(sam, [
    {
      title: "Birthday message",
      note: "",
      files: [
        file("Birthday message.m4a", "tune.m4a", "audio/mp4", "audio", 7),
      ],
      category: "other",
    },
    {
      title: "Streaming subscriptions",
      note: "Music: Sample Music, monthly.\nFilms: Demo Flix, yearly.\nAll names here are made up.",
      files: [],
      category: "credential",
    },
  ]);

  console.log("Life check quarterly with travel mode, cloud backup off…");
  const _audit = await auditContext();
  await owner.client.mutation(api.life_check.saveConfig, {
    frequency: "quarterly",
    activeChannels: [
      { type: "push", order: 0, isEnabled: true },
      { type: "whatsapp", order: 1, isEnabled: true },
      { type: "email", order: 2, isEnabled: true },
    ],
    _audit,
  });
  await owner.client.mutation(api.life_check.toggleTravelMode, {
    enabled: true,
    until: Date.now() + 30 * DAY_MS,
    _audit,
  });
  // Off for good, so reviewers' phones never seal a backup the next
  // reviewer can't open (lib/backup-policy.ts): each one gets the kit.
  await owner.client.mutation(api.cloud_backup.disable, { _audit });

  for (const account of [owner, alex, sam])
    await account.client.action(api.auth.signOut, {});
}

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Open an account like a new phone: review code, then REVIEW_KIT. */
async function openLikeNewPhone(person: Person, kit: string[]) {
  const client = await session(person.phone, "signIn");
  const viewer = await client.query(api.users.viewer, {});
  if (!viewer?.encryptedKeyBundle) throw new Error(`${person.name}: no vault`);
  const { masterKey } = await openKeyBundle(viewer.encryptedKeyBundle, kit);
  const mk = await importMasterKey(masterKey);
  return { client, mk, keys: await loadOwnerKeys(viewer, mk) };
}

/** Opens each account and every item in it like a reviewer's new phone. */
async function verify() {
  const originals = new Map(
    [
      ["Summer at the lake.jpg", "photo.jpg"],
      ["Voice note.m4a", "tune.m4a"],
      ["Home insurance policy.pdf", "insurance-policy.pdf"],
      ["Holiday photo.jpg", "photo.jpg"],
      ["Birthday message.m4a", "tune.m4a"],
    ].map(([name, asset]) => [
      name,
      sha256(readFileSync(resolve(ASSETS, asset))),
    ]),
  );
  const kit = readKit();
  let broken = 0;
  for (const person of [OWNER, ALEX, SAM]) {
    const account = await openLikeNewPhone(person, kit);
    const { client } = account;
    const categories = new Map<string, string>();
    for (const c of await client.query(api.vault_categories.list, {})) {
      categories.set(c._id, await decryptText(c.encryptedName, account.mk));
    }
    const contacts = await client.query(
      api.trusted_contacts.getContactSummaries,
      {},
    );
    const names = new Map(contacts.map((c) => [c._id as string, c.name]));
    const accepted = contacts.filter(
      (c) => c.invitationStatus === "accepted",
    ).length;
    console.log(
      `\n${person.name}: vault opened with ${KIT}; ${accepted} accepted contacts`,
    );

    for (const summary of await client.query(
      api.vault_items.getItemSummaries,
      {},
    )) {
      const itemId = summary._id as Id<"vault_items">;
      const dek = await unwrapOwnerDek(summary.ownerWrappedDek!, account.keys);
      const raw = await client.query(api.vault_items.getItem, { itemId });
      const files = await client.query(api.vault_items.getItemFiles, {
        itemId,
      });
      const opened = await openSealedItem(raw!, files, dek);
      const details = [
        opened.categoryId ? categories.get(opened.categoryId) : opened.category,
      ];
      for (const [i, row] of files.entries()) {
        const url = await client.query(api.vault_items.getItemFileUrl, {
          fileId: row._id,
        });
        const sink = memorySink();
        await decryptFile(
          memorySource(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
          row.iv,
          dek,
          sink,
        );
        const same =
          originals.get(opened.files[i]?.name ?? "") === sha256(sink.bytes());
        if (!same) broken++;
        details.push(same ? "file intact" : "FILE MISMATCH");
      }
      const recipients = (await client.query(api.rotation.getItemRecipients, {
        itemId,
      })) as { contactId: string }[];
      if (recipients.length) {
        details.push(
          `after a death: ${recipients.map((r) => names.get(r.contactId)).join(" and ")}`,
        );
      }
      console.log(`  ${opened.title} · ${details.join(" · ")}`);
    }
    await client.action(api.auth.signOut, {});
  }
  if (broken)
    throw new Error(`${broken} file(s) did not decrypt to the original`);
}

seed()
  .then(verify)
  .then(() =>
    console.log(
      `\nDone. The 24 words of all three accounts are ${KIT} in Infisical prod /keeplas_mobile. Check with pnpm review:status.`,
    ),
  )
  .catch((error: unknown) => {
    console.error(
      `\n✗ ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
