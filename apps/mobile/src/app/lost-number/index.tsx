import { useState } from "react";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { ListRow, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { readClaim } from "@/lib/lost-number";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Lost the account's number: with the 24 words, change it right away;
 * without them, a request support checks over 72 h. Either way the vault
 * opens afterwards with the cloud backup, the words or two contacts.
 */
export default function LostNumber() {
  const router = useRouter();
  const { t } = useI18n();
  const [claim] = useState(readClaim);

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
      gap={12}
    >
      <Text variant="h1">{t("lostNumber.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("lostNumber.body")}
      </Text>
      {claim ? (
        <ListRow
          icon="clock"
          title={t("lostNumber.seeRequest")}
          description={t("lostNumber.seeRequestBody")}
          onPress={() => router.push("/lost-number/status")}
        />
      ) : null}
      <ListRow
        icon="lifebuoy"
        title={t("lostNumber.withKit")}
        description={t("lostNumber.withKitBody")}
        onPress={() => router.push("/lost-number/kit")}
      />
      <ListRow
        icon="people"
        title={t("lostNumber.withSupport")}
        description={t("lostNumber.withSupportBody")}
        onPress={() => router.push("/lost-number/request")}
      />
      <ListRow
        icon="help"
        title={t("help.title")}
        description={t("help.rowBody")}
        onPress={() => router.push("/help")}
      />
      <Note icon="shield-check" text={t("lostNumber.note")} />
    </Screen>
  );
}
