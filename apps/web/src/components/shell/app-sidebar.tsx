import { useState } from "react";
import {
  cn,
  Icon,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { Link, usePathname } from "@/lib/navigation";

/**
 * Web navigation (OPEN-DECISIONS #5): My vault, Shared with me, People, Life
 * check, Devices, Settings. Recovery center lives under Settings. `match`
 * lists the other routes that keep an item highlighted.
 */
const NAV_ITEMS = [
  {
    key: "myVault",
    href: "/hub",
    match: ["/vault"],
    icon: ICON_PATHS.lock,
  },
  {
    key: "sharedWithMe",
    href: "/shared-with-me",
    match: [],
    icon: ICON_PATHS.userCircle,
  },
  {
    key: "people",
    href: "/trusted-contacts",
    match: [],
    icon: ICON_PATHS.people,
  },
  {
    key: "lifeCheck",
    href: "/life-check",
    match: [],
    icon: ICON_PATHS.checkCircle,
  },
  { key: "devices", href: "/devices", match: [], icon: ICON_PATHS.laptop },
  { key: "settings", href: "/settings", match: [], icon: ICON_PATHS.settings },
] as const;

const isActive = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/hub"
      className={cn(
        "flex items-center gap-[10px] rounded-sm pl-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
        className,
      )}
    >
      <img
        src="/assets/logo/logo-inverse.svg"
        alt=""
        width={32}
        height={32}
        className="size-[32px]"
      />
      <span className="text-h3 text-header-text">Keeplas</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("chrome.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-col gap-[4px]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, [item.href, ...item.match]);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-[12px] rounded-sm px-[12px] py-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                  active
                    ? "bg-bg-info text-label text-text-primary"
                    : "text-body text-header-text-muted hover:bg-header-text/10",
                )}
              >
                <Icon path={item.icon} className="size-[20px] shrink-0" />
                <span className="truncate">{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Landscape at the foot of the sidebar (Figma: 288 × 180 at x −40). */
function SidebarLandscape() {
  return (
    <img
      src="/assets/illustrations/desktop-landscape-night.svg"
      alt=""
      width={288}
      height={180}
      className="pointer-events-none absolute bottom-0 left-[-40px] h-[180px] w-[288px] max-w-none select-none"
    />
  );
}

/** Figma "Sidebar" (W04-3 → W04-7): navy column, 248 px. */
export function AppSidebar() {
  const t = useTranslations("chrome.nav");
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-[4px] overflow-hidden bg-bg-header px-[16px] pt-[28px] md:flex">
        <Brand className="pb-[20px]" />
        <NavList />
        <SidebarLandscape />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between bg-bg-header px-[16px] py-[12px] md:hidden">
        <Brand />
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label={t("openMenu")}
            className="rounded-sm p-[8px] text-header-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <Icon path={ICON_PATHS.menu} className="size-[24px]" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[248px] flex-col gap-[4px] overflow-hidden border-0 bg-bg-header px-[16px] pt-[28px]"
          >
            <SheetTitle className="sr-only">{t("label")}</SheetTitle>
            <Brand className="pb-[20px]" />
            <NavList onNavigate={() => setMenuOpen(false)} />
            <SidebarLandscape />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
