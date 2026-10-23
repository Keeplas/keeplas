import { useState } from "react";
import { Linking } from "react-native";
import { useAction } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { Card, IconTile, InfoRow } from "@/components/surfaces";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Free-plan prompt to buy Lifetime. Opens the hosted Stripe Checkout in the
 * browser; the plan flips when Stripe's webhook lands and the reactive viewer
 * query hides this card.
 */
export function UpgradeCard() {
  const { t } = useI18n();
  const createCheckout = useAction(api.billing.createCheckoutSession);
  const [loading, setLoading] = useState(false);

  const upgrade = async () => {
    setLoading(true);
    try {
      const { url } = await createCheckout({});
      await Linking.openURL(url);
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <InfoRow
        leading={<IconTile icon="flash" />}
        title={t("upgrade.title")}
        description={t("upgrade.body")}
      />
      <Button label={t("upgrade.cta")} loading={loading} onPress={upgrade} />
    </Card>
  );
}
