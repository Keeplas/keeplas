"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "@/lib/i18n";

interface AuthHeroSectionProps {
  decoration?: ReactNode;
}

export function AuthHeroSection({ decoration }: AuthHeroSectionProps = {}) {
  const t = useTranslations("auth.hero");
  return (
    <section className="hidden md:flex w-1/2 vault-gradient relative overflow-hidden flex-col justify-between p-10 lg:p-12 xl:p-16">
      {/* Decorative grain texture */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#ffffff 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top: Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={36}
            height={36}
          />
          <h1 className="text-headline-lg text-surface-container-lowest">
            Keeplas
          </h1>
        </div>
      </div>

      {/* Center: Hero text */}
      <div className="relative z-10 max-w-lg">
        <span className="text-label-md text-secondary-fixed mb-4 block">
          {t("eyebrow")}
        </span>
        <h2 className="text-display-md xl:text-display-lg text-surface-container-lowest mb-6">
          {t("titleLine1")} <br />
          {t("titleLine2")}
        </h2>
        <p className="text-body-md xl:text-body-lg text-on-primary-container font-light">
          {t("body")}
        </p>
      </div>

      {/* Bottom: Stats */}
      <div className="relative z-10 flex flex-wrap gap-x-10 gap-y-5 items-center">
        <div className="flex flex-col">
          <span className="text-headline-md text-surface-container-lowest">
            AES-256
          </span>
          <span className="text-label-md text-on-primary-container">
            {t("encryptionStandard")}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-headline-md text-surface-container-lowest">
            Zero-Knowledge
          </span>
          <span className="text-label-md text-on-primary-container">
            {t("architecture")}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-headline-md text-surface-container-lowest">
            ML-KEM-768
          </span>
          <span className="text-label-md text-on-primary-container">
            {t("quantumSafe")}
          </span>
        </div>
      </div>

      {/* Background blur */}
      <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] opacity-10 blur-3xl rounded-full bg-secondary-fixed pointer-events-none" />

      {decoration}
    </section>
  );
}
