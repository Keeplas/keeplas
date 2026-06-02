import type { ReactNode } from "react";
import { Link } from "@/lib/navigation";
import { ErrorAlert } from "@keeplas/ui";
import { AuthHeroSection } from "./auth-hero-section";
import { MobileBrand } from "./mobile-brand";
import { LanguageSwitcher } from "@/components/language-switcher";

interface FooterLink {
  prompt: string;
  label: string;
  /** Navigates to a route. Use `onClick` instead for in-page actions. */
  href?: string;
  /** In-page action (e.g. reset a multi-step form). Takes precedence over `href`. */
  onClick?: () => void;
  accent?: "primary" | "secondary";
}

interface AuthFormShellProps {
  badgeLabel: string;
  heading: string;
  description: string;
  footer: FooterLink;
  error: string;
  children: ReactNode;
  heroDecoration?: ReactNode;
}

export function AuthFormShell({
  badgeLabel,
  heading,
  description,
  footer,
  error,
  children,
  heroDecoration,
}: AuthFormShellProps) {
  const accentClass =
    footer.accent === "primary"
      ? "text-primary font-bold hover:underline decoration-secondary decoration-2 underline-offset-4"
      : "text-secondary font-bold hover:underline decoration-secondary decoration-2 underline-offset-4";

  return (
    <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
      <AuthHeroSection decoration={heroDecoration} />

      <section className="flex-1 relative bg-surface md:overflow-y-auto">
        <MobileBrand />

        {/* Inner wrapper centers the card when it fits, but `min-h-full` lets
            it grow past the viewport so a tall form scrolls from the top
            instead of being clipped (flex `items-center` + overflow would
            otherwise hide the top, including the language switcher). */}
        <div className="flex min-h-full items-center justify-center p-8 md:p-10 lg:p-12 xl:p-16">
          <div className="w-full max-w-md">
            <div className="mb-5 flex justify-end">
              <LanguageSwitcher />
            </div>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface-container-lowest rounded-full mb-4 shadow-sm">
                <svg
                  className="w-5 h-5 text-secondary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                <span className="text-label-md text-primary">{badgeLabel}</span>
              </div>
              <h3 className="text-headline-md text-primary mb-2">{heading}</h3>
              <p className="text-body-md text-on-surface-variant">
                {description}
              </p>
            </div>

            <ErrorAlert message={error} />

            {children}

            <p className="mt-8 text-center text-body-md text-on-surface-variant">
              {footer.prompt}{" "}
              {footer.onClick ? (
                <button
                  type="button"
                  onClick={footer.onClick}
                  className={accentClass}
                >
                  {footer.label}
                </button>
              ) : (
                <Link href={footer.href ?? "#"} className={accentClass}>
                  {footer.label}
                </Link>
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
