import { useState, type ReactNode } from "react";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, cn, Icon, Input, useConfirm } from "@keeplas/ui";
import { PermissionOffMessage } from "@/components/permission-off-message";
import { Modal } from "@/components/v2/modal";
import { formatCountdown } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import type { QueuedFile } from "@/lib/upload-queue";
import {
  LEVEL_BARS,
  useVoiceRecorder,
  type RecorderState,
} from "@/lib/use-voice-recorder";
import type { FolderSummary } from "@/lib/vault-data";
import { AccessField, EncryptionNote, Field, FolderField } from "./form-fields";

/** W06-6: notes stop at 10 minutes. */
export const MAX_VOICE_SECONDS = 10 * 60;

const STATUS: Record<RecorderState, "recording" | "paused" | "starting"> = {
  recording: "recording",
  paused: "paused",
  starting: "starting",
  denied: "starting",
  unavailable: "starting",
};

// Grey bars before the meter fills (Figma's resting heights).
const RESTING = [10, 18, 8, 12, 6, 8, 6];

export interface VoiceItemValues {
  title: string;
  folderId: Id<"folders"> | null;
  contactIds: Id<"trusted_contacts">[];
  file: QueuedFile;
}

/** The recorder face: mic badge, clock, status, level meter. */
export function VoiceMeter({
  state,
  elapsed,
  levels,
}: {
  state: RecorderState;
  elapsed: number;
  levels: number[];
}) {
  const t = useTranslations("vaultItem.voice");
  const bars = [
    ...levels.map((level) => ({ height: 6 + level * 38, live: true })),
    ...RESTING.concat(RESTING, RESTING, RESTING, RESTING, RESTING)
      .slice(0, Math.max(0, LEVEL_BARS - levels.length))
      .map((height) => ({ height, live: false })),
  ];
  return (
    <div className="flex flex-col items-center gap-[10px] py-[8px]">
      <span className="flex size-[132px] items-center justify-center rounded-full bg-bg-accent">
        <span className="flex size-[96px] items-center justify-center rounded-full bg-progress-track">
          <span className="flex size-[64px] items-center justify-center rounded-full bg-action-primary text-text-inverse">
            <Icon path={ICON_PATHS.mic} className="size-[28px]" />
          </span>
        </span>
      </span>
      <span className="font-serif text-[40px] leading-[46px] font-semibold text-text-primary tabular-nums">
        {formatCountdown(Math.floor(elapsed) * 1000)}
      </span>
      <span
        role="status"
        className="flex items-center gap-[8px] text-body-sm text-text-muted"
      >
        <span
          className={cn(
            "size-[8px] rounded-full",
            state === "recording" ? "bg-status-active" : "bg-status-pending",
          )}
        />
        {t(`status.${STATUS[state]}`)}
      </span>
      <span
        aria-hidden
        className="mt-[10px] flex h-[48px] items-center justify-center gap-[4px]"
      >
        {bars.map((bar, index) => (
          <span
            key={index}
            className={cn(
              "w-[4px] rounded-[2px]",
              bar.live ? "bg-progress-fill" : "bg-border-default",
            )}
            style={{ height: bar.height }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * W06-6 "Record a voice note". As a new item: title, folder and who can see
 * it. In a note editor (`onAttach`): the recording only, attached on save.
 */
export function VoiceDialog({
  open,
  onOpenChange,
  folders,
  onSave,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderSummary[];
  onSave?: (values: VoiceItemValues) => Promise<void>;
  onAttach?: (file: QueuedFile) => void;
}) {
  const t = useTranslations("vaultItem.voice");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      width="w-[580px]"
    >
      {/* Mounted while open: the microphone is on only while it shows. */}
      <VoiceForm
        folders={folders}
        onSave={onSave}
        onAttach={onAttach}
        onClose={() => onOpenChange(false)}
      />
    </Modal>
  );
}

function VoiceForm({
  folders,
  onSave,
  onAttach,
  onClose,
}: {
  folders: FolderSummary[];
  onSave?: (values: VoiceItemValues) => Promise<void>;
  onAttach?: (file: QueuedFile) => void;
  onClose: () => void;
}) {
  const t = useTranslations("vaultItem.voice");
  const confirm = useConfirm();
  const recorder = useVoiceRecorder(MAX_VOICE_SECONDS);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<Id<"folders"> | null>(null);
  const [contactIds, setContactIds] = useState<Id<"trusted_contacts">[]>([]);
  const [saving, setSaving] = useState(false);

  if (recorder.state === "denied" || recorder.state === "unavailable") {
    return (
      <PermissionOffMessage
        device="microphone"
        onRetry={recorder.reset}
        onDismiss={onClose}
      />
    );
  }

  async function reset() {
    const ok = await confirm({
      title: t("resetTitle"),
      description: t("resetBody", {
        time: formatCountdown(Math.floor(recorder.elapsed) * 1000),
      }),
      confirmLabel: t("resetConfirm"),
      cancelLabel: t("resetKeep"),
    });
    if (ok) recorder.reset();
  }

  async function save() {
    setSaving(true);
    try {
      const recording = await recorder.finish();
      const name = `${title.trim() || t("defaultName")}.${
        recording.mimeType.includes("mp4") ? "m4a" : "webm"
      }`;
      const file: QueuedFile = {
        blob: recording.blob,
        name,
        mimeType: recording.mimeType,
        kind: "audio",
        durationSec: recording.durationSec,
      };
      if (onAttach) {
        onAttach(file);
      } else {
        await onSave?.({
          title: title.trim() || t("defaultName"),
          folderId,
          contactIds,
          file,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <VoiceRecorderBody
      meter={
        <VoiceMeter
          state={recorder.state}
          elapsed={recorder.elapsed}
          levels={recorder.levels}
        />
      }
      fields={
        onAttach ? null : (
          <>
            <Field label={t("titleLabel")}>
              {(id) => (
                <Input
                  id={id}
                  variant="field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("titlePlaceholder")}
                />
              )}
            </Field>
            <div className="grid gap-[16px] sm:grid-cols-2">
              <FolderField
                value={folderId}
                onChange={setFolderId}
                folders={folders}
              />
              <AccessField
                value={contactIds}
                onChange={setContactIds}
                folder={folders.find((folder) => folder.id === folderId)}
              />
            </div>
          </>
        )
      }
      paused={recorder.state === "paused"}
      onDiscard={onClose}
      onReset={() => void reset()}
      onPause={recorder.state === "paused" ? recorder.resume : recorder.pause}
      onSave={() => void save()}
      saveLabel={onAttach ? t("attach") : t("save")}
      busy={saving || recorder.state === "starting"}
    />
  );
}

/** Layout of the dialog body, shared with the visual harness. */
export function VoiceRecorderBody({
  meter,
  fields,
  paused,
  onDiscard,
  onReset,
  onPause,
  onSave,
  saveLabel,
  busy,
}: {
  meter: ReactNode;
  fields: ReactNode;
  paused: boolean;
  onDiscard: () => void;
  onReset: () => void;
  onPause: () => void;
  onSave: () => void;
  saveLabel: string;
  busy: boolean;
}) {
  const t = useTranslations("vaultItem.voice");
  return (
    <>
      {meter}
      {fields}
      <EncryptionNote>{t("encrypted")}</EncryptionNote>
      <div className="flex items-center gap-[12px]">
        <Button variant="plain" size="regular" onClick={onDiscard}>
          {t("discard")}
        </Button>
        <span className="flex-1" />
        <Button variant="bordered" size="regular" onClick={onReset}>
          <Icon path={ICON_PATHS.rotate} className="size-[16px]" />
          {t("reset")}
        </Button>
        <Button variant="bordered" size="regular" onClick={onPause}>
          <Icon
            path={paused ? ICON_PATHS.mic : ICON_PATHS.pause}
            className="size-[16px]"
          />
          {paused ? t("resume") : t("pause")}
        </Button>
        <Button
          variant="primary"
          size="regular"
          onClick={onSave}
          disabled={busy}
        >
          <Icon path={ICON_PATHS.check} className="size-[16px]" />
          {saveLabel}
        </Button>
      </div>
    </>
  );
}
