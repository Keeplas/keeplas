import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { runSelfTest, type SelfTestResult } from "@/crypto/self-test";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Development only: runs the crypto self-test on this device (native
 * Argon2id, quick-crypto AES-GCM, @noble post-quantum on Hermes).
 */
export default function SelfTest() {
  const router = useRouter();
  const { t } = useI18n();
  const [results, setResults] = useState<SelfTestResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  // `keeplas://self-test?autorun=1` runs on open (simulator scripting).
  const { autorun } = useLocalSearchParams<{ autorun?: string }>();
  useEffect(() => {
    if (autorun) runSelfTest().then(setResults);
  }, [autorun]);

  async function run() {
    setBusy(true);
    setResults(await runSelfTest());
    setBusy(false);
  }

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("selfTest.title")}</Text>
      <Text variant="body" color="text.muted">
        {t("selfTest.body")}
      </Text>
      <Button label={t("selfTest.run")} loading={busy} onPress={run} />
      {results?.map((r) => (
        <ListRow
          key={r.name}
          icon={r.ok ? "check-circle" : "alert-circle"}
          title={r.name}
          description={r.detail ? `${r.detail} · ${r.ms} ms` : `${r.ms} ms`}
          trailing={
            <StatusChip
              tone={r.ok ? "success" : "danger"}
              label={t(r.ok ? "selfTest.pass" : "selfTest.fail")}
            />
          }
        />
      ))}
    </Screen>
  );
}
