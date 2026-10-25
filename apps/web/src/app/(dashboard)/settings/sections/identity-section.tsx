import { useRef, useState } from "react";
import { useSearchParams } from "@/lib/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import type { StorageRef } from "@keeplas/backend/lib/storage";
import {
  Button,
  cn,
  ErrorAlert,
  Icon,
  Input,
  Label,
  UserAvatar,
  type CountryCode,
} from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { IconTile, Panel, RowText, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { getInitials } from "@/lib/user";
import { getCountry } from "@/lib/countries";
import { useLocale, useTranslations } from "@/lib/i18n";
import { UpdateResidenceDialog } from "./update-residence-dialog";
import { PhoneVerificationDialog } from "@/components/phone-verification-dialog";
import { EmailVerificationDialog } from "@/components/email-verification-dialog";

interface IdentitySectionProps {
  user: Doc<"users">;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export function IdentitySection({ user }: IdentitySectionProps) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [error, onError] = useState("");
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

  // Auto-save the display name when the field loses focus, but only when it
  // actually changed from the persisted value — avoids redundant mutations.
  async function handleNameBlur() {
    const next = name.trim();
    if (next === (user.name ?? "")) return;
    onError("");
    try {
      await updateProfile({ name: next });
    } catch (err) {
      onError(getErrorMessage(err, t("identity.updateError")));
    }
  }

  // The avatar uploads on its own (not part of the identity form): the image
  // is sent straight to storage, then persisted and previewed immediately.
  async function handleAvatarFile(file: File) {
    if (!file.type.startsWith("image/")) {
      onError(t("identity.avatar.notImage"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      onError(t("identity.avatar.tooLarge"));
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
      onError(getErrorMessage(err, t("identity.avatar.uploadError")));
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
      onError(getErrorMessage(err, t("identity.avatar.removeError")));
    }
  }

  const initials = getInitials(user.name || user.email);

  const curatorSince = user._creationTime
    ? new Date(user._creationTime).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      })
    : t("identity.unknown");

  return (
    <ShellPage
      title={t("identity.pageTitle")}
      subtitle={t("identity.pageSubtitle")}
      breadcrumb={[
        { label: t("overview.title"), href: "/settings" },
        { label: t("identity.pageTitle") },
      ]}
    >
      {error ? <ErrorAlert message={error} /> : null}

      <Panel className="flex flex-col items-start gap-[20px] p-[24px] sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          aria-label={t("identity.avatar.change")}
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-wait"
        >
          <UserAvatar
            size="xl"
            imageUrl={avatarUrl || null}
            initials={initials}
            alt={name || t("identity.profileAlt")}
            onImageError={() => setAvatarUrl("")}
          />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-scrim/60 text-text-inverse transition-opacity",
              uploadingAvatar
                ? "animate-pulse opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            <Icon path={ICON_PATHS.image} className="size-[24px]" />
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
        <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
          <div className="flex min-w-0 flex-col gap-[2px]">
            <h2 className="truncate text-h2 text-text-primary">
              {name || t("identity.unnamedCurator")}
            </h2>
            <p className="text-body-sm text-text-muted">
              {t("identity.curatorSince", { date: curatorSince })}
            </p>
          </div>
          <div className="flex flex-wrap gap-[8px]">
            <StatusChip
              tone="neutral"
              label={t("identity.verifiedIdentity")}
              dotClassName="bg-status-active"
            />
            {user.recoveryVerified ? (
              <StatusChip
                tone="neutral"
                label={t("identity.recoverySet")}
                dotClassName="bg-status-active"
              />
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-[12px]">
          <Button
            type="button"
            variant="outlined"
            size="compact"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar
              ? t("identity.avatar.uploading")
              : avatarUrl
                ? t("identity.avatar.changePhoto")
                : t("identity.avatar.uploadPhoto")}
          </Button>
          {avatarUrl && !uploadingAvatar ? (
            <Button
              type="button"
              variant="link"
              size="compact"
              onClick={handleRemoveAvatar}
            >
              {t("identity.avatar.remove")}
            </Button>
          ) : null}
        </div>
      </Panel>

      <div className="grid items-start gap-[20px] lg:grid-cols-2">
        <Panel className="flex flex-col gap-[12px] p-[20px]">
          <Label htmlFor="display-name" className="text-h3 text-text-primary">
            {t("identity.displayName")}
          </Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder={t("identity.displayNamePlaceholder")}
          />
        </Panel>

        <ContactPanel
          title={t("identity.email.label")}
          value={user.email ?? t("identity.email.none")}
          verifiedLabel={
            user.emailVerificationTime ? t("identity.verified") : undefined
          }
          action={
            user.emailVerificationTime
              ? t("identity.email.change")
              : user.email
                ? t("identity.verify")
                : t("identity.email.add")
          }
          onAction={() => setEmailDialogOpen(true)}
          hint={
            user.emailVerificationTime
              ? t("identity.email.hintVerified")
              : user.email
                ? t("identity.email.hintOnFile")
                : t("identity.email.hintNone")
          }
        />

        <ContactPanel
          title={t("identity.phone.label")}
          value={user.phoneNumber ?? t("identity.phone.none")}
          verifiedLabel={
            phoneStatus?.verifiedAt ? t("identity.verified") : undefined
          }
          action={
            phoneStatus?.verifiedAt
              ? t("identity.phone.change")
              : user.phoneNumber
                ? t("identity.verify")
                : t("identity.phone.add")
          }
          onAction={() => setVerifyDialogOpen(true)}
          hint={t("identity.phone.hint")}
        />

        <Panel className="flex flex-col gap-[12px] p-[20px]">
          <div className="flex items-start justify-between gap-[12px]">
            <h3 className="text-h3 text-text-primary">
              {t("identity.legal.title")}
            </h3>
            {user.country ? (
              <Button
                type="button"
                variant="outlined"
                size="compact"
                onClick={() => setResidenceDialogOpen(true)}
              >
                {t("identity.legal.updateResidence")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-[12px]">
            <IconTile
              icon={ICON_PATHS.globe}
              className="bg-bg-info text-text-link"
            />
            <RowText
              title={t("identity.legal.countryOfResidence")}
              description={
                country
                  ? `${country.flag} ${country.name}`
                  : t("identity.legal.notSet")
              }
            />
          </div>
          {!user.country ? (
            <div className="flex flex-col gap-[12px] rounded-sm bg-bg-pending p-[14px]">
              <RowText
                title={t("identity.legal.residenceNotSet")}
                description={t("identity.legal.residenceNotSetHint")}
              />
              <Button
                type="button"
                variant="primary"
                size="compact"
                onClick={() => setResidenceDialogOpen(true)}
                className="self-start"
              >
                {t("identity.legal.setResidence")}
              </Button>
            </div>
          ) : null}
          <BirthdayRow birthday={user.birthday} />
          <p className="text-body-sm text-text-muted">
            {t("identity.legal.description")}
          </p>
        </Panel>
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
    </ShellPage>
  );
}

function ContactPanel({
  title,
  value,
  verifiedLabel,
  action,
  onAction,
  hint,
}: {
  title: string;
  value: string;
  verifiedLabel?: string;
  action: string;
  onAction: () => void;
  hint: string;
}) {
  return (
    <Panel className="flex flex-col gap-[12px] p-[20px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <h3 className="text-h3 text-text-primary">{title}</h3>
          {verifiedLabel ? (
            <StatusChip
              tone="neutral"
              label={verifiedLabel}
              dotClassName="bg-status-active"
            />
          ) : null}
        </div>
        <Button
          type="button"
          variant="outlined"
          size="compact"
          onClick={onAction}
        >
          {action}
        </Button>
      </div>
      <p className="break-all text-body-lg text-text-primary">{value}</p>
      <p className="text-body-sm text-text-muted">{hint}</p>
    </Panel>
  );
}

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function BirthdayRow({ birthday }: { birthday?: number }) {
  const t = useTranslations("settings.identity.legal");
  const locale = useLocale();
  const updateBirthday = useAuditedMutation(api.users.updateBirthday);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  const label = birthday
    ? `${new Date(birthday).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })} · ${t("age", { age: Math.floor((now - birthday) / YEAR_MS) })}`
    : t("notSet");

  function startEditing() {
    setValue(birthday ? new Date(birthday).toISOString().slice(0, 10) : "");
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await updateBirthday({ birthday: Date.parse(`${value}T00:00:00Z`) });
      setEditing(false);
    } catch (err) {
      const message = getErrorMessage(err, "");
      setError(
        message.includes("at least 18")
          ? t("tooYoung")
          : message.includes("implausibly") || message.includes("Invalid")
            ? t("invalidDate")
            : t("birthdayError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-center gap-[12px]">
        <IconTile
          icon={ICON_PATHS.user}
          className="bg-bg-info text-text-link"
        />
        <RowText title={t("dateOfBirth")} description={label} />
        {editing ? null : (
          <Button
            type="button"
            variant="outlined"
            size="compact"
            onClick={startEditing}
          >
            {birthday ? t("edit") : t("add")}
          </Button>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-wrap items-center gap-[12px]"
        >
          <Input
            type="date"
            aria-label={t("dateOfBirth")}
            value={value}
            max={new Date(now).toISOString().slice(0, 10)}
            onChange={(e) => setValue(e.target.value)}
            className="w-auto"
            required
          />
          <Button
            type="submit"
            variant="primary"
            size="compact"
            disabled={saving || !value}
          >
            {t("save")}
          </Button>
          <Button
            type="button"
            variant="link"
            size="compact"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            {t("cancel")}
          </Button>
          {error ? (
            <p role="alert" className="w-full text-body-sm text-action-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
