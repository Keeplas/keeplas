import {
  draftStore,
  isEmptyDraft,
  SAVE_DELAY_MS,
  type Draft,
  type DraftDb,
  type DraftFiles,
} from "../draft-store";

function memoryDb() {
  const rows = new Map<string, { userId: string; draft: Draft }>();
  const db: DraftDb = {
    list: async (userId) =>
      [...rows.values()]
        .filter((row) => row.userId === userId)
        .map((row) => row.draft),
    put: async (userId, draft) => void rows.set(draft.id, { userId, draft }),
    remove: async (id) => void rows.delete(id),
    removeAll: async (userId) => {
      for (const [id, row] of rows) if (row.userId === userId) rows.delete(id);
    },
  };
  return { db, rows };
}

function memoryFiles() {
  const kept = new Set<string>();
  const files: DraftFiles = {
    keep: (draftId, uri) => {
      const copy = `drafts/${draftId}/${uri.split("/").pop()}`;
      kept.add(copy);
      return copy;
    },
    drop: (uri) => void kept.delete(uri),
    dropDraft: (draftId) => {
      for (const uri of kept)
        if (uri.startsWith(`drafts/${draftId}/`)) kept.delete(uri);
    },
    dropAll: () => kept.clear(),
  };
  return { files, kept };
}

const photo = (name: string) => ({
  uri: `cache/${name}`,
  name,
  mimeType: "image/jpeg",
  kind: "image" as const,
});

async function settle() {
  jest.advanceTimersByTime(SAVE_DELAY_MS + 1);
  await draftStore.settled();
}

describe("capture drafts", () => {
  let db: ReturnType<typeof memoryDb>;
  let files: ReturnType<typeof memoryFiles>;

  beforeEach(async () => {
    jest.useFakeTimers();
    db = memoryDb();
    files = memoryFiles();
    await draftStore.attach("u1", db.db, files.files);
  });

  afterEach(async () => {
    await draftStore.detach("u1");
    jest.useRealTimers();
  });

  it("saves each capture as its own draft, files moved out of the cache", async () => {
    draftStore.start("photo", { files: [photo("a.jpg")] });
    const first = draftStore.get().id;
    draftStore.update({ title: "Contract with Paul" });
    await settle();
    draftStore.start("note");
    draftStore.update({ note: "<p>Paul owes 500</p>" });
    await settle();

    expect(draftStore.list()).toHaveLength(2);
    expect(db.rows.size).toBe(2);
    expect(db.rows.get(first)?.draft.files[0].uri).toBe(
      `drafts/${first}/a.jpg`,
    );
    expect(files.kept.has(`drafts/${first}/a.jpg`)).toBe(true);
  });

  it("reopens a draft with its text and files", async () => {
    draftStore.start("photo", { files: [photo("a.jpg")] });
    const id = draftStore.get().id;
    draftStore.update({ title: "Lease" });
    await settle();
    draftStore.start("note");

    expect(draftStore.open(id)).toBe(true);
    expect(draftStore.get().title).toBe("Lease");
    expect(draftStore.get().files).toHaveLength(1);
  });

  it("drops a draft the user empties by hand", async () => {
    draftStore.start("note");
    draftStore.update({ title: "Loan" });
    await settle();
    expect(draftStore.list()).toHaveLength(1);

    draftStore.update({ title: "  ", note: "<p></p>" });
    await settle();
    expect(draftStore.list()).toHaveLength(0);
    expect(db.rows.size).toBe(0);
  });

  it("deletes a draft and its files, from the form or the list", async () => {
    draftStore.start("photo", { files: [photo("a.jpg")] });
    const id = draftStore.get().id;
    await settle();
    draftStore.start("photo", { files: [photo("b.jpg")] });
    const other = draftStore.get().id;
    await settle();

    draftStore.remove(id);
    await draftStore.settled();
    expect(draftStore.list().map((d) => d.id)).toEqual([other]);
    expect(files.kept.has(`drafts/${id}/a.jpg`)).toBe(false);

    draftStore.discard();
    await draftStore.settled();
    expect(draftStore.list()).toEqual([]);
    expect(files.kept.size).toBe(0);
    expect(draftStore.get().files).toEqual([]);
  });

  it("forgets the draft once the item is saved", async () => {
    draftStore.start("note");
    draftStore.update({ title: "Will" });
    await settle();
    draftStore.reset();
    await draftStore.settled();
    expect(draftStore.list()).toEqual([]);
    expect(db.rows.size).toBe(0);
  });

  it("keeps a sent draft out of sight until its upload succeeds", async () => {
    draftStore.start("photo", { files: [photo("a.jpg")] });
    const id = draftStore.get().id;
    draftStore.update({ title: "Loan" });
    draftStore.markSending("entry-1");
    await draftStore.settled();

    expect(draftStore.list()).toEqual([]);
    expect(draftStore.sendingDraft("entry-1")?.id).toBe(id);
    expect(db.rows.get(id)?.draft.sendingEntryId).toBe("entry-1");
    expect(draftStore.get().id).not.toBe(id);

    draftStore.finishSending("entry-1");
    await draftStore.settled();
    expect(draftStore.sendingDraft("entry-1")).toBeUndefined();
    expect(db.rows.size).toBe(0);
    expect(files.kept.size).toBe(0);
  });

  it("reopens a failed upload's draft to edit it", async () => {
    draftStore.start("photo", { files: [photo("a.jpg")] });
    const id = draftStore.get().id;
    draftStore.update({ title: "Too big" });
    draftStore.markSending("entry-2");
    await draftStore.settled();

    expect(draftStore.reopenSending("entry-2")).toBe(true);
    await draftStore.settled();
    expect(draftStore.get().id).toBe(id);
    expect(draftStore.get().files).toHaveLength(1);
    expect(draftStore.list().map((d) => d.id)).toEqual([id]);
    expect(db.rows.get(id)?.draft.sendingEntryId).toBeUndefined();
  });

  it("clears every draft on sign-out", async () => {
    draftStore.start("photo", { files: [photo("a.jpg")] });
    await settle();
    await draftStore.detach("u1");
    expect(db.rows.size).toBe(0);
    expect(files.kept.size).toBe(0);
    expect(draftStore.list()).toEqual([]);
  });

  it("knows an empty draft", () => {
    const base = {
      id: "d",
      updatedAt: 0,
      kind: "note" as const,
      title: "",
      note: "",
      pages: [],
      files: [],
    };
    expect(isEmptyDraft(base)).toBe(true);
    expect(isEmptyDraft({ ...base, note: "<p></p>" })).toBe(true);
    expect(isEmptyDraft({ ...base, title: "x" })).toBe(false);
    expect(isEmptyDraft({ ...base, note: "<p>x</p>" })).toBe(false);
    expect(isEmptyDraft({ ...base, pages: ["p"] })).toBe(false);
    expect(isEmptyDraft({ ...base, files: [photo("a.jpg")] })).toBe(false);
  });
});
