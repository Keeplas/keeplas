import { useCallback, useRef, useState } from "react";
import type { QueuedFile } from "@/lib/upload-queue";
import { VoiceDialog } from "./voice-dialog";

/**
 * "Voice note" in the note editor: opens the recorder and resolves with the
 * recording to attach, or null when the owner discards it.
 */
export function useVoiceAttach() {
  const [open, setOpen] = useState(false);
  const pending = useRef<((file: QueuedFile | null) => void) | null>(null);

  const record = useCallback(
    () =>
      new Promise<QueuedFile | null>((resolve) => {
        pending.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const settle = (file: QueuedFile | null) => {
    pending.current?.(file);
    pending.current = null;
    setOpen(false);
  };

  return {
    record,
    dialog: (
      <VoiceDialog
        open={open}
        onOpenChange={(next) => !next && settle(null)}
        onAttach={settle}
      />
    ),
  };
}
