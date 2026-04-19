"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, Icon, UserAvatar } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { getInitials } from "@/lib/user";
import { NotificationsMenu } from "./notifications-menu";

const DASHBOARD_ICON =
  "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z";

const SETTINGS_OUTER =
  "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z";
const SETTINGS_INNER = "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z";
const CHEVRON_EXPAND = "M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9";

const navItems: Array<{ label: string; href: string; iconPath: string }> = [
  { label: "Dashboard", href: "/dashboard", iconPath: DASHBOARD_ICON },
  { label: "Life Map", href: "/life-map", iconPath: ICON_PATHS.shieldCheck },
  { label: "Digital Vault", href: "/vault", iconPath: ICON_PATHS.lock },
  { label: "Messages", href: "/messages", iconPath: ICON_PATHS.notes },
  { label: "Trusted Contacts", href: "/trusted-contacts", iconPath: ICON_PATHS.users },
  { label: "Life Check", href: "/life-check", iconPath: ICON_PATHS.heartbeat },
  { label: "Scenario Engine", href: "/scenario", iconPath: ICON_PATHS.warning },
  { label: "Emergency Card", href: "/emergency-card", iconPath: ICON_PATHS.emergencyCard },
];

const MOBILE_NAV: Array<{ label: string; href: string; iconPath: string }> = [
  { label: "Dashboard", href: "/dashboard", iconPath: DASHBOARD_ICON },
  { label: "Vault", href: "/vault", iconPath: ICON_PATHS.lock },
  { label: "Map", href: "/life-map", iconPath: ICON_PATHS.shieldCheck },
  { label: "Messages", href: "/messages", iconPath: ICON_PATHS.notes },
  { label: "Trust", href: "/trusted-contacts", iconPath: ICON_PATHS.users },
];

function SettingsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={SETTINGS_OUTER} />
      <path strokeLinecap="round" strokeLinejoin="round" d={SETTINGS_INNER} />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useQuery(api.users.viewer);

  const initials = getInitials(user?.name || user?.email);
  const isSettingsActive = pathname?.startsWith("/settings");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-72 h-screen sticky top-0 bg-surface-container-low p-6">
        <div className="flex items-center gap-3 mb-8">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={40}
            height={40}
            className="shrink-0"
          />
          <span className="text-headline-md text-primary">
            Keeplas
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden">
          <ul className="flex flex-col space-y-2">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const path = item.iconPath;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl text-label-md transition-transform hover:translate-x-1",
                      isActive
                        ? "bg-secondary text-on-secondary shadow-lg"
                        : "text-secondary/70 hover:bg-surface-container-highest"
                    )}
                  >
                    <Icon path={path} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-4 pt-4 border-t border-outline-variant/15 space-y-2">
          <NotificationsMenu variant="sidebar" />
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-medium uppercase tracking-widest transition-transform hover:translate-x-1",
              isSettingsActive
                ? "bg-secondary text-on-secondary shadow-lg"
                : "text-secondary/70 hover:bg-surface-container-highest"
            )}
          >
            <SettingsIcon />
            <span>Settings</span>
          </Link>

          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-label-md transition-transform hover:translate-x-1 text-secondary/70 hover:bg-surface-container-highest"
          >
            <Icon path={ICON_PATHS.book} />
            <span className="flex-1 truncate">Documentation</span>
            <Icon
              path={ICON_PATHS.openInNew}
              className="w-3 h-3 text-outline-variant shrink-0"
            />
          </a>

          <Link
            href="/settings"
            className="mt-2 w-full flex items-center gap-3 p-3 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors group outline-none cursor-pointer"
          >
            <UserAvatar
              size="md"
              imageUrl={user?.avatarUrl}
              initials={initials}
              alt={user?.name ?? "User"}
              fallbackClassName="bg-secondary-fixed text-on-secondary-fixed"
            />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-headline-sm text-primary truncate">
                {user?.name || "Curator"}
              </p>
              <p className="text-label-md text-secondary truncate">
                {user?.email ?? "Secure session"}
              </p>
            </div>
            <Icon
              path={CHEVRON_EXPAND}
              className="w-4 h-4 text-outline-variant shrink-0 group-hover:text-secondary transition-colors"
            />
          </Link>
        </div>
      </aside>

      {/* Mobile top strip */}
      <header className="md:hidden sticky top-0 z-40 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={28}
            height={28}
          />
          <span className="text-headline-sm text-primary">
            Keeplas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsMenu variant="icon" align="end" />
          <Link
            href="/settings"
            aria-label="Open settings"
            className="p-1 rounded-xl outline-none cursor-pointer"
          >
            <UserAvatar
              size="sm"
              imageUrl={user?.avatarUrl}
              initials={initials}
              alt={user?.name ?? "User"}
              fallbackClassName="bg-secondary-fixed text-on-secondary-fixed"
            />
          </Link>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass">
        <ul className="flex items-center justify-around py-2 px-1">
          {MOBILE_NAV.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-label-md transition-colors",
                    isActive
                      ? "text-secondary-fixed"
                      : "text-on-primary/60 hover:text-on-primary/80"
                  )}
                >
                  <Icon path={item.iconPath} />
                  <span className="truncate max-w-[60px]">
                    {item.label.split(" ")[0]}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/settings"
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-label-md transition-colors",
                isSettingsActive
                  ? "text-secondary-fixed"
                  : "text-on-primary/60 hover:text-on-primary/80"
              )}
            >
              <SettingsIcon />
              <span>Settings</span>
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
