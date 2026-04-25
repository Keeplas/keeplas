"use client";

import { useState } from "react";
import { Button, Icon, Input, Label, cn } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { isValidUrl } from "@/lib/link-payload";

interface VaultLinkInputListProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

export function VaultLinkInputList({ urls, onChange }: VaultLinkInputListProps) {
  const [touched, setTouched] = useState<boolean[]>(() =>
    urls.map(() => false)
  );

  function setUrlAt(index: number, value: string) {
    const next = [...urls];
    next[index] = value;
    onChange(next);
  }

  function markTouched(index: number) {
    setTouched((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }

  function addRow() {
    onChange([...urls, ""]);
    setTouched((prev) => [...prev, false]);
  }

  function removeRow(index: number) {
    const next = urls.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [""]);
    setTouched((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : [false];
    });
  }

  return (
    <div className="space-y-3">
      <Label className="text-label-md text-on-surface-variant">
        Saved links
      </Label>
      <p className="text-body-md text-on-surface-variant">
        URLs are encrypted before they leave your device. Nothing is fetched
        or previewed.
      </p>

      <div className="space-y-2">
        {urls.map((url, index) => {
          const trimmed = url.trim();
          const showError =
            touched[index] && trimmed.length > 0 && !isValidUrl(trimmed);
          return (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => setUrlAt(index, e.target.value)}
                  onBlur={() => markTouched(index)}
                  placeholder="https://example.com/account"
                  className={cn(showError && "border-error")}
                />
                {showError && (
                  <p className="text-label-md text-error">
                    Enter a valid URL (including https://).
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(index)}
                aria-label="Remove link"
                className="mt-1 cursor-pointer text-on-surface-variant hover:text-error"
              >
                <Icon path={ICON_PATHS.close} className="w-4 h-4" strokeWidth={2} />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="gap-2 cursor-pointer"
      >
        <Icon path={ICON_PATHS.plus} className="w-4 h-4" strokeWidth={2} />
        Add another link
      </Button>
    </div>
  );
}
