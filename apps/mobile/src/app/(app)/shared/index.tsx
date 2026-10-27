import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { StateMessage, StateSheet } from "@/components/state-message";
import { IconTile, InfoRow, ListRow, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { VaultSwitch } from "@/features/vault/vault-switch";
import { serverMessage } from "@/lib/errors";
import { formatPhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

type SharedVault = FunctionReturnType<
  typeof api.trusted_contacts.getVaultsWhereIAmContact
>[number];

/** How a vault opens to a trusted contact, in order (help sheet). */
const RELEASE_STEPS = [
  { icon: "activity", key: "checkIn" },
  { icon: "bell", key: "silent" },
  { icon: "people", key: "confirm" },
  { icon: "clock", key: "grace" },
  { icon: "eye", key: "yours" },
] as const;

/**
 * Who chose me: their name and phone, so a homonym or a first name alone is
 * still recognisable. A nameless owner is named by their phone (backend
 * fallback), shown once.
 */
function OwnerIdentity({
  name,
  phone,
  detail,
}: {
  name: string;
  phone: string | null;
  detail?: string;
}) {
  return (
    <View style={styles.text}>
      <Text variant="label">{formatPhone(name)}</Text>
      {phone && phone !== name ? (
        <Text variant="body-sm" color="text.muted">
          {formatPhone(phone)}
        </Text>
      ) : null}
      {detail ? (
        <Text variant="body-sm" color="text.muted">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A vault not released to me. While the owner's Life check waits for their
 * trusted contacts, I can confirm I can't reach them either (once).
 */
function LockedVaultCard({
  vault,
  onUnreachable,
}: {
  vault: SharedVault;
  onUnreachable: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const name = formatPhone(vault.ownerName);
  const n = vault.confirmationThreshold;
  const actionNeeded =
    vault.ownerCycleStatus === "awaiting_confirmation" &&
    !vault.unreachableConfirmed;

  let detail = t("shared.trusted");
  let body =
    n === 1 ? t("shared.laterOne", { name }) : t("shared.later", { name, n });
  if (actionNeeded) {
    detail = t("shared.unreachable.detail");
    body = t("shared.unreachable.body", { n });
  } else if (vault.unreachableConfirmed) {
    detail = t("shared.unreachable.confirmed");
    body = t("shared.unreachable.waiting", { name });
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            colors[actionNeeded ? "status.pending.bg" : "bg.warm"],
        },
      ]}
    >
      <View style={styles.row}>
        {actionNeeded ? (
          <IconTile
            icon="alert-triangle"
            size={44}
            background={colors["bg.surface"]}
            color="status.pending"
          />
        ) : (
          <IconTile icon="lock" size={44} background={colors["bg.subtle"]} />
        )}
        <OwnerIdentity
          name={vault.ownerName}
          phone={vault.ownerPhone}
          detail={detail}
        />
      </View>
      <Text variant="body-sm" color="text.muted">
        {body}
      </Text>
      {actionNeeded ? (
        <Button
          label={t("shared.unreachable.action")}
          onPress={onUnreachable}
        />
      ) : null}
    </View>
  );
}

/**
 * M03-1 Shared with me: the people who chose me as a trusted contact. What
 * they left me opens once their vault is released to me.
 */
export default function SharedWithMe() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  const [helpOpen, setHelpOpen] = useState(false);
  // Kept after closing so the sheet keeps its title while it slides out.
  const [confirming, setConfirming] = useState<SharedVault | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const markUnreachable = useAuditedMutation(
    api.access_requests.markUserUnreachable,
  );

  async function confirmUnreachable(vault: SharedVault) {
    setConfirmOpen(false);
    try {
      await markUnreachable({ contactId: vault._id });
      toast({ variant: "success", title: t("shared.unreachable.done") });
    } catch (error) {
      toast({
        variant: "error",
        title: t("common.genericError"),
        description: serverMessage(error),
      });
    }
  }

  const open = (contactId: Id<"trusted_contacts">) =>
    router.push({ pathname: "/shared/[contactId]", params: { contactId } });

  return (
    <Screen header={<AppHeader right={<LanguageDropdown />} />} gap={14}>
      <Text variant="h1">{t("shared.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("shared.body")}
      </Text>
      <VaultSwitch active="shared" />
      {vaults?.length === 0 ? (
        <StateMessage
          icon="inbox"
          tone="info"
          title={t("shared.emptyTitle")}
          body={t("shared.emptyBody")}
        />
      ) : null}
      {(vaults ?? []).map((vault) =>
        vault.released ? (
          <View
            key={vault._id}
            style={[
              styles.card,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => open(vault._id)}
              style={styles.row}
            >
              <IconTile icon="folder" size={44} />
              <OwnerIdentity
                name={vault.ownerName}
                phone={vault.ownerPhone}
                detail={
                  vault.releasedItemCount === 1
                    ? t("shared.oneItem")
                    : t("shared.items", { n: vault.releasedItemCount })
                }
              />
              <Icon name="chevron-right" size={20} color="text.muted" />
            </Pressable>
            <Button
              label={t("shared.accessNow")}
              onPress={() => open(vault._id)}
            />
          </View>
        ) : (
          <LockedVaultCard
            key={vault._id}
            vault={vault}
            onUnreachable={() => {
              setConfirming(vault);
              setConfirmOpen(true);
            }}
          />
        ),
      )}
      <ListRow
        icon="help"
        title={t("shared.help.link")}
        onPress={() => setHelpOpen(true)}
      />
      <BottomSheet
        visible={helpOpen}
        onDismiss={() => setHelpOpen(false)}
        title={t("shared.help.title")}
      >
        <View style={styles.steps}>
          {RELEASE_STEPS.map((step) => (
            <InfoRow
              key={step.key}
              leading={<IconTile icon={step.icon} size={36} iconSize={20} />}
              title={t(`shared.help.${step.key}`)}
              description={t(`shared.help.${step.key}Body`)}
            />
          ))}
        </View>
        <Note icon="lock" text={t("shared.help.note")} />
      </BottomSheet>
      <StateSheet
        visible={confirmOpen}
        onDismiss={() => setConfirmOpen(false)}
        icon="alert-triangle"
        tone="warning"
        title={t("shared.unreachable.confirmTitle", {
          name: formatPhone(confirming?.ownerName ?? ""),
        })}
        body={t("shared.unreachable.confirmBody")}
        primary={{
          label: t("shared.unreachable.confirm"),
          onPress: () => confirming && void confirmUnreachable(confirming),
        }}
        secondary={{
          label: t("common.cancel"),
          onPress: () => setConfirmOpen(false),
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  steps: { gap: 16, paddingVertical: 6 },
});
