import { useCallback } from "react";

import { holdLock } from "@/lib/auto-lock";
import { dismissToast, toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { prepareVideo } from "./media";
import type { CaptureFile } from "./seal";

export function usePrepareMedia() {
  const { t } = useI18n();
  return useCallback(
    async (files: CaptureFile[]): Promise<CaptureFile[]> => {
      if (!files.some((file) => file.kind === "video")) return files;
      const release = holdLock();
      let shown = -1;
      const report = (ratio: number) => {
        const pct = Math.min(100, Math.floor(ratio * 10) * 10);
        if (pct === shown) return;
        shown = pct;
        toast({
          variant: "info",
          title: t("capture.preparingVideo"),
          description: t("capture.preparingVideoPct", { pct }),
        });
      };
      try {
        report(0);
        const prepared: CaptureFile[] = [];
        for (const file of files)
          prepared.push(await prepareVideo(file, report));
        return prepared;
      } finally {
        dismissToast();
        release();
      }
    },
    [t],
  );
}
