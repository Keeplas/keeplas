import { useCallback, useState, type ReactNode } from "react";

import { UpgradeSheet } from "@/features/billing/upgrade-sheet";
import { classifyUploadError } from "@/features/outbox/outbox";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/**
 * A save refused because storage is full (a text edit, a new category, a
 * restore…: the server refuses them past the quota like uploads). `handle`
 * says so and, on the free plan, opens the Lifetime upgrade; it returns
 * false for any other error. Render `sheet` in the screen (inside a parent
 * sheet on iOS so it presents over it).
 */
export function useStorageFullPrompt(): {
  handle: (error: unknown) => boolean;
  sheet: ReactNode;
} {
  const { t } = useI18n();
  const lifetime = useViewer().plan === "lifetime";
  const [upgrading, setUpgrading] = useState(false);

  const handle = useCallback(
    (error: unknown) => {
      if (classifyUploadError(error) !== "quota") return false;
      toast({
        variant: "error",
        title: t("storageFull.title"),
        description: t(
          lifetime ? "storageFull.bodyLifetime" : "storageFull.body",
        ),
      });
      if (!lifetime) setUpgrading(true);
      return true;
    },
    [t, lifetime],
  );

  return {
    handle,
    sheet: (
      <UpgradeSheet visible={upgrading} onDismiss={() => setUpgrading(false)} />
    ),
  };
}
