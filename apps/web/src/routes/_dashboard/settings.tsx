import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { Link, usePathname } from "@/lib/navigation";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsLayout,
});

// Full v2 screens (W04-7, W04-5) carry their own header; the other settings
// pages get a way back to Settings.
const V2_SCREENS = new Set(["/settings", "/settings/recovery"]);

function SettingsLayout() {
  const t = useTranslations("settings.overview");
  const pathname = usePathname();
  if (V2_SCREENS.has(pathname.replace(/\/$/, ""))) return <Outlet />;
  return (
    <div className="flex flex-col gap-[20px]">
      <Link
        href="/settings"
        className="inline-flex w-fit items-center gap-[6px] rounded-xs text-body-sm text-text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <Icon path={ICON_PATHS.chevronLeft} className="size-[16px]" />
        {t("back")}
      </Link>
      <Outlet />
    </div>
  );
}
