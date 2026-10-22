import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { toast } from "@keeplas/ui";
import { AddItemDialog } from "@/components/add-item-dialog";
import { useTranslations } from "@/lib/i18n";
import type { VaultCategory } from "@/lib/vault-categories";
import type { AddKind } from "./add-item-menu";

// Where each "Add item" kind starts: documents and photos as documents, the
// rest as Other.
const KIND_CATEGORY: Record<AddKind, VaultCategory> = {
  document: "personal_document",
  photo: "personal_document",
  note: "other",
  voice: "other",
  video: "other",
};

/**
 * Adding to the vault from the dashboard and the vault list: the "Add item"
 * kinds, files picked or dropped, and scanning with the phone. Returns the
 * handlers and the dialogs to render.
 */
export function useVaultCapture() {
  const t = useTranslations("hub.add");
  const vault = useQuery(api.vaults.getVault);
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const [adding, setAdding] = useState<VaultCategory | null>(null);

  useEffect(() => {
    if (vault === null) void getOrCreateVault();
  }, [vault, getOrCreateVault]);

  return {
    add: (kind: AddKind) => setAdding(KIND_CATEGORY[kind]),
    files: (_files: File[]) => setAdding("personal_document"),
    scan: () =>
      toast({ title: t("scan.title"), description: t("scan.onPhone") }),
    dialogs: vault ? (
      <AddItemDialog
        vaultId={vault._id}
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        defaultCategory={adding ?? undefined}
      />
    ) : null,
  };
}
