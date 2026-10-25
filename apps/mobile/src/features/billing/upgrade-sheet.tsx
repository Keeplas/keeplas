import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { Callout, Card, IconBadge, IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  describePurchaseError,
  getLifetimePrice,
  purchaseLifetime,
  restoreLifetime,
} from "@/features/billing/purchases";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/**
 * Store-localized Lifetime price, fetched while `enabled`. `error` is set
 * when the store has no Lifetime product for this device (or is unreachable).
 */
export function useLifetimePrice(enabled = true): {
  price?: string;
  error?: unknown;
} {
  const viewer = useViewer();
  const [state, setState] = useState<{ price?: string; error?: unknown }>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getLifetimePrice(viewer._id).then(
      (price) => alive && setState({ price }),
      (error: unknown) => alive && setState({ error }),
    );
    return () => {
      alive = false;
    };
  }, [enabled, viewer._id]);
  return state;
}

type Notice = { tone: "danger" | "info"; text: string };

/**
 * Confirmation before buying Lifetime: what the user gets, what it costs and
 * how it is paid, then the store sheet. Shows the store's error in place
 * (with its code) instead of a generic toast, and a confirmation once paid;
 * RevenueCat's webhook then flips the plan and the reactive viewer follows.
 */
export function UpgradeSheet({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const viewer = useViewer();
  const { price, error: priceError } = useLifetimePrice(visible);
  const [pending, setPending] = useState<"pay" | "restore" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [paid, setPaid] = useState(false);
  const os = Platform.OS === "ios" ? "ios" : "android";
  const store = t(`upgrade.store.${os}`);

  const errorNotice = (error: unknown): Notice => {
    const { kind, code } = describePurchaseError(error);
    const text = t(`upgrade.errors.${kind}`, { store });
    return {
      tone: kind === "pending" ? "info" : "danger",
      text: code ? `${text} ${t("upgrade.errorCode", { code })}` : text,
    };
  };
  const shown = notice ?? (priceError ? errorNotice(priceError) : null);

  const run = async (
    action: "pay" | "restore",
    task: (userId: string) => Promise<boolean>,
  ) => {
    setPending(action);
    setNotice(null);
    try {
      if (await task(viewer._id)) setPaid(true);
      else if (action === "restore") {
        setNotice({ tone: "info", text: t("upgrade.nothingToRestore") });
      }
    } catch (error) {
      if (__DEV__) console.warn("[billing]", error);
      setNotice(errorNotice(error));
    } finally {
      setPending(null);
    }
  };

  const close = () => {
    setNotice(null);
    onDismiss();
  };

  if (paid) {
    return (
      <BottomSheet visible={visible} onDismiss={close}>
        <View style={styles.done}>
          <IconBadge icon="shield-check" tone="success" />
          <Text variant="h3" align="center">
            {t("upgrade.paidTitle")}
          </Text>
          <Text variant="body" color="text.muted" align="center">
            {t("upgrade.activating")}
          </Text>
        </View>
        <Button label={t("common.done")} onPress={close} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onDismiss={close} title={t("upgrade.title")}>
      <View style={styles.body}>
        <Card>
          <View style={styles.plan}>
            <IconTile icon="flash" />
            <View style={styles.flex}>
              <Text variant="label">{t("upgrade.planName")}</Text>
              <Text variant="body-sm" color="text.muted">
                {t("upgrade.oneTime")}
              </Text>
            </View>
            <Text variant="h2">{price ?? "—"}</Text>
          </View>
        </Card>
        <View style={styles.perks}>
          {(["storage", "features", "noSubscription", "newPhone"] as const).map(
            (perk) => (
              <View key={perk} style={styles.perk}>
                <Icon name="check" size={18} color="status.active" />
                <Text variant="body" style={styles.flex}>
                  {t(`upgrade.perks.${perk}`)}
                </Text>
              </View>
            ),
          )}
        </View>
        <Callout
          icon="lock"
          tone="neutral"
          text={t("upgrade.paidWith", { account: t(`upgrade.account.${os}`) })}
        />
        {shown ? (
          <Callout
            icon={shown.tone === "danger" ? "alert-circle" : "info"}
            tone={shown.tone}
            text={shown.text}
          />
        ) : null}
        <Button
          label={price ? t("upgrade.pay", { price }) : t("upgrade.payNoPrice")}
          loading={pending === "pay" || (!price && !priceError && visible)}
          disabled={pending === "restore"}
          onPress={() => run("pay", purchaseLifetime)}
        />
        <Button
          variant="text"
          label={t("upgrade.restore")}
          loading={pending === "restore"}
          disabled={pending === "pay"}
          onPress={() => run("restore", restoreLifetime)}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingTop: 6 },
  flex: { flex: 1 },
  plan: { flexDirection: "row", alignItems: "center", gap: 14 },
  perks: { gap: 12 },
  perk: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  done: { alignItems: "center", gap: 12, paddingVertical: 24 },
});
