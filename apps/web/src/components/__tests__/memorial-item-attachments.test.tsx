import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { OpenedFile } from "@/lib/use-opened-files";

let files: OpenedFile[] = [];
// Stable across renders, like the real crypto context.
const decryptBlobWithKey = async (cipher: Blob) => cipher;
const usePdfPages = vi.fn(
  (_file: Blob | null, _page: number, _zoom: number) => ({
    thumbnails: ["thumb-1.png"],
    page: { src: "page-1.png", width: 470, height: 600 },
    error: false,
  }),
);

vi.mock("convex/react", () => ({
  useQuery: (_ref: unknown, args: { fileId?: string }) =>
    args.fileId ? "https://storage.example/cipher" : [],
}));
vi.mock("@/lib/use-opened-files", () => ({ useOpenedFiles: () => files }));
vi.mock("@/lib/use-vault-crypto", () => ({
  useVaultCrypto: () => ({ decryptBlobWithKey, isReady: true }),
}));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/vault/preview/use-pdf-pages", () => ({
  usePdfPages: (file: Blob | null, page: number, zoom: number) =>
    usePdfPages(file, page, zoom),
}));

import { MemorialItemAttachments } from "@/components/memorial-item-attachments";

function documentFile(name: string, mimeType: string): OpenedFile {
  return {
    _id: `file-${name}` as Id<"vault_item_files">,
    name,
    mimeType,
    kind: "document",
    size: 1200,
    iv: "iv",
  } as OpenedFile;
}

function renderAttachments() {
  render(
    <MemorialItemAttachments
      contactId={"contact" as Id<"trusted_contacts">}
      itemId={"item" as Id<"vault_items">}
      itemDek={{} as CryptoKey}
    />,
  );
}

// A contact previews a PDF in the app, as the owner does in their vault:
// pdf.js draws its pages as images, so the file itself is never opened as a
// blob: page on the Keeplas origin (finding #45). Other documents download.
describe("MemorialItemAttachments documents", () => {
  beforeEach(() => {
    usePdfPages.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["%PDF-1.7"]),
      })),
    );
    URL.createObjectURL = vi.fn(() => "blob:plain");
    URL.revokeObjectURL = vi.fn();
  });

  it("previews a PDF page by page and still offers the download", async () => {
    files = [documentFile("will.pdf", "application/pdf")];
    renderAttachments();

    expect(await screen.findByRole("img", { name: "pageOf" })).toHaveAttribute(
      "src",
      "page-1.png",
    );
    expect(usePdfPages.mock.lastCall?.[0]).toBeInstanceOf(Blob);
    expect(
      screen.getByRole("link", { name: "attachments.download" }),
    ).toHaveAttribute("download", "will.pdf");
    expect(screen.queryByText("attachments.open")).toBeNull();
  });

  it("only downloads a document the browser could run as a page", async () => {
    files = [documentFile("page.html", "text/html")];
    renderAttachments();

    expect(await screen.findByText("attachments.documentReady")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "attachments.download" }),
    ).toHaveAttribute("download", "page.html");
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(screen.queryByRole("img", { name: "pageOf" })).toBeNull();
  });
});
