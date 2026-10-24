import {
  attachFormDrafts,
  clearFormDrafts,
  FORM_DRAFT_SAVE_MS,
  formDraftsSettled,
  readFormDraft,
  removeFormDraft,
  writeFormDraft,
  type FormDraftDb,
} from "../form-drafts";
import { hasEditChanges, type EditDraft } from "@/features/vault/edit-draft";

function memoryDb() {
  const rows = new Map<string, { userId: string; value: unknown }>();
  const db: FormDraftDb = {
    list: async (userId) =>
      [...rows]
        .filter(([, row]) => row.userId === userId)
        .map(([key, row]) => ({ key, value: row.value })),
    put: async (userId, key, value) => void rows.set(key, { userId, value }),
    remove: async (key) => void rows.delete(key),
    removeAll: async (userId) => {
      for (const [key, row] of rows)
        if (row.userId === userId) rows.delete(key);
    },
  };
  return { db, rows };
}

const saved = { title: "Loan to Paul", note: "<p>Paul owes 500</p>" };
const edit = (patch: Partial<EditDraft> = {}): EditDraft => ({
  ...saved,
  removed: [],
  added: [],
  ...patch,
});

describe("edit drafts", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    clearFormDrafts();
    jest.useRealTimers();
  });

  it("keeps unsaved item changes across an app restart", async () => {
    const { db, rows } = memoryDb();
    await attachFormDrafts("u1", db);
    writeFormDraft("edit:i1", edit({ title: "Loan to Paul (paid)" }));
    writeFormDraft("new-folder", { name: "Family" });
    jest.advanceTimersByTime(FORM_DRAFT_SAVE_MS + 1);
    await formDraftsSettled();

    expect([...rows.keys()]).toEqual(["edit:i1"]);

    removeFormDraft("edit:i1");
    await formDraftsSettled();
    expect(rows.size).toBe(0);
  });

  it("reloads saved changes when the user comes back", async () => {
    const { db, rows } = memoryDb();
    rows.set("edit:i2", { userId: "u1", value: edit({ note: "<p>Paid</p>" }) });
    await attachFormDrafts("u1", db);
    expect(readFormDraft<EditDraft>("edit:i2")?.note).toBe("<p>Paid</p>");
  });

  it("only flags real changes", () => {
    expect(hasEditChanges(undefined, saved)).toBe(false);
    expect(hasEditChanges(edit(), saved)).toBe(false);
    expect(hasEditChanges(edit({ note: "Paul owes 500" }), saved)).toBe(false);
    expect(hasEditChanges(edit({ title: "Paid" }), saved)).toBe(true);
    expect(hasEditChanges(edit({ note: "<p>Paid</p>" }), saved)).toBe(true);
    expect(hasEditChanges(edit({ removed: ["f1" as never] }), saved)).toBe(
      true,
    );
  });

  it("clears every saved change on sign-out", async () => {
    const { db, rows } = memoryDb();
    await attachFormDrafts("u1", db);
    writeFormDraft("edit:i1", edit({ title: "x" }));
    jest.advanceTimersByTime(FORM_DRAFT_SAVE_MS + 1);
    await formDraftsSettled();
    clearFormDrafts();
    await formDraftsSettled();
    expect(rows.size).toBe(0);
    expect(readFormDraft("edit:i1")).toBeUndefined();
  });
});
