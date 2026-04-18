"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Button, Input, Label, UserAvatar } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { getInitials } from "@/lib/user";

interface IdentitySectionProps {
  user: Doc<"users">;
  onError: (message: string) => void;
}

export function IdentitySection({ user, onError }: IdentitySectionProps) {
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phoneNumber ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user.name ?? "");
    setPhone(user.phoneNumber ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    setSaved(false);
    try {
      await updateProfile({ name, phoneNumber: phone, avatarUrl });
      setSaved(true);
    } catch (err) {
      onError(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  }

  const initials = getInitials(user.name || user.email);

  const curatorSince = user._creationTime
    ? new Date(user._creationTime).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  return (
    <section>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-6"
      >
        <div className="col-span-full bg-surface-container-low rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <UserAvatar
            size="xl"
            imageUrl={avatarUrl || null}
            initials={initials}
            alt={name || "Profile"}
            imageClassName="shadow-xl border-4 border-surface"
            className="shadow-xl border-4 border-surface"
            onImageError={() => setAvatarUrl("")}
          />
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-headline text-lg font-bold text-primary truncate">
              {name || "Unnamed Curator"}
            </h3>
            <p className="text-xs text-on-surface-variant truncate">
              Curator since {curatorSince}
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                Verified Identity
              </span>
              {user.recoveryVerified && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline uppercase tracking-wider bg-primary-container text-on-primary-container">
                  Recovery Set
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
          <Label
            htmlFor="display-name"
            className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline"
          >
            Display Name
          </Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
          <Label
            htmlFor="email"
            className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline"
          >
            Primary Email
          </Label>
          <Input
            id="email"
            type="email"
            value={user.email ?? ""}
            disabled
            className="opacity-70"
          />
          <p className="text-[10px] text-on-surface-variant mt-1">
            Managed by your auth provider
          </p>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
          <Label
            htmlFor="phone"
            className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline"
          >
            Phone Number
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
          <Label
            htmlFor="avatar"
            className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline"
          >
            Avatar URL
          </Label>
          <Input
            id="avatar"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="col-span-full flex items-center justify-start gap-4">
          {saved && (
            <span className="text-xs text-secondary font-medium">
              Profile updated ✓
            </span>
          )}
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Saving..." : "Save Identity"}
          </Button>
        </div>
      </form>
    </section>
  );
}
