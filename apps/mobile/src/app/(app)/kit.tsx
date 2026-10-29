import { useState } from "react";
import { useRouter } from "expo-router";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { cloudNames } from "@/features/cloud-backup";
import { isPinAbort } from "@/features/pin/use-pin-gate";
import { KitWords, useCreateKit } from "@/features/recovery-kit";
import { writePreference } from "@/lib/preferences";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";

/**
 * The optional recovery kit, asked for in Settings: new 24 words, shown
 * once (never stored on the phone or the server), to write down or save as
 * a PDF or an image. They replace any previous kit; the cloud backup is
 * re-sealed for them.
 */
export default function KitScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const createKit = useCreateKit();
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      setPhrase(await createKit());
    } catch (error) {
      if (isPinAbort(error)) return;
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function saved() {
    await writePreference("kitExported", "true");
    setPhrase(null);
    router.back();
  }

  return (
    <Screen header={<NavBar title={t("kit.title")} onBack={router.back} />}>
      <Text variant="h1">{t("kit.title")}</Text>
      {phrase ? (
        <>
          <Text variant="body-lg" color="text.muted">
            {t("kit.body")}
          </Text>
          <KitWords phrase={phrase} />
          <Button label={t("kit.saved")} onPress={saved} />
        </>
      ) : (
        <>
          <Text variant="body-lg" color="text.muted">
            {t("kit.intro", cloudNames)}
          </Text>
          <Callout icon="info" text={t("kit.replaces")} />
          <Button label={t("kit.create")} loading={busy} onPress={create} />
        </>
      )}
    </Screen>
  );
}
