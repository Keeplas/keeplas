"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  HelpHint,
  Icon,
  Switch,
  type CountryCode,
} from "@keeplas/ui";
import { PhoneVerificationDialog } from "@/components/phone-verification-dialog";
import { ICON_PATHS } from "@/lib/icons";
import type { ChannelConfig, ChannelType } from "./constants";

interface ChannelListProps {
  channels: ChannelConfig[];
  onToggle: (type: ChannelType) => void;
  phoneNumber?: string;
  defaultCountry?: CountryCode;
}

export function ChannelList({
  channels,
  onToggle,
  phoneNumber,
  defaultCountry,
}: ChannelListProps) {
  const sorted = [...channels].sort((a, b) => a.order - b.order);
  const [verifyOpen, setVerifyOpen] = useState(false);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
      <h3 className="text-headline-sm text-primary mb-5 flex items-center gap-2">
        <Icon path={ICON_PATHS.bell} className="w-5 h-5 text-secondary" />
        Check-in channels
        <HelpHint content="Channels Keeplas uses to reach you for a check-in — all sent together, not in sequence. Disable any you don't have. Note: only the email button and a WhatsApp reply can confirm you're well." />
      </h3>
      <div className="space-y-4">
        {sorted.map((ch) => {
          const isUnverified = !ch.isUpcoming && ch.isVerified === false;
          // Highlight (no dimming) channels that need action; dim only the
          // upcoming and the verified-but-disabled ones.
          const dimmed = !isUnverified && !ch.isEnabled;
          return (
            <div
              key={ch.type}
              className={`flex items-center justify-between p-3 bg-surface-container-low rounded-xl ${
                dimmed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-surface-container-lowest rounded-lg shadow-sm">
                  <Icon path={ch.iconPath} className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-body-md font-bold text-primary">
                      {ch.label}
                    </p>
                    {ch.isUpcoming && (
                      <Badge variant="outline">Coming soon</Badge>
                    )}
                    {isUnverified && (
                      <Badge variant="outline">Not verified</Badge>
                    )}
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    {ch.description}
                  </p>
                </div>
              </div>
              {isUnverified ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVerifyOpen(true)}
                >
                  Verify
                </Button>
              ) : (
                <Switch
                  checked={ch.isUpcoming ? false : ch.isEnabled}
                  disabled={ch.isUpcoming}
                  onCheckedChange={() => onToggle(ch.type)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Only WhatsApp gates on contact verification today (phone ownership via
          OTP); email is verified at login. */}
      <PhoneVerificationDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        initialPhone={phoneNumber}
        defaultCountry={defaultCountry}
      />
    </section>
  );
}
