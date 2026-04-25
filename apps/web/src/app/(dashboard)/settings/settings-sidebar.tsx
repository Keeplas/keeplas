"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn, Icon, UserAvatar } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getInitials } from "@/lib/user";

export interface SettingsNavItem {
  label: string;
  href: string;
  iconPath: string;
}

interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "Account",
    items: [
      { label: "Identity", href: "/settings", iconPath: ICON_PATHS.person },
      { label: "Preferences", href: "/settings/preferences", iconPath: ICON_PATHS.bell },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "Security Center", href: "/settings/security", iconPath: ICON_PATHS.shieldCheck },
      { label: "Recovery Kit", href: "/settings/recovery-kit", iconPath: ICON_PATHS.key },
      {
        label: "Continuity Protocol",
        href: "/settings/continuity",
        iconPath: ICON_PATHS.heartbeat,
      },
    ],
  },
  {
    label: "Plans & Billing",
    items: [
      {
        label: "Usage",
        href: "/settings/usage",
        iconPath: ICON_PATHS.cloud,
      },
      {
        label: "Subscription",
        href: "/settings/subscription",
        iconPath: ICON_PATHS.creditCard,
      },
    ],
  },
];

function isItemActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/settings") return pathname === "/settings";
  return pathname.startsWith(href);
}

export function SettingsSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const user = useQuery(api.users.viewer);
  const pathname = usePathname();
  const { signOut } = useAuthActions();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onCloseMobile}
        aria-hidden
        className={cn(
          "lg:hidden absolute inset-0 bg-primary/20 z-10 transition-opacity",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />

      <aside
        className={cn(
          "shrink-0 flex flex-col border-r border-outline-variant/15 bg-surface transition-transform",
          // Desktop: always visible, in normal flow
          "lg:relative lg:w-72 lg:translate-x-0",
          // Mobile/tablet: absolute drawer
          "absolute inset-y-0 left-0 z-20 w-72 max-w-[85%]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Profile block + mobile close */}
        <div className="p-6 border-b border-outline-variant/15 flex items-center gap-3">
          <UserAvatar
            size="md"
            imageUrl={user?.avatarUrl}
            initials={getInitials(user?.name || user?.email)}
            alt={user?.name ?? "User"}
            fallbackClassName="bg-primary text-on-primary"
          />
          <div className="min-w-0 flex-1">
            <p className="text-headline-sm text-primary truncate">
              {user?.name || "Curator"}
            </p>
            <p className="text-body-md text-on-surface-variant truncate">
              {user?.email ?? "Secure session"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="lg:hidden shrink-0 p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant cursor-pointer"
          >
            <Icon path={ICON_PATHS.close} className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {SETTINGS_NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-label-md text-on-surface-variant/60">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        replace
                        onClick={onCloseMobile}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-body-md transition-colors",
                          active
                            ? "ghost-border bg-surface-container-lowest text-primary font-bold"
                            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                        )}
                      >
                        <Icon path={item.iconPath} className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer — Documentation + Contact Us + Sign out */}
        <div className="p-4 border-t border-outline-variant/15 space-y-1">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-body-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <Icon path={ICON_PATHS.book} className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Documentation</span>
            <Icon
              path={ICON_PATHS.openInNew}
              className="w-3 h-3 text-outline-variant shrink-0"
            />
          </a>
          <Link
            href="/settings/contact"
            replace
            onClick={onCloseMobile}
            aria-current={
              isItemActive(pathname, "/settings/contact") ? "page" : undefined
            }
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-body-md transition-colors",
              isItemActive(pathname, "/settings/contact")
                ? "ghost-border bg-surface-container-lowest text-primary font-bold"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            )}
          >
            <Icon path={ICON_PATHS.mail} className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Contact Us</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-body-md text-error hover:bg-error-container/40 transition-colors cursor-pointer"
          >
            <Icon path={ICON_PATHS.signOut} className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
