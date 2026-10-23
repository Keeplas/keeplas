import { useState } from "react";
import { Button, cn, HelpHint, Switch, type CountryCode } from "@keeplas/ui";
import { PhoneVerificationDialog } from "@/components/phone-verification-dialog";
import { IconTile, Panel, RowText, StatusChip } from "@/components/v2/surface";
import { useTranslations } from "@/lib/i18n";
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
    <Panel className="flex flex-col gap-[16px] p-[20px]">
      <h2 className="flex items-center gap-[8px] text-h3 text-text-primary">
        {t("channels.title")}
        <HelpHint content={t("channels.help")} />
      </h2>
      <div className="flex flex-col gap-[16px]">
        {sorted.map((ch) => {
          const isUnverified = !ch.isUpcoming && ch.isVerified === false;
          // Highlight (no dimming) channels that need action; dim only the
          // upcoming and the verified-but-disabled ones.
          const dimmed = !isUnverified && !ch.isEnabled;
          return (
            <div
              key={ch.type}
              className={cn(
                "flex items-center gap-[12px]",
                dimmed && "opacity-60",
              )}
            >
              <IconTile
                icon={ch.iconPath}
                size={40}
                className="bg-bg-info text-text-link"
              />
              <RowText
                title={
                  <span className="flex flex-wrap items-center gap-[8px]">
                    {t(`channels.items.${ch.type}.label`)}
                    {ch.isUpcoming && (
                      <StatusChip
                        tone="neutral"
                        label={t("channels.comingSoon")}
                      />
                    )}
                    {isUnverified && (
                      <StatusChip
                        tone="pending"
                        label={
                          ch.type === "whatsapp"
                            ? t("channels.notVerified")
                            : t("channels.noEmail")
                        }
                      />
                    )}
                  </span>
                }
                description={
                  isUnverified && ch.type === "email"
                    ? t("channels.noEmailLinked")
                    : t(`channels.items.${ch.type}.description`)
                }
              />
              {isUnverified ? (
                // WhatsApp self-verifies via phone OTP, so offer that flow.
                // Email has no in-app verify step (the auth provider sets it at
                // login), so just show it locked off until an address exists.
                ch.type === "whatsapp" ? (
                  <Button
                    variant="bordered"
                    size="regular"
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
                  aria-label={t(`channels.items.${ch.type}.label`)}
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
    </Panel>
  );
}
