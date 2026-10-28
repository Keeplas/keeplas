import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { StorageRef } from "@keeplas/backend/lib/storage";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { AccountAvatar } from "@/features/account/account-avatar";
import {
  pickAvatar,
  uploadAvatar,
  type AvatarSource,
} from "@/features/account/avatar";
import { useBirthdayEditor } from "@/features/account/birthday-editor";
import { accountErrorKey } from "@/features/account/errors";
import { PermissionSheet } from "@/features/capture/add-sheet";
import {
  CameraUnavailable,
  PermissionDenied,
  type PermissionProblem,
} from "@/features/capture/media";
import { ageInYears, countryName, formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

export default function Account() {
  const router = useRouter();
  const { t, language } = useI18n();
  const viewer = useViewer();
  const updateProfile = useAuditedMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatarImage = useAuditedMutation(api.users.setAvatarImage);
  const removeAvatar = useAuditedMutation(api.users.removeAvatar);
  const birthdayEditor = useBirthdayEditor(viewer.birthday);
  const [name, setName] = useState(viewer.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [denied, setDenied] = useState<PermissionProblem | null>(null);
  const trimmedName = name.trim();
  const nameChanged = trimmedName !== "" && trimmedName !== (viewer.name ?? "");

  async function saveName() {
    setSavingName(true);
    try {
      await updateProfile({ name: trimmedName });
      setName(trimmedName);
      toast({ variant: "success", title: t("account.nameSaved") });
    } catch (error) {
      toast({ variant: "error", title: t(accountErrorKey(error)) });
    } finally {
      setSavingName(false);
    }
  }

  async function changePhoto(source: AvatarSource) {
    try {
      const uri = await pickAvatar(source);
      if (!uri) return;
      setUploading(true);
      const storageId = await uploadAvatar(uri, generateUploadUrl);
      await setAvatarImage({ storageId: storageId as StorageRef });
      toast({ variant: "success", title: t("account.photoUpdated") });
    } catch (error) {
      if (error instanceof PermissionDenied) setDenied(error.what);
      else if (error instanceof CameraUnavailable)
        toast({
          variant: "error",
          title: t("capture.noCameraTitle"),
          description: t("capture.noCameraPhotoBody"),
        });
      else
        toast({
          variant: "error",
          title: t(accountErrorKey(error, "account.errors.uploadFailed")),
        });
    } finally {
      setUploading(false);
    }
  }

  function choosePhoto() {
    Alert.alert(t("account.photo"), undefined, [
      {
        text: t("account.takePhoto"),
        onPress: () => void changePhoto("camera"),
      },
      {
        text: t("account.chooseLibrary"),
        onPress: () => void changePhoto("library"),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  function confirmRemovePhoto() {
    Alert.alert(t("account.removePhotoTitle"), t("account.removePhotoBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.removePhoto"),
        style: "destructive",
        onPress: () =>
          removeAvatar()
            .then(() =>
              toast({ variant: "success", title: t("account.photoRemoved") }),
            )
            .catch(() =>
              toast({ variant: "error", title: t("common.genericError") }),
            ),
      },
    ]);
  }

  const emailVerified = Boolean(viewer.email && viewer.emailVerificationTime);
  const phoneVerified = Boolean(
    viewer.phoneNumber && viewer.phoneNumberVerifiedAt,
  );

  return (
    <Screen
      header={<NavBar title={t("account.title")} onBack={router.back} />}
      gap={12}
    >
      <View style={styles.photo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("account.photo")}
          disabled={uploading}
          onPress={choosePhoto}
        >
          <AccountAvatar
            url={viewer.avatarUrl}
            name={viewer.name || viewer.email || ""}
            size={96}
            busy={uploading}
          />
        </Pressable>
        <View style={styles.photoActions}>
          <Button
            variant="text"
            label={
              uploading
                ? t("account.uploading")
                : t(
                    viewer.avatarUrl
                      ? "account.changePhoto"
                      : "account.addPhoto",
                  )
            }
            disabled={uploading}
            onPress={choosePhoto}
          />
          {viewer.avatarUrl && !uploading ? (
            <Button
              variant="text"
              label={t("account.removePhoto")}
              onPress={confirmRemovePhoto}
            />
          ) : null}
        </View>
      </View>
      <TextField
        label={t("account.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("account.namePlaceholder")}
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (nameChanged) void saveName();
        }}
      />
      <Button
        label={t("account.save")}
        loading={savingName}
        disabled={!nameChanged}
        onPress={saveName}
      />
      <Text variant="label">{t("account.contact")}</Text>
      <ListRow
        icon="mail"
        title={t("account.email")}
        description={viewer.email ?? t("account.noEmail")}
        trailing={
          <RowAction
            verified={emailVerified}
            hasValue={Boolean(viewer.email)}
          />
        }
        onPress={() => router.push("/account-email")}
      />
      <ListRow
        icon="whatsapp"
        title={t("account.phone")}
        description={
          viewer.phoneNumber
            ? formatPhone(viewer.phoneNumber)
            : t("account.noPhone")
        }
        trailing={
          <RowAction
            verified={phoneVerified}
            hasValue={Boolean(viewer.phoneNumber)}
          />
        }
        onPress={() => router.push("/account-phone")}
      />
      <Text variant="label">{t("account.legal.title")}</Text>
      <Text variant="body-sm" color="text.muted">
        {t("account.legal.body")}
      </Text>
      <DetailRows
        rows={[
          {
            icon: "globe",
            label: t("account.legal.country"),
            value: viewer.country
              ? countryName(viewer.country, language)
              : t("account.legal.notSet"),
          },
          {
            icon: "user",
            label: t("account.legal.birthday"),
            value: viewer.birthday
              ? `${formatDate(viewer.birthday, language, "UTC")} · ${t(
                  "account.legal.age",
                  { age: ageInYears(viewer.birthday) },
                )}`
              : t("account.legal.notSet"),
            onPress: birthdayEditor.edit,
          },
        ]}
      />
      {birthdayEditor.sheet}
      <PermissionSheet problem={denied} onDismiss={() => setDenied(null)} />
    </Screen>
  );
}

function RowAction({
  verified,
  hasValue,
}: {
  verified: boolean;
  hasValue: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.rowAction}>
      {hasValue ? (
        <StatusChip
          tone={verified ? "success" : "warning"}
          label={t(verified ? "account.verified" : "account.unverified")}
        />
      ) : null}
      <Text variant="body-sm-strong" color="accent.text">
        {t(hasValue ? "account.change" : "account.add")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: "center", gap: 8, paddingVertical: 8 },
  photoActions: { flexDirection: "row", gap: 24 },
  rowAction: { alignItems: "flex-end", gap: 6 },
});
