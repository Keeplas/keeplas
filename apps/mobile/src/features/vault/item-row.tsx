import { memo } from "react";
import { useRouter } from "expo-router";

import { ListRow } from "@/components/surfaces";

/**
 * Memoized vault-item row (Home, Search, Folder). Primitive props only and
 * navigation handled inside, so parent re-renders skip every row.
 */
export const VaultItemRow = memo(function VaultItemRow({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  const router = useRouter();
  return (
    <ListRow
      icon="document"
      title={title}
      description={description}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id } })}
    />
  );
});
