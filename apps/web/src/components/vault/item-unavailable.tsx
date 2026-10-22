import { Button } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";

/** An item that is gone, or whose key doesn't open it in this browser. */
export function ItemUnavailable({ missing }: { missing: boolean }) {
  const t = useTranslations("vaultItem");
  const router = useRouter();
  const state = missing ? "missing" : "locked";
  return (
    <div className="flex justify-center pt-[80px]">
      <StateMessage
        icon={ICON_PATHS.alertTriangle}
        title={t(`${state}.title`)}
        body={t(`${state}.body`)}
      >
        <Button
          variant="primary"
          size="cta"
          className="w-full"
          onClick={() => router.push("/vault")}
        >
          {t("backToVault")}
        </Button>
      </StateMessage>
    </div>
  );
}
