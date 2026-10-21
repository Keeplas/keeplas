import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { SectionHeader } from "@/components/rows";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useVaultData } from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

export default function Beneficiaries() {
  const router = useRouter();
  const { t } = useI18n();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const { folders } = useVaultData();
  const beneficiaries = (contacts ?? []).filter(
    (contact) => contact.contactType === "recipient_only",
  );

  return (
    <Screen
      header={
        <NavBar
          title={t("people.beneficiariesTitle")}
          onBack={router.back}
          right={<LanguageDropdown />}
        />
      }
      gap={14}
    >
      <Text variant="h1">{t("people.beneficiariesTitle")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("people.beneficiariesScreenBody")}
      </Text>
      {beneficiaries.map((contact) => (
        <ListRow
          key={contact._id}
          icon="user-circle"
          title={contact.name}
          description={contact.email ?? contact.phoneNumber ?? ""}
          trailing={
            <StatusChip
              label={t(`people.status.${contact.invitationStatus}`)}
              tone={
                contact.invitationStatus === "accepted" ? "success" : "warning"
              }
            />
          }
        />
      ))}
      {contacts && beneficiaries.length === 0 ? (
        <Text variant="body-sm" color="text.muted">
          {t("people.noBeneficiaries")}
        </Text>
      ) : null}
      <SectionHeader
        title={t("people.sharedFolders")}
        action={{
          label: t("folders.new"),
          onPress: () => router.push("/folder/new"),
        }}
      />
      {(folders ?? []).map((folder) => (
        <ListRow
          key={folder.id}
          icon="folder"
          title={folder.name ?? t("folders.title")}
          description={
            folder.grants.length
              ? folder.grants.map((grant) => grant.contactName).join(", ")
              : t("people.onlyYou")
          }
          onPress={() =>
            router.push({ pathname: "/folder/[id]", params: { id: folder.id } })
          }
        />
      ))}
    </Screen>
  );
}
