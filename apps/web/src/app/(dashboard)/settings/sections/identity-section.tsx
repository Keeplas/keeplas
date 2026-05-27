"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import type { StorageRef } from "@keeplas/backend/lib/storage";
import {
  Button,
  Icon,
  Input,
  Label,
  UserAvatar,
  type CountryCode,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { getInitials } from "@/lib/user";
import { getCountry } from "@/lib/countries";
import { UpdateResidenceDialog } from "./update-residence-dialog";
import { PhoneVerificationDialog } from "@/components/phone-verification-dialog";
import { EmailVerificationDialog } from "@/components/email-verification-dialog";

interface IdentitySectionProps {
  user: Doc<"users">;
  onError: (message: string) => void;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export function IdentitySection({ user, onError }: IdentitySectionProps) {
  const updateProfile = useAuditedMutation(api.users.updateProfile);
  const generateAvatarUploadUrl = useMutation(
    api.users.generateAvatarUploadUrl,
  );
  const setAvatarImage = useAuditedMutation(api.users.setAvatarImage);
  const removeAvatar = useAuditedMutation(api.users.removeAvatar);

  const [name, setName] = useState(user.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [residenceDialogOpen, setResidenceDialogOpen] = useState(false);

  const phoneStatus = useQuery(api.phone_verification.getMyStatus);
  const searchParams = useSearchParams();
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(
    () => searchParams.get("verify") === "whatsapp",
  );
  const [emailDialogOpen, setEmailDialogOpen] = useState(
    () => searchParams.get("add") === "email",
  );

  // Re-seed the editable fields whenever the viewer record changes, adjusting
  // during render instead of syncing in an effect.
  const [seededFrom, setSeededFrom] = useState(user);
  if (user !== seededFrom) {
    setSeededFrom(user);
    setName(user.name ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
  }

  const country = user.country ? getCountry(user.country) : undefined;
  const birthdayLabel = user.birthday
    ? new Date(user.birthday).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const confirmedAtLabel = user.legalInfoConfirmedAt
    ? new Date(user.legalInfoConfirmedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    setSaved(false);
    try {
      await updateProfile({ name });
      setSaved(true);
    } catch (err) {
      onError(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  }

  // The avatar uploads on its own (not part of the identity form): the image
  // is sent straight to storage, then persisted and previewed immediately.
  async function handleAvatarFile(file: File) {
    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      onError("Image must be 5 MB or smaller.");
      return;
    }
    setUploadingAvatar(true);
    onError("");
    try {
      const uploadUrl = await generateAvatarUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: StorageRef };
      const url = await setAvatarImage({ storageId });
      setAvatarUrl(url);
    } catch (err) {
      onError(getErrorMessage(err, "Failed to upload image"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    onError("");
    try {
      await removeAvatar();
      setAvatarUrl("");
    } catch (err) {
      onError(getErrorMessage(err, "Failed to remove image"));
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
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Change profile photo"
            className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-wait cursor-pointer"
          >
            <UserAvatar
              size="xl"
              imageUrl={avatarUrl || null}
              initials={initials}
              alt={name || "Profile"}
              imageClassName="shadow-xl border-4 border-surface"
              className="shadow-xl border-4 border-surface"
              onImageError={() => setAvatarUrl("")}
            />
            <span
              className={`absolute inset-0 flex items-center justify-center rounded-full bg-primary/60 text-on-primary transition-opacity ${
                uploadingAvatar
                  ? "opacity-100 animate-pulse"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <Icon path={ICON_PATHS.image} className="w-6 h-6" />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatarFile(file);
              e.target.value = "";
            }}
          />
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-headline-sm text-primary truncate">
              {name || "Unnamed Curator"}
            </h3>
            <p className="text-body-md text-on-surface-variant truncate">
              Curator since {curatorSince}
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-md bg-secondary-container text-on-secondary-container">
                Verified Identity
              </span>
              {user.recoveryVerified && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-md bg-primary-container text-on-primary-container">
                  Recovery Set
                </span>
              )}
            </div>
            <div className="pt-2 flex items-center gap-3 text-label-md">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-secondary underline cursor-pointer disabled:opacity-60"
              >
                {uploadingAvatar
                  ? "Uploading…"
                  : avatarUrl
                    ? "Change photo"
                    : "Upload photo"}
              </button>
              {avatarUrl && !uploadingAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-on-surface-variant underline cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
          <Label
            htmlFor="display-name"
            className="text-label-md text-secondary"
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
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="email" className="text-label-md text-secondary">
              Primary Email
            </Label>
            <div className="flex items-center gap-2">
              {user.emailVerificationTime && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-md bg-secondary-container text-on-secondary-container">
                  <Icon path={ICON_PATHS.checkCircle} className="w-3.5 h-3.5" />
                  Verified
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEmailDialogOpen(true)}
              >
                {user.emailVerificationTime
                  ? "Change email"
                  : user.email
                    ? "Verify"
                    : "Add email"}
              </Button>
            </div>
          </div>
          <Input
            id="email"
            type="email"
            value={user.email ?? ""}
            placeholder={user.email ? undefined : "No email linked"}
            disabled
            className="opacity-70"
          />
          <p className="text-label-md text-on-surface-variant mt-1">
            {user.emailVerificationTime
              ? "Sign in with this email and a one-time code. Change it any time — we'll verify the new address with a code."
              : user.email
                ? "On file from your invitation — verify it to sign in with an emailed code."
                : "Add an email to also sign in with an emailed code."}
          </p>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="phone" className="text-label-md text-secondary">
              WhatsApp Number
            </Label>
            <div className="flex items-center gap-2">
              {phoneStatus?.verifiedAt && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-md bg-secondary-container text-on-secondary-container">
                  <Icon path={ICON_PATHS.checkCircle} className="w-3.5 h-3.5" />
                  Verified
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVerifyDialogOpen(true)}
              >
                {phoneStatus?.verifiedAt
                  ? "Change number"
                  : user.phoneNumber
                    ? "Verify"
                    : "Add number"}
              </Button>
            </div>
          </div>
          <Input
            id="phone"
            type="tel"
            value={user.phoneNumber ?? ""}
            placeholder={user.phoneNumber ? undefined : "No number linked"}
            disabled
            className="opacity-70"
          />
          <p className="text-label-md text-on-surface-variant">
            Used for Life Check escalations and important notifications.
          </p>
        </div>

        <div className="col-span-full flex items-center justify-start gap-4">
          {saved && (
            <span className="text-body-md text-secondary font-medium">
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

      <div className="mt-10 bg-surface-container-low rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h3 className="text-title-lg text-primary">Legal identity</h3>
            <p className="text-body-md text-on-surface-variant max-w-xl">
              Recorded during onboarding as your signed declaration of identity.
              Birthday is fixed; residence may change if you move jurisdictions.
              Every update is appended to the audit chain — your original
              declaration is never overwritten.
            </p>
          </div>
          {user.country && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setResidenceDialogOpen(true)}
              className="bg-surface-container hover:bg-surface-container-high cursor-pointer"
            >
              Update residence
            </Button>
          )}
        </div>

        {!user.country && (
          <div className="rounded-xl border border-error/30 bg-error/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span
                aria-hidden
                className="shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-error/15 text-error"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm0-12.75c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9Z"
                  />
                </svg>
              </span>
              <div className="space-y-1 min-w-0">
                <p className="text-title-md text-error">Residence not set</p>
                <p className="text-body-md text-on-surface-variant">
                  Inheritance jurisdiction can&apos;t be determined until you
                  declare your country of residence. Set it now to keep your
                  succession plan admissible.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="vault"
              size="md"
              onClick={() => setResidenceDialogOpen(true)}
              className="shrink-0 cursor-pointer"
            >
              Set residence
            </Button>
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-body-md">
          <div className="space-y-1">
            <dt className="text-label-md text-secondary uppercase tracking-wide">
              Country of residence
            </dt>
            <dd className="text-on-surface flex items-center gap-2">
              {country ? (
                <>
                  <span aria-hidden className="text-base leading-none">
                    {country.flag}
                  </span>
                  <span>{country.name}</span>
                  <span className="text-label-md text-on-surface-variant uppercase tracking-widest">
                    {country.code}
                  </span>
                </>
              ) : (
                <span className="text-on-surface-variant italic">Not set</span>
              )}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-label-md text-secondary uppercase tracking-wide">
              Date of birth
            </dt>
            <dd className="text-on-surface">
              {birthdayLabel ?? (
                <span className="text-on-surface-variant italic">Not set</span>
              )}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-label-md text-secondary uppercase tracking-wide">
              Declared on
            </dt>
            <dd className="text-on-surface">
              {confirmedAtLabel ?? (
                <span className="text-on-surface-variant italic">
                  Not declared
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <UpdateResidenceDialog
        open={residenceDialogOpen}
        onOpenChange={setResidenceDialogOpen}
        currentCountry={user.country}
      />

      <PhoneVerificationDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        initialPhone={
          phoneStatus?.verifiedAt ? undefined : (user.phoneNumber ?? undefined)
        }
        defaultCountry={user.country as CountryCode | undefined}
        mode={phoneStatus?.verifiedAt ? "change" : "add"}
      />

      <EmailVerificationDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        initialEmail={
          user.emailVerificationTime ? undefined : (user.email ?? undefined)
        }
        mode={user.emailVerificationTime ? "change" : "add"}
      />
    </section>
  );
}
