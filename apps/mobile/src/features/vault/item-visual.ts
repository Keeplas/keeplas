import type { IconName } from "@/components/icon";
import { bucketOf, type ContentKind } from "@/features/home/vault-groups";
import { colors as palette } from "@/theme";
import type { VaultItemSummary } from "./vault-data";

export type ItemStyle = ContentKind | "accounts" | "instructions";

const VISUAL: Record<ItemStyle, { icon: IconName; color: string }> = {
  documents: { icon: "document", color: palette.category.document },
  accounts: { icon: "user-circle", color: palette.category.account },
  instructions: { icon: "document", color: palette.category.instruction },
  notes: { icon: "note", color: palette.category.note },
  photos: { icon: "photo", color: palette.category.other },
  voice: { icon: "mic", color: palette.category.note },
  videos: { icon: "video", color: palette.category.other },
};

export function styleOf(item: VaultItemSummary): ItemStyle {
  const bucket = bucketOf(item);
  return bucket === "inbox" ? item.kind : bucket;
}

export function itemVisual(item: VaultItemSummary): {
  icon: IconName;
  color: string;
} {
  const visual = VISUAL[styleOf(item)];
  return { icon: item.icon ?? visual.icon, color: visual.color };
}
