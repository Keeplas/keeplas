import { Button } from "@keeplas/ui";
import { IconTile, RowText } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

interface ActiveCycleBannerProps {
  status: string;
  onValidate: () => void;
  onPostpone: (duration: "48h" | "7d") => void;
}

/** A check-in is waiting for an answer: confirm now or postpone. */
export function ActiveCycleBanner({
  status,
  onValidate,
  onPostpone,
}: ActiveCycleBannerProps) {
  const t = useTranslations("lifeCheck.activeCycle");
  return (
    <section className="flex flex-wrap items-center gap-[14px] rounded-[16px] bg-bg-pending p-[20px]">
      <IconTile
        icon={ICON_PATHS.bell}
        className="bg-bg-surface text-text-pending"
      />
      <RowText
        className="min-w-[240px]"
        title={t("title")}
        description={
          status === "running"
            ? t("runningDescription")
            : t("escalatingDescription")
        }
      />
      <div className="flex gap-[12px]">
        <Button
          variant="bordered"
          size="regular"
          onClick={() => onPostpone("48h")}
        >
          {t("postpone48h")}
        </Button>
        <Button variant="primary" size="regular" onClick={onValidate}>
          {t("imWell")}
        </Button>
      </div>
    </section>
  );
}
