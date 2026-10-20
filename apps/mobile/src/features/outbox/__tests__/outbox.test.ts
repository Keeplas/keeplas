/**
 * @jest-environment node
 */
import {
  generateRecipientKeyPair,
  serializePublicKey,
  unwrapDek,
} from "@keeplas/crypto/kem";

import {
  decryptFile,
  decryptText,
  memorySink,
  memorySource,
} from "@/crypto/envelope";
import { parseFileMeta, parseItemMeta } from "@/crypto/item-meta";
import { sealCapture, type SealIO } from "@/features/capture/seal";
import {
  memoryStore,
  pendingEntries,
  QUOTA_ERROR,
  requeue,
  uploadEntry,
  type CreateItemArgs,
  type OutboxDeps,
  type OutboxEntry,
} from "../outbox";

/** In-memory "disk": plaintext captures in, ciphertext files out. */
function memoryDisk(inputs: Record<string, Uint8Array>) {
  const written = new Map<string, Uint8Array>();
  const io: SealIO = {
    open: (uri) => ({ ...memorySource(inputs[uri]), close: () => undefined }),
    create: (entryId, index) => {
      const sink = memorySink();
      const path = `file:///outbox/${entryId}-${index}.bin`;
      return {
        path,
        write: sink.write,
        close: () => {
          const bytes = sink.bytes();
          written.set(path, bytes);
          return bytes.byteLength;
        },
      };
    },
  };
  return { io, written };
}

function fakeServer(failUploadAt?: number) {
  const uploads: string[] = [];
  const created: CreateItemArgs[] = [];
  const deleted: string[] = [];
  let calls = 0;
  const deps: OutboxDeps = {
    vaultId: async () => "vault1",
    generateUploadUrl: async () => "https://upload",
    upload: async (_url, path, onProgress) => {
      calls += 1;
      if (calls === failUploadAt) throw new Error("Network request failed");
      onProgress(1);
      uploads.push(path);
      return `storage-${uploads.length}`;
    },
    createItem: async (args) => {
      created.push(args);
      return "item1";
    },
    deleteLocalFile: (path) => deleted.push(path),
  };
  return { deps, uploads, created, deleted };
}

async function sealedEntry(owner: ReturnType<typeof generateRecipientKeyPair>) {
  const photo = crypto.getRandomValues(new Uint8Array(3000));
  const voice = crypto.getRandomValues(new Uint8Array(500));
  const disk = memoryDisk({
    "file:///photo.jpg": photo,
    "file:///v.m4a": voice,
  });
  const sealed = await sealCapture(
    "e1",
    {
      title: " Spare keys ",
      note: "Blue box in the garage",
      files: [
        {
          uri: "file:///photo.jpg",
          name: "keys.jpg",
          mimeType: "image/jpeg",
          kind: "image",
        },
        {
          uri: "file:///v.m4a",
          name: "Voice note.m4a",
          mimeType: "audio/mp4",
          kind: "audio",
          durationSec: 28,
        },
      ],
    },
    serializePublicKey(owner.publicKey),
    disk.io,
  );
  const entry: OutboxEntry = {
    id: "e1",
    userId: "u1",
    createdAt: 1,
    status: "waiting",
    attempts: 0,
    ...sealed,
  };
  return { entry, disk, photo, voice };
}

describe("capture sealing + outbox upload", () => {
  it("uploads ciphertext the owner (and the web) can open", async () => {
    const owner = generateRecipientKeyPair();
    const { entry, disk, photo } = await sealedEntry(owner);
    const store = memoryStore();
    await store.put(entry);
    const server = fakeServer();

    const itemId = await uploadEntry(entry, store, server.deps);
    expect(itemId).toBe("item1");
    expect(store.entries.size).toBe(0);
    expect(server.deleted).toEqual(entry.files.map((f) => f.path));

    const [args] = server.created;
    expect(args).toMatchObject({
      vaultId: "vault1",
      accessLevel: "private",
      encryptionType: "zero_knowledge",
      recipientMode: "default",
    });
    expect(args.files.map((f) => f.storageId)).toEqual([
      "storage-1",
      "storage-2",
    ]);

    const dek = await unwrapDek(args.ownerWrappedDek, owner.secretKey);
    expect(await decryptText(args.encryptedTitle, dek)).toBe("Spare keys");
    expect(await decryptText(args.encryptedContent, dek)).toBe(
      "Blue box in the garage",
    );
    expect(parseItemMeta(await decryptText(args.encryptedMeta, dek))).toEqual({
      v: 1,
      category: "inbox",
    });
    const voiceMeta = parseFileMeta(
      await decryptText(args.files[1].encryptedMeta, dek),
    );
    expect(voiceMeta).toEqual({
      v: 1,
      name: "Voice note.m4a",
      mimeType: "audio/mp4",
      size: 500,
      kind: "audio",
      durationSec: 28,
    });
    const out = memorySink();
    await decryptFile(
      memorySource(disk.written.get(entry.files[0].path)!),
      args.files[0].iv,
      dek,
      out,
    );
    expect(Buffer.from(out.bytes()).equals(Buffer.from(photo))).toBe(true);
  });

  it("files a capture in a folder with a key for each person on it", async () => {
    const owner = generateRecipientKeyPair();
    const marie = generateRecipientKeyPair();
    const paul = generateRecipientKeyPair();
    const sealed = await sealCapture(
      "e2",
      {
        title: "Family plan",
        note: "",
        files: [],
        folder: {
          id: "folder1",
          recipients: [
            {
              contactId: "marie",
              publicKey: serializePublicKey(marie.publicKey),
            },
            {
              contactId: "paul",
              publicKey: serializePublicKey(paul.publicKey),
            },
          ],
        },
      },
      serializePublicKey(owner.publicKey),
      memoryDisk({}).io,
    );
    const entry: OutboxEntry = {
      id: "e2",
      userId: "u1",
      createdAt: 1,
      status: "waiting",
      attempts: 0,
      ...sealed,
    };
    const server = fakeServer();
    await uploadEntry(entry, memoryStore(), server.deps);

    const [args] = server.created;
    expect(args.folderId).toBe("folder1");
    expect(args.recipientKeys?.map((key) => key.contactId)).toEqual([
      "marie",
      "paul",
    ]);
    for (const [index, person] of [marie, paul].entries()) {
      const dek = await unwrapDek(
        args.recipientKeys![index].wrappedDek,
        person.secretKey,
      );
      expect(await decryptText(args.encryptedTitle, dek)).toBe("Family plan");
    }
  });

  it("adds no folder or extra keys when none is chosen", async () => {
    const owner = generateRecipientKeyPair();
    const { entry } = await sealedEntry(owner);
    expect(entry.item.folderId).toBeUndefined();
    expect(entry.item.recipientKeys).toBeUndefined();
  });

  it("resumes after a failure without re-uploading finished files", async () => {
    const owner = generateRecipientKeyPair();
    const { entry } = await sealedEntry(owner);
    const store = memoryStore();
    await store.put(entry);
    const flaky = fakeServer(2);

    await expect(uploadEntry(entry, store, flaky.deps)).rejects.toThrow(
      "Network request failed",
    );
    const failed = store.entries.get("e1")!;
    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(1);
    expect(failed.files[0].storageId).toBe("storage-1");
    expect(failed.files[1].storageId).toBeUndefined();

    const [retry] = requeue([...store.entries.values()]);
    expect(retry.status).toBe("waiting");
    await uploadEntry(retry, store, flaky.deps);
    expect(flaky.uploads).toHaveLength(2);
    expect(flaky.created[0].files.map((f) => f.storageId)).toEqual([
      "storage-1",
      "storage-2",
    ]);
  });

  it("parks entries when the plan is full", async () => {
    const owner = generateRecipientKeyPair();
    const { entry } = await sealedEntry(owner);
    const store = memoryStore();
    const server = fakeServer();
    server.deps.createItem = async () => {
      throw new Error(`Uncaught Error: ${QUOTA_ERROR}`);
    };
    await expect(uploadEntry(entry, store, server.deps)).rejects.toThrow();
    const parked = store.entries.get("e1")!;
    expect(parked.status).toBe("quota");
    expect(requeue([parked])).toEqual([]);
  });

  it("sends waiting entries oldest first", () => {
    const base = { userId: "u", item: {} as never, files: [], attempts: 0 };
    const entries: OutboxEntry[] = [
      { ...base, id: "b", createdAt: 2, status: "waiting" },
      { ...base, id: "a", createdAt: 1, status: "waiting" },
      { ...base, id: "c", createdAt: 0, status: "failed" },
    ];
    expect(pendingEntries(entries).map((e) => e.id)).toEqual(["a", "b"]);
  });
});
