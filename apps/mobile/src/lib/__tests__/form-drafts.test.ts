import { clearFormDrafts, readFormDraft, writeFormDraft } from "../form-drafts";

describe("form drafts", () => {
  it("keep what was typed until the form is saved or the session ends", () => {
    writeFormDraft("edit:i1", { title: "Loan to Paul (paid)" });
    writeFormDraft("new-folder", { name: "Family" });

    expect(readFormDraft("edit:i1")).toEqual({ title: "Loan to Paul (paid)" });
    expect(readFormDraft("edit:i2")).toBeUndefined();

    clearFormDrafts();
    expect(readFormDraft("edit:i1")).toBeUndefined();
    expect(readFormDraft("new-folder")).toBeUndefined();
  });
});
