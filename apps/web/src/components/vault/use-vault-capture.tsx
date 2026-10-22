import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { toast } from "@keeplas/ui";
import { AddItemDialog } from "@/components/add-item-dialog";
import {
  captureKindOf,
  inferFileKind,
  type CaptureKind,
} from "@/lib/attachment-capture";
import { formatBytes } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import { useCreateItem } from "@/lib/use-create-item";
import { useUploadQueue } from "@/lib/upload-queue";
import { useVaultData } from "@/lib/vault-data";
import { extensionOf } from "@/lib/vault-list";
import type { VaultCategory } from "@/lib/vault-categories";
import { AddFileDialog, titleOf, type AddFileValues } from "./add-file-dialog";
import type { AddKind } from "./add-item-menu";
import { SecuringDialog } from "./securing-dialog";

interface Securing {
  jobId: string;
  file: {
    kind: ReturnType<typeof inferFileKind>;
    name: string;
    detail: string;
  };
}

/**
 * Adding to the vault from the dashboard and the vault list: the "Add item"
 * kinds, files picked or dropped, and scanning with the phone. Returns the
 * handlers and the dialogs to render. `category` presets new items (the list
 * the owner is looking at).
 */
export function useVaultCapture(category: VaultCategory = "personal_document") {
  const t = useTranslations("hub.add");
  const locale = useLocale();
  const router = useRouter();
  const vault = useQuery(api.vaults.getVault);
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const { folders } = useVaultData();
  const createItem = useCreateItem();
  const { jobs, cancel, background } = useUploadQueue();
  const [adding, setAdding] = useState<{
    kind: CaptureKind;
    files: File[];
  } | null>(null);
  const [voice, setVoice] = useState(false);
  const [securing, setSecuring] = useState<Securing | null>(null);
  const progress = securing ? jobs[securing.jobId] : undefined;

  useEffect(() => {
    if (vault === null) void getOrCreateVault();
  }, [vault, getOrCreateVault]);

  // A failed or cancelled upload closes the dialog (the queue explains).
  const ended = progress?.phase === "failed" || progress?.phase === "cancelled";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the upload job ended outside this dialog.
    if (ended) setSecuring(null);
  }, [ended]);

  async function submit(values: AddFileValues) {
    const single = values.files.length === 1;
    const started = await Promise.all(
      values.files.map((file) =>
        createItem(
          {
            title: single
              ? values.title.trim() || titleOf(file.name)
              : titleOf(file.name),
            note: "",
            category: values.category,
            folderId: values.folderId,
            contactIds: values.contactIds,
            files: [
              {
                blob: file,
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                kind: inferFileKind(file.type),
              },
            ],
          },
          !single,
        ),
      ),
    );
    setAdding(null);
    const [jobId] = started;
    if (single && jobId) {
      const file = values.files[0];
      setSecuring({
        jobId,
        file: {
          kind: inferFileKind(file.type),
          name: file.name,
          detail: [
            extensionOf(file.name).toUpperCase(),
            formatBytes(file.size, locale),
          ]
            .filter(Boolean)
            .join(" · "),
        },
      });
    }
  }

  return {
    add: (kind: AddKind) => {
      if (kind === "note") router.push("/vault/new");
      else if (kind === "voice") setVoice(true);
      else setAdding({ kind, files: [] });
    },
    files: (files: File[]) => setAdding({ kind: captureKindOf(files), files }),
    scan: () =>
      toast({ title: t("scan.title"), description: t("scan.onPhone") }),
    dialogs: (
      <>
        <AddFileDialog
          open={adding !== null}
          onOpenChange={(open) => !open && setAdding(null)}
          kind={adding?.kind ?? "document"}
          initialFiles={adding?.files ?? []}
          defaultCategory={category}
          folders={folders ?? []}
          onSubmit={submit}
        />
        {securing ? (
          <SecuringDialog
            open
            file={securing.file}
            progress={progress}
            onCancel={() => {
              cancel(securing.jobId);
              setSecuring(null);
            }}
            onBackground={() => {
              background(securing.jobId);
              setSecuring(null);
            }}
            onOpenItem={() => {
              if (progress?.itemId) router.push(`/vault/${progress.itemId}`);
              setSecuring(null);
            }}
          />
        ) : null}
        {vault ? (
          <AddItemDialog
            vaultId={vault._id}
            open={voice}
            onOpenChange={setVoice}
            defaultCategory="other"
          />
        ) : null}
      </>
    ),
  };
}
