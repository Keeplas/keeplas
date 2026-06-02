import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  ErrorAlert,
  Icon,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

type Topic =
  | "general"
  | "security"
  | "billing"
  | "recovery"
  | "feature_request"
  | "other";

const TOPIC_VALUES: Topic[] = [
  "general",
  "security",
  "billing",
  "recovery",
  "feature_request",
  "other",
];

export default function SettingsContactPage() {
  const t = useTranslations("settings");
  const user = useQuery(api.users.viewer);
  const submitTicket = useMutation(api.support.submitTicket);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Prefill name/contact once the viewer resolves, without clobbering anything
  // the user has already typed. Adjusting during render (tracking the seeded
  // source) avoids a setState-in-effect sync. Falls back to the WhatsApp number
  // for phone-only accounts that have no email.
  const [seededFrom, setSeededFrom] = useState<typeof user>(undefined);
  if (user && user !== seededFrom) {
    setSeededFrom(user);
    if (user.name && !name) setName(user.name);
    const seedContact = user.email ?? user.phoneNumber;
    if (seedContact && !contact) setContact(seedContact);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await submitTicket({ name, contact, topic, subject, message });
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(getErrorMessage(err, t("contact.submitError")));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest ghost-border rounded-2xl p-10 text-center space-y-5">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary-container text-on-secondary-container mx-auto">
            <Icon path={ICON_PATHS.checkCircle} className="w-7 h-7" />
          </span>
          <div className="space-y-2">
            <h2 className="text-headline-md text-primary">
              {t("contact.success.title")}
            </h2>
            <p className="text-body-lg text-on-surface-variant">
              {t("contact.success.intro")}{" "}
              <strong className="text-primary">{contact}</strong>{" "}
              {t("contact.success.outro")}
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setSubmitted(false)}
              className="bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              {t("contact.success.sendAnother")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest ghost-border rounded-2xl p-6 md:p-8 space-y-6"
      >
        <ErrorAlert message={error} />

        <div className="space-y-2">
          <Label htmlFor="contact-reply">{t("contact.form.replyTo")}</Label>
          <Input
            id="contact-reply"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@example.com or +1 555 000 0000"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>{t("contact.form.topic")}</Label>
          <Select<Topic>
            value={topic}
            onValueChange={setTopic}
            placeholder={t("contact.form.topicPlaceholder")}
          >
            {TOPIC_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`contact.topics.${value}`)}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-subject">{t("contact.form.subject")}</Label>
          <Input
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("contact.form.subjectPlaceholder")}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message">{t("contact.form.message")}</Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("contact.form.messagePlaceholder")}
            rows={6}
            minLength={10}
            required
          />
          <p className="text-label-md text-on-surface-variant">
            {t("contact.form.seedWarning")}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? t("contact.form.sending") : t("contact.form.send")}
          </Button>
          <p className="text-body-md text-on-surface-variant">
            {t("contact.form.responseTime")}
          </p>
        </div>
      </form>
    </div>
  );
}
