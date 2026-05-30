"use client";

import { useState } from "react";
import { Button, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

interface VaultLinkListProps {
  urls: string[];
}

// Fixed-width mask — does not encode the URL length so we don't leak it.
const MASK = "••••••••••••••••••••";

export function VaultLinkList({ urls }: VaultLinkListProps) {
  const t = useTranslations("vault");
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    urls.map(() => false),
  );

  function toggleAt(index: number) {
    setRevealed((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  function openAt(index: number) {
    const url = urls[index];
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (urls.length === 0) {
    return (
      <p className="text-body-md text-on-surface-variant">{t("links.empty")}</p>
    );
  }

  return (
    <ul className="space-y-2">
      {urls.map((url, index) => {
        const isRevealed = revealed[index];
        return (
          <li
            key={index}
            className="flex items-center gap-3 bg-surface rounded-xl px-3 py-2"
          >
            {/* Render as <span>, never <a href>. Anchors get prefetched and
                preview the URL on hover, which would leak the secret. */}
            <span
              className="flex-1 text-sm text-on-surface font-mono break-all min-w-0"
              aria-label={
                isRevealed ? t("links.urlLabel") : t("links.hiddenLabel")
              }
            >
              {isRevealed ? url : MASK}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleAt(index)}
              aria-label={isRevealed ? t("links.hide") : t("links.reveal")}
              className="shrink-0 cursor-pointer text-on-surface-variant hover:text-primary"
            >
              <Icon
                path={
                  isRevealed ? ICON_PATHS.visibilityOff : ICON_PATHS.visibility
                }
                className="w-4 h-4"
                strokeWidth={1.75}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openAt(index)}
              aria-label={t("links.openNewTab")}
              className="shrink-0 cursor-pointer text-on-surface-variant hover:text-primary"
            >
              <Icon
                path={ICON_PATHS.openInNew}
                className="w-4 h-4"
                strokeWidth={1.75}
              />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
