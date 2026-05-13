"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button } from "@keeplas/ui";
import { AddItemDialog } from "@/components/add-item-dialog";

export function FabAddEntry() {
  const vault = useQuery(api.vaults.getVault);
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (vault === null) {
      getOrCreateVault();
    }
  }, [vault, getOrCreateVault]);

  if (!vault) return null;

  return (
    <>
      <Button
        variant="vault"
        size="icon"
        aria-label="Add new entry"
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-24 md:bottom-6 z-40 h-14 w-14 rounded-full shadow-2xl shadow-primary/30 cursor-pointer"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 5v14M5 12h14"
          />
        </svg>
      </Button>
      <AddItemDialog vaultId={vault._id} open={open} onOpenChange={setOpen} />
    </>
  );
}
