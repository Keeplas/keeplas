import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import {
  BulletCard,
  Callout,
  ListRow,
  StatusChip,
} from "@/components/surfaces";
import { Text } from "@/components/text";
import { providerName } from "@/features/cloud-backup";
import { PasskeyButton } from "@/features/passkey-step";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import * as CloudKey from "../../../modules/cloud-key";

/**
 * The account's passkeys, shown as active. They can't be removed here: the
 * passkey is how the owner signs in, and on a new phone it comes back with
 * the cloud keychain.
 */
export default function Passkeys() {
  const router = useRouter();
  const { t, language } = useI18n();
  const viewer = useViewer();
  const passkeys = useQuery(api.webauthn.listMyCredentials);
  const account = providerName(CloudKey.provider);

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("privacy.passkey")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("passkeys.subtitle")}
      </Text>
      {passkeys?.length === 0 ? (
        <>
          <Callout
            tone="warning"
            icon="alert-circle"
            text={t("passkeys.none")}
          />
          <PasskeyButton
            userId={viewer._id}
            label={t("passkeys.add")}
            onDone={() => undefined}
          />
        </>
      ) : null}
      {passkeys?.map((passkey) => {
        const date = formatDate(
          passkey.lastUsedAt ?? passkey.createdAt,
          language,
        );
        const used = passkey.lastUsedAt
          ? t("passkeys.lastUsed", { date })
          : t("passkeys.addedOn", { date });
        return (
          <ListRow
            key={passkey._id}
            icon="fingerprint"
            title={passkey.deviceName ?? t("privacy.passkey")}
            description={
              passkey.backedUp
                ? `${t("passkeys.synced", { account })} · ${used}`
                : used
            }
            trailing={<StatusChip tone="success" label={t("oneWay.active")} />}
          />
        );
      })}
      {passkeys?.length ? (
        <>
          <BulletCard
            icon="lock"
            title={t("passkeys.whyTitle")}
            items={[
              t("passkeys.why1"),
              t("passkeys.why2", { account }),
              t("passkeys.why3"),
            ]}
          />
          <Callout icon="info" text={t("passkeys.stop")} />
        </>
      ) : null}
    </Screen>
  );
}
