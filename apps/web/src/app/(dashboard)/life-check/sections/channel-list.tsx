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
import { useTranslations } from "@/lib/i18n";
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
  const t = useTranslations("lifeCheck");
  const sorted = [...channels].sort((a, b) => a.order - b.order);
  const [verifyOpen, setVerifyOpen] = useState(false);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
      <h3 className="text-headline-sm text-primary mb-5 flex items-center gap-2">
        <Icon path={ICON_PATHS.bell} className="w-5 h-5 text-secondary" />
        {t("channels.title")}
        <HelpHint content={t("channels.help")} />
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
                      {t(`channels.items.${ch.type}.label`)}
                    </p>
                    {ch.isUpcoming && (
                      <Badge variant="outline">
                        {t("channels.comingSoon")}
                      </Badge>
                    )}
                    {isUnverified && (
                      <Badge variant="outline">
                        {ch.type === "whatsapp"
                          ? t("channels.notVerified")
                          : t("channels.noEmail")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    {isUnverified && ch.type === "email"
                      ? t("channels.noEmailLinked")
                      : t(`channels.items.${ch.type}.description`)}
                  </p>
                </div>
              </div>
              {isUnverified ? (
                // WhatsApp self-verifies via phone OTP, so offer that flow.
                // Email has no in-app verify step (the auth provider sets it at
                // login), so just show it locked off until an address exists.
                ch.type === "whatsapp" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVerifyOpen(true)}
                  >
                    {t("channels.verify")}
                  </Button>
                ) : (
                  <Switch checked={false} disabled />
                )
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

      {/* WhatsApp is the only channel with an in-app verify flow (phone
          ownership via OTP). Email gates on a verified address too, but that is
          set by the auth provider at login — there is no dialog for it here. */}
      <PhoneVerificationDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        initialPhone={phoneNumber}
        defaultCountry={defaultCountry}
      />
    </section>
  );
}
