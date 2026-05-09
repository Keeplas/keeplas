"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@keeplas/ui";
import { SettingsSidebar } from "./settings-sidebar";
import { SettingsHeader } from "./settings-header";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/hub");
    }
  }, [router]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="w-[95vw] md:w-[90vw] h-[90vh] max-w-[1400px] p-0 overflow-hidden flex rounded-2xl">
        <div className="relative flex w-full h-full">
          <SettingsSidebar
            mobileOpen={mobileNavOpen}
            onCloseMobile={() => setMobileNavOpen(false)}
          />
          <div className="flex-1 flex flex-col min-w-0 bg-surface-container-low">
            <SettingsHeader
              onClose={handleClose}
              onOpenMenu={() => setMobileNavOpen(true)}
            />
            <div className="flex-1 overflow-y-auto p-6 md:p-8">{children}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
