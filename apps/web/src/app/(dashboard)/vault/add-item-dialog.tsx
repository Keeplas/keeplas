"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import type { Id } from "@keeplas/backend/_generated/dataModel";

interface AddItemDialogProps {
  vaultId: Id<"vaults">;
  onClose: () => void;
  defaultCategory?: VaultCategory;
}

type AccessLevel = "private" | "trusted_only" | "emergency_only" | "public";

export function AddItemDialog({ vaultId, onClose, defaultCategory }: AddItemDialogProps) {
  const createItem = useMutation(api.vault_items.createItem);
  const { encryptContent, computeHash, isReady } = useVaultCrypto();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VaultCategory>(defaultCategory ?? "personal_document");
  const [content, setContent] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("private");
  const [tags, setTags] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) {
      setError("Encryption key not available. Please sign in again.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const encryptedContent = await encryptContent(content);
      const contentHash = await computeHash(content);
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await createItem({
        vaultId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        encryptedContent,
        contentHash,
        accessLevel,
        tags: tagList,
        isCritical,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface p-6 pb-4 border-b border-outline-variant/10 flex items-center justify-between">
          <div>
            <h2 className="font-headline text-xl font-extrabold text-primary tracking-tight">
              Add to Vault
            </h2>
            <p className="text-sm text-on-surface-variant">
              Content is encrypted on your device before storage.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Bank account, Passport, Will..."
              required
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VaultCategory)}
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1">
              Description
              <span className="text-outline-variant ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1">
              Secure Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the sensitive information you want to protect..."
              required
              rows={5}
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none resize-none"
            />
            <p className="text-[11px] text-outline-variant ml-1">
              This content will be encrypted with AES-256-GCM before leaving your device.
            </p>
          </div>

          {/* Access Level */}
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1">
              Access Level
            </label>
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none cursor-pointer"
            >
              <option value="private">Private — Only you</option>
              <option value="trusted_only">Trusted Contacts — Shared with approved contacts</option>
              <option value="emergency_only">Emergency Only — Post-mortem access</option>
              <option value="public">Public — Visible on Emergency Card</option>
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1">
              Tags
              <span className="text-outline-variant ml-1">(comma separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., urgent, family, financial..."
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none"
            />
          </div>

          {/* Critical Toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="w-5 h-5 rounded-lg border-2 border-outline-variant/30 text-secondary focus:ring-secondary/20 focus:ring-offset-0 accent-secondary cursor-pointer"
            />
            <div>
              <span className="text-sm font-body font-medium text-on-surface">
                Mark as critical
              </span>
              <p className="text-[11px] text-on-surface-variant">
                Critical items are prioritized during emergency access.
              </p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl font-label font-bold text-sm text-on-surface transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isReady}
              className="flex-1 vault-gradient text-on-primary py-3 px-4 rounded-xl font-headline font-bold text-sm shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {saving ? "Encrypting..." : "Encrypt & Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
