import type { ReactNode } from "react";
import { cn, KeeplasLogoMark } from "@keeplas/ui";
import { Illustration } from "./illustration";
import { LanguageSwitcher } from "./language-switcher";

/** Card on the right of an auth screen (Figma: radius 16, thin border). */
export const authCardClass =
  "w-full rounded-[16px] border border-border-default bg-bg-surface";

interface AuthScreenProps {
  title: ReactNode;
  body: string;
  /** Hero width at 1440 px: 760 (W04-1, D-01) by default, 640 on W04-2. */
  heroClassName?: string;
  children: ReactNode;
}

function Brand() {
  return (
    <div className="flex items-center gap-[10px]">
      <KeeplasLogoMark width={36} height={36} />
      <span className="text-h2 text-text-primary">Keeplas</span>
    </div>
  );
}

/**
 * Signed-out desktop layout (W04-1, W04-2, D-01): landscape hero on the left,
 * centred content and the language dropdown on the right. Below `lg` the hero
 * collapses to the brand so the content stays first on small screens.
 */
export function AuthScreen({
  title,
  body,
  heroClassName = "lg:w-[52.8%]",
  children,
}: AuthScreenProps) {
  return (
    <main className="flex min-h-screen flex-1 bg-bg-app">
      <section
        className={cn(
          "relative hidden shrink-0 flex-col overflow-hidden bg-bg-info px-[64px] pt-[48px] lg:flex",
          heroClassName,
        )}
      >
        <Brand />
        <div className="relative z-10 mt-[66px] flex max-w-[560px] flex-col gap-[16px]">
          <h1 className="whitespace-pre-line text-display text-text-primary xl:text-[52px] xl:leading-[58px]">
            {title}
          </h1>
          <p className="text-body-lg text-text-body">{body}</p>
        </div>
        <Illustration
          src="/assets/illustrations/desktop-landscape.svg"
          className="pointer-events-none absolute -bottom-[20px] -left-[40px] w-[calc(100%+80px)] max-w-none dark:hidden"
        />
        <Illustration
          src="/assets/illustrations/desktop-landscape-night.svg"
          className="pointer-events-none absolute -bottom-[20px] -left-[40px] hidden w-[calc(100%+80px)] max-w-none dark:block"
        />
      </section>

      <section className="relative flex flex-1 flex-col items-center justify-center px-[24px] py-[96px]">
        <div className="absolute left-[24px] top-[40px] lg:hidden">
          <Brand />
        </div>
        <div className="absolute right-[24px] top-[40px] lg:right-[59px]">
          <LanguageSwitcher />
        </div>
        {children}
      </section>
    </main>
  );
}
