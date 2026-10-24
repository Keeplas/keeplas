/**
 * @jest-environment node
 */
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { encryptText, generateDek } from "@/crypto/envelope";
import { fileMetaJson, itemMetaJson } from "@/crypto/item-meta";
import { openSealedItem } from "../open-sealed-item";

const fileId = "file1" as Id<"vault_item_files">;

describe("openSealedItem", () => {
  it("opens the sealed title, note, category and file metadata", async () => {
    const key = await generateDek();
    const item = {
      encryptedTitle: await encryptText("Will", key),
      encryptedContent: await encryptText("<p>Read me</p>", key),
      encryptedMeta: await encryptText(
        itemMetaJson({ category: "other", categoryId: "cat1" }, "heart"),
        key,
      ),
    };
    const file = {
      _id: fileId,
      iv: "iv",
      encryptedMeta: await encryptText(
        fileMetaJson({
          name: "will.pdf",
          mimeType: "application/pdf",
          size: 1200,
          kind: "document",
        }),
        key,
      ),
    };

    await expect(openSealedItem(item, [file], key)).resolves.toEqual({
      key,
      title: "Will",
      note: "<p>Read me</p>",
      category: "other",
      categoryId: "cat1",
      icon: "heart",
      files: [
        {
          v: 1,
          name: "will.pdf",
          mimeType: "application/pdf",
          size: 1200,
          kind: "document",
          id: fileId,
          iv: "iv",
        },
      ],
    });
  });

  it("reads the plaintext columns of legacy rows", async () => {
    const key = await generateDek();
    const opened = await openSealedItem(
      {
        title: "Old note",
        category: "credential",
        encryptedContent: await encryptText("", key),
      },
      [{ _id: fileId, iv: "iv", name: "a.jpg", mimeType: "image/jpeg" }],
      key,
    );

    expect(opened).toMatchObject({ title: "Old note", category: "credential" });
    expect(opened.files[0]).toMatchObject({ name: "a.jpg", kind: "document" });
  });

  it("rejects with a key that does not open the item", async () => {
    const item = {
      encryptedContent: await encryptText("secret", await generateDek()),
    };

    await expect(
      openSealedItem(item, [], await generateDek()),
    ).rejects.toThrow();
  });
});
