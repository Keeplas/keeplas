"use client";

import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { getCategoryConfig, CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { AccessLevel } from "@keeplas/backend/shared-types";
import { Input, Label, ErrorAlert, Spinner } from "@keeplas/ui";

export default function VaultItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as Id<"vault_items">;

  const item = useQuery(api.vault_items.getItem, { itemId });
  const updateItem = useMutation(api.vault_items.updateItem);
  const deleteItem = useMutation(api.vault_items.deleteItem);
  const { decryptContent, encryptContent, computeHash, isReady } = useVaultCrypto();

  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<VaultCategory>("personal_document");
  const [editAccessLevel, setEditAccessLevel] = useState<AccessLevel>("private");
  const [editTags, setEditTags] = useState("");
  const [editCritical, setEditCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Decrypt content when item loads
  useEffect(() => {
    if (item && isReady && !decryptedContent && !decrypting) {
      setDecrypting(true);
      decryptContent(item.encryptedContent)
        .then(setDecryptedContent)
        .catch(() => setDecryptedContent("[Unable to decrypt]"))
        .finally(() => setDecrypting(false));
    }
  }, [item, isReady, decryptedContent, decrypting, decryptContent]);

  // Populate edit form when entering edit mode
  function startEditing() {
    if (!item || decryptedContent === null) return;
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditContent(decryptedContent);
    setEditCategory(item.category);
    setEditAccessLevel(item.accessLevel);
    setEditTags(item.tags.join(", "));
    setEditCritical(item.isCritical);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;
    setSaving(true);
    setError("");

    try {
      const encryptedContent = await encryptContent(editContent);
      const contentHash = await computeHash(editContent);
      const tagList = editTags.split(",").map((t) => t.trim()).filter(Boolean);

      await updateItem({
        itemId,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        encryptedContent,
        contentHash,
        category: editCategory,
        accessLevel: editAccessLevel,
        tags: tagList,
        isCritical: editCritical,
      });

      setDecryptedContent(editContent);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteItem({ itemId });
    router.push("/vault");
  }

  if (item === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <h2 className="font-headline text-2xl font-bold text-primary mb-2">Item not found</h2>
        <button onClick={() => router.push("/vault")} className="text-secondary font-bold cursor-pointer">
          Back to Vault
        </button>
      </div>
    );
  }

  const category = getCategoryConfig(item.category);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/vault")}
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-label font-bold mb-8 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Vault
      </button>

      {editing ? (
        /* ─── Edit Mode ─── */
        <form onSubmit={handleSave} className="space-y-5">
          <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tight mb-6">
            Edit Item
          </h2>

          {error && (
            <ErrorAlert message={error} className="mb-0" />
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as VaultCategory)}
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none cursor-pointer">
              {CATEGORIES.map((cat) => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Secure Content</Label>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} required rows={6}
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none resize-none" />
          </div>

          <div className="space-y-2">
            <Label>Access Level</Label>
            <select value={editAccessLevel} onChange={(e) => setEditAccessLevel(e.target.value as AccessLevel)}
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none cursor-pointer">
              <option value="private">Private — Only you</option>
              <option value="trusted_only">Trusted Contacts</option>
              <option value="emergency_only">Emergency Only</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <Input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={editCritical} onChange={(e) => setEditCritical(e.target.checked)}
              className="w-5 h-5 rounded-lg border-2 border-outline-variant/30 text-secondary accent-secondary cursor-pointer" />
            <span className="text-sm font-body font-medium text-on-surface">Mark as critical</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)}
              className="flex-1 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl font-label font-bold text-sm text-on-surface transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 vault-gradient text-on-primary py-3 rounded-xl font-headline font-bold text-sm shadow-lg disabled:opacity-40 cursor-pointer">
              {saving ? "Encrypting..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        /* ─── View Mode ─── */
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
                </svg>
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                  {category.label}
                </span>
                {item.isCritical && (
                  <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-primary bg-primary-container px-2 py-0.5 rounded-lg">
                    Critical
                  </span>
                )}
              </div>
              <h1 className="font-headline text-3xl font-extrabold text-primary tracking-tight">
                {item.title}
              </h1>
              {item.description && (
                <p className="text-on-surface-variant mt-1">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={startEditing}
                className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer" title="Edit">
                <svg className="w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-error-container rounded-xl transition-colors cursor-pointer" title="Archive">
                <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m5.25 0V5.625c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V7.5m-9 0h13.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="text-[11px] font-label font-bold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-lg">
              {item.accessLevel === "private" ? "Private" : item.accessLevel === "trusted_only" ? "Trusted Only" : item.accessLevel === "emergency_only" ? "Emergency Only" : "Public"}
            </span>
            {item.tags.map((tag) => (
              <span key={tag} className="text-[11px] font-label font-bold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-lg">
                {tag}
              </span>
            ))}
          </div>

          {/* Decrypted Content */}
          <div className="bg-surface-container-low rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary">
                Decrypted Content
              </span>
            </div>
            {decrypting ? (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Spinner size="sm" />
                Decrypting...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-on-surface font-body leading-relaxed">
                {decryptedContent}
              </pre>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-[11px] text-outline-variant">
            Created {new Date(item.createdAt).toLocaleDateString()} · Updated {new Date(item.updatedAt).toLocaleDateString()}
          </p>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
              <div className="relative bg-surface rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
                <h3 className="font-headline text-xl font-bold text-primary mb-2">Archive this item?</h3>
                <p className="text-sm text-on-surface-variant mb-6">
                  This item will be archived and removed from your active vault. You can restore it later.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl font-label font-bold text-sm cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={handleDelete}
                    className="flex-1 py-3 bg-error text-on-error rounded-xl font-label font-bold text-sm cursor-pointer">
                    Archive
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
