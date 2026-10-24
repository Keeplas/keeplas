import { useState } from "react";

import { Button } from "@/components/button";
import type { IconName } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { IconTile, ListRow } from "@/components/surfaces";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";

export interface OtherOption {
  icon: IconName;
  title: string;
  description?: string;
  onPress: () => void;
}

/**
 * Keeps a getting-in screen to one strong action: a quiet "Other options"
 * link opens a sheet with the screen's fallbacks, then Sign out (explained,
 * since it forgets this phone's vault key).
 */
export function OtherOptions({ options = [] }: { options?: OtherOption[] }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <>
      <Button
        variant="text"
        label={t("otherOptions.title")}
        onPress={() => setOpen(true)}
      />
      <BottomSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        title={t("otherOptions.title")}
      >
        {options.map((option) => (
          <ListRow
            key={option.title}
            icon={option.icon}
            title={option.title}
            description={option.description}
            onPress={choose(option.onPress)}
          />
        ))}
        <ListRow
          leading={
            <IconTile
              icon="revoke"
              color="status.revoked"
              background={colors["status.revoked.bg"]}
            />
          }
          title={t("settings.signOut")}
          description={t("otherOptions.signOutBody")}
          onPress={choose(() => void signOut())}
        />
      </BottomSheet>
    </>
  );
}
