import { useEffect, useState } from "react";

import { Button } from "@/components/button";
import { Card, IconTile, InfoRow } from "@/components/surfaces";
import {
  getLifetimePrice,
  purchaseLifetime,
  restoreLifetime,
} from "@/features/billing/purchases";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/**
 * Free-plan prompt to buy Lifetime through the App Store / Google Play
 * (RevenueCat), priced in the store's local currency. After a successful
 * purchase or restore the card switches to an "activating" notice until
 * RevenueCat's webhook flips the plan and the reactive viewer query hides it.
 */
export function UpgradeCard() {
  const { t } = useI18n();
  const viewer = useViewer();
  const [price, setPrice] = useState<string | null>(null);
  const [pending, setPending] = useState<"upgrade" | "restore" | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    // Without a price (store unreachable, no product) the title stays generic.
    getLifetimePrice(viewer._id).then(setPrice, () => setPrice(null));
  }, [viewer._id]);

  const run = async (
    action: "upgrade" | "restore",
    task: (userId: string) => Promise<boolean>,
  ) => {
    setPending(action);
    try {
      if (await task(viewer._id)) {
        setActivating(true);
      } else if (action === "restore") {
        toast({ variant: "info", title: t("upgrade.nothingToRestore") });
      }
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setPending(null);
    }
  };

  const title = price
    ? t("upgrade.titleWithPrice", { price })
    : t("upgrade.title");

  if (activating) {
    return (
      <Card>
        <InfoRow
          leading={<IconTile icon="flash" />}
          title={title}
          description={t("upgrade.activating")}
        />
      </Card>
    );
  }

  return (
    <Card>
      <InfoRow
        leading={<IconTile icon="flash" />}
        title={title}
        description={t("upgrade.body")}
      />
      <Button
        label={t("upgrade.cta")}
        loading={pending === "upgrade"}
        disabled={pending === "restore"}
        onPress={() => run("upgrade", purchaseLifetime)}
      />
      <Button
        variant="text"
        label={t("upgrade.restore")}
        loading={pending === "restore"}
        disabled={pending === "upgrade"}
        onPress={() => run("restore", restoreLifetime)}
      />
    </Card>
  );
}
