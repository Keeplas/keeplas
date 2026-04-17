"use client";

import { Icon, Switch } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import type { ChannelConfig, ChannelType } from "./constants";

interface ChannelListProps {
  channels: ChannelConfig[];
  onToggle: (type: ChannelType) => void;
}

export function ChannelList({ channels, onToggle }: ChannelListProps) {
  const sorted = [...channels].sort((a, b) => a.order - b.order);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-bold font-headline text-primary mb-5 flex items-center gap-2">
        <Icon path={ICON_PATHS.bell} className="w-5 h-5 text-secondary" />
        Verification Channels
      </h3>
      <div className="space-y-4">
        {sorted.map((ch) => (
          <div
            key={ch.type}
            className={`flex items-center justify-between p-3 bg-surface-container-low rounded-xl ${
              ch.isEnabled ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-surface-container-lowest rounded-lg shadow-sm">
                <Icon path={ch.iconPath} className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-primary text-sm">{ch.label}</p>
                <p className="text-xs text-on-surface-variant">
                  {ch.description}
                </p>
              </div>
            </div>
            <Switch
              checked={ch.isEnabled}
              onCheckedChange={() => onToggle(ch.type)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
