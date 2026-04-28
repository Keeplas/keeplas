"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ErrorAlert } from "@keeplas/ui";
import { AuthHeroSection } from "./auth-hero-section";
import { MobileBrand } from "./mobile-brand";

interface FooterLink {
  prompt: string;
  label: string;
  href: string;
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
    <main className="min-h-screen flex flex-col md:flex-row">
      <AuthHeroSection decoration={heroDecoration} />

      <section className="flex-1 flex items-center justify-center p-8 md:p-24 relative bg-surface">
        <MobileBrand />

        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full mb-6 shadow-sm">
              <svg
                className="w-5 h-5 text-secondary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
              <span className="text-label-md text-primary">
                {badgeLabel}
              </span>
            </div>
            <h3 className="text-headline-md text-primary mb-2">
              {heading}
            </h3>
            <p className="text-body-lg text-on-surface-variant">{description}</p>
          </div>

          <ErrorAlert message={error} />

          {children}

          <p className="mt-12 text-center text-body-md text-on-surface-variant">
            {footer.prompt}{" "}
            <Link href={footer.href} className={accentClass}>
              {footer.label}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
