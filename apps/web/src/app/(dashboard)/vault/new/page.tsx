import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { NoteEditor, type NoteValues } from "@/components/vault/note-editor";
import { useVaultCapture } from "@/components/vault/use-vault-capture";
import { useVoiceAttach } from "@/components/vault/use-voice-attach";
import { useTranslations } from "@/lib/i18n";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { useVaultData } from "@/lib/vault-data";
import { useCreateItem } from "@/lib/use-create-item";
import { useUploadQueue } from "@/lib/upload-queue";

/**
 * W06-5 New note, and the life check welcome message (`?welcome=1`): sealed
 * here, its attachments uploaded, then the note opens.
 */
export default function NewNotePage() {
  const t = useTranslations("vaultItem.editor");
  const lists = useTranslations("vaultList");
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { categories } = useVaultData();
  const createItem = useCreateItem();
  const { jobs, background } = useUploadQueue();
  const voice = useVoiceAttach();
  // "Scan with phone": the scan is saved as its own item (W06-7).
  const capture = useVaultCapture();
  const [jobId, setJobId] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);
  const progress = jobId ? jobs[jobId] : undefined;
  const running = useRef<string | null>(null);

  useEffect(() => {
    running.current = jobId;
  }, [jobId]);

  // Leaving while it uploads: the upload goes on, followed by a toast.
  useEffect(
    () => () => {
      if (running.current) background(running.current);
    },
    [background],
  );

  useEffect(() => {
    if (progress?.phase === "done" && progress.itemId) {
      running.current = null;
      router.replace(`/vault/${progress.itemId}`);
    }
    if (progress?.phase === "failed" || progress?.phase === "cancelled") {
      running.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the upload job ended; the queue shows why.
      setJobId(null);
    }
  }, [progress, router]);

  async function save(values: NoteValues) {
    setSealing(true);
    try {
      // The welcome message without picks goes to every trusted contact.
      const everyone = welcome && values.contactIds.length === 0;
      const id = await createItem({
        title: values.title,
        note: values.note,
        category: welcome ? "conditional_message" : values.category,
        categoryId: welcome ? undefined : values.categoryId,
        contactIds: everyone
          ? (contacts ?? []).map((contact) => contact._id)
          : values.contactIds,
        everyone,
        releaseIntroduction: welcome,
        files: values.added,
      });
      setJobId(id);
    } finally {
      setSealing(false);
    }
  }

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.uploaded / progress.total) * 100)
      : 0;
  const saving = sealing
    ? t("saving")
    : progress?.phase === "uploading"
      ? t("savingPercent", { percent })
      : jobId
        ? t("saving")
        : null;

  return (
    <>
      <NoteEditor
        breadcrumb={
          welcome
            ? [
                { label: t("lifeCheck"), href: "/life-check" },
                { label: t("welcomeTitle") },
              ]
            : [
                { label: lists("breadcrumb"), href: "/hub" },
                { label: t("newTitle") },
              ]
        }
        heading={welcome ? t("welcomeTitle") : t("newTitle")}
        subtitle={welcome ? t("welcomeSubtitle") : t("newSubtitle")}
        welcome={welcome}
        initial={{
          title: "",
          note: "",
          category: "wishes",
          contactIds: [],
        }}
        categories={categories ?? []}
        saving={saving}
        onSave={(values) => void save(values)}
        onCancel={() => router.back()}
        onScan={capture.scan}
        onRecordVoice={voice.record}
      />
      {voice.dialog}
      {capture.dialogs}
    </>
  );
}
