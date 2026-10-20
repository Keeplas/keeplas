import { memo } from "react";
import { useRouter } from "expo-router";

import type { IconName } from "@/components/icon";
import { ListRow } from "@/components/surfaces";

/**
 * Memoized vault-item row (Home, Search, Folder). Primitive props only and
 * navigation handled inside, so parent re-renders skip every row.
 */
export const VaultItemRow = memo(function VaultItemRow({
  id,
  title,
  description,
  icon = "document",
}: {
  id: string;
  title: string;
  description?: string;
  icon?: IconName;
}) {
  const router = useRouter();
  return (
    <ListRow
      icon={icon}
      title={title}
      description={description}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id } })}
    />
  );
});
