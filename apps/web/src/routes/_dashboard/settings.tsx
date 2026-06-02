import { Outlet, createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Dialog, DialogContent } from "@keeplas/ui";
import { SettingsSidebar } from "@/app/(dashboard)/settings/settings-sidebar";
import { SettingsHeader } from "@/app/(dashboard)/settings/settings-header";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/hub" });
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
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <Outlet />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
