import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/navigation";
import { useTheme } from "@/lib/theme";
import { useShellAccount } from "./shell-account";

const MENU_ITEM =
  "gap-[10px] rounded-sm px-[10px] py-[8px] text-body-sm text-text-primary focus:bg-bg-subtle";

/** Avatar (Figma: 36 px navy circle) opening Settings, theme and sign out. */
function AccountMenu() {
  const t = useTranslations("chrome.account");
  const { initials, signOut } = useShellAccount();
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("menu")}
        className="flex size-[36px] items-center justify-center rounded-full bg-action-primary text-label text-text-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[200px] rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
      >
        <DropdownMenuItem
          className={MENU_ITEM}
          onSelect={() => router.push("/settings")}
        >
          <Icon path={ICON_PATHS.settings} className="size-[18px]" />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={MENU_ITEM}
          onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Icon path={ICON_PATHS.eye} className="size-[18px]" />
          {theme === "dark" ? t("lightMode") : t("darkMode")}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border-default" />
        <DropdownMenuItem className={MENU_ITEM} onSelect={signOut}>
          <Icon path={ICON_PATHS.signOut} className="size-[18px]" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface Crumb {
  label: string;
  /** Omitted on the current page (the last crumb). */
  href?: string;
}

/** "My vault › Documents › File.pdf" above a screen title (W06 frames). */
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-[6px] pb-[6px] text-[13px] leading-[18px] font-medium"
    >
      {crumbs.map((crumb, index) => (
        <span key={index} className="flex min-w-0 items-center gap-[6px]">
          {index > 0 ? (
            <Icon
              path={ICON_PATHS.chevronRight}
              className="size-[14px] shrink-0 text-icon-subtle"
            />
          ) : null}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="truncate rounded-xs text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate text-text-primary">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * A signed-in web screen (Figma "Main"): optional breadcrumb, title,
 * subtitle, then the screen's actions, language and account on the right,
 * then the screen's sections 20 px apart.
 */
export function ShellPage({
  title,
  subtitle,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[20px]">
      <header className="flex items-center gap-[16px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          {breadcrumb ? <Breadcrumb crumbs={breadcrumb} /> : null}
          <h1 className="truncate text-h1 text-text-primary">{title}</h1>
          <p className="text-body-lg text-text-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-[12px]">
          {actions}
          <LanguageSwitcher />
          <AccountMenu />
        </div>
      </header>
      {children}
    </div>
  );
}
