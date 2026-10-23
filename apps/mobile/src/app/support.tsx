import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Radio } from "@/components/controls";
import { Screen } from "@/components/screen";
import { Callout, Card, IconBadge, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { errorText } from "@/lib/errors";
import { SUPPORT_TOPICS, type SupportTopic } from "@/lib/support";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * Write to the Keeplas team (support.submitTicket), signed in or not: from
 * Settings, the help screen and every "Get help" button. The reply goes to
 * the email or WhatsApp number given here.
 */
export default function Support() {
  const router = useRouter();
  const { t } = useI18n();
  const { viewer } = useSession();
  const params = useLocalSearchParams<{ topic?: SupportTopic; ref?: string }>();
  const submit = useMutation(api.support.submitTicket);
  const [topic, setTopic] = useState<SupportTopic>(
    SUPPORT_TOPICS.includes(params.topic as SupportTopic)
      ? (params.topic as SupportTopic)
      : "general",
  );
  const [name, setName] = useState(viewer?.name ?? "");
  const [contact, setContact] = useState(
    viewer?.email ?? viewer?.phoneNumber ?? "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await submit({
        name,
        contact: contact.startsWith("+") ? contact.replace(/\s/g, "") : contact,
        topic,
        subject: t(`support.topics.${topic}`),
        message: params.ref ? `${message}\n\nRef: ${params.ref}` : message,
      });
      setSent(true);
    } catch (err) {
      const text = errorText(err);
      setError(
        text.includes("valid email")
          ? t("support.invalidContact")
          : text.includes("at least 10")
            ? t("support.tooShort")
            : text.includes("required")
              ? t("support.missing")
              : t("common.genericError"),
      );
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
  );
  if (sent) {
    return (
      <Screen header={header}>
        <IconBadge icon="check-circle" tone="success" />
        <Text variant="h1">{t("support.sentTitle")}</Text>
        <Text variant="body-lg" color="text.muted">
          {t("support.sentBody", { contact })}
        </Text>
        <Button label={t("common.done")} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <Text variant="h1">{t("support.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("support.body")}
      </Text>
      <Text variant="label">{t("support.topic")}</Text>
      <Card>
        {SUPPORT_TOPICS.map((value) => (
          <Radio
            key={value}
            selected={topic === value}
            onPress={() => setTopic(value)}
            label={t(`support.topics.${value}`)}
          />
        ))}
      </Card>
      <TextField
        label={t("support.name")}
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
      <TextField
        label={t("support.contact")}
        value={contact}
        onChangeText={setContact}
        placeholder={t("support.contactPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label={t("support.message")}
        value={message}
        onChangeText={setMessage}
        placeholder={t("support.messagePlaceholder")}
        multiline
      />
      {error ? (
        <Callout tone="danger" icon="alert-circle" text={error} />
      ) : null}
      <Button
        label={t("support.send")}
        chevron
        loading={busy}
        disabled={!name.trim() || !contact.trim() || !message.trim()}
        onPress={send}
      />
      <Note icon="shield-check" text={t("support.note")} />
    </Screen>
  );
}
