import { useState } from "react";

import { Button } from "@/components/button";
import { Card, IconTile, InfoRow } from "@/components/surfaces";
import {
  UpgradeSheet,
  useLifetimePrice,
} from "@/features/billing/upgrade-sheet";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Free-plan prompt to buy Lifetime through the App Store / Google Play
 * (RevenueCat), priced in the store's local currency. Upgrade opens the
 * confirmation sheet; the card disappears once RevenueCat's webhook flips the
 * plan and the reactive viewer query updates.
 */
export function UpgradeCard() {
  const { t } = useI18n();
  const { price } = useLifetimePrice();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <InfoRow
        leading={<IconTile icon="flash" />}
        title={
          price ? t("upgrade.titleWithPrice", { price }) : t("upgrade.title")
        }
        description={t("upgrade.body")}
      />
      <Button label={t("upgrade.cta")} onPress={() => setOpen(true)} />
      <UpgradeSheet visible={open} onDismiss={() => setOpen(false)} />
    </Card>
  );
}
