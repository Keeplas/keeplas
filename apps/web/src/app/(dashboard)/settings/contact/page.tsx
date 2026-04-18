"use client";

import { useEffect, useState } from "react";
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

type Topic =
  | "general"
  | "security"
  | "billing"
  | "recovery"
  | "feature_request"
  | "other";

const TOPICS: Array<{ value: Topic; label: string }> = [
  { value: "general", label: "General question" },
  { value: "security", label: "Security concern" },
  { value: "billing", label: "Billing & subscription" },
  { value: "recovery", label: "Recovery & vault access" },
  { value: "feature_request", label: "Feature request" },
  { value: "other", label: "Other" },
];

export default function SettingsContactPage() {
  const user = useQuery(api.users.viewer);
  const submitTicket = useMutation(api.support.submitTicket);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user?.name && !name) setName(user.name);
    if (user?.email && !email) setEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await submitTicket({ name, email, topic, subject, message });
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit your message."));
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
            <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
              Message sent
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              Our concierge team will reply at{" "}
              <strong className="text-primary">{email}</strong> within 48 hours.
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
              Send another message
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
        <div className="flex items-start gap-3 bg-secondary-container/40 rounded-xl p-4">
          <Icon
            path={ICON_PATHS.shieldCheck}
            className="w-5 h-5 text-secondary shrink-0 mt-0.5"
          />
          <p className="text-sm text-on-secondary-container leading-relaxed">
            Need help with your vault or a guardian? Our team reads every message. For
            urgent security issues, mention it in the subject line.
          </p>
        </div>

        <ErrorAlert message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Full name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Reply-to email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Topic</Label>
          <Select<Topic>
            value={topic}
            onValueChange={setTopic}
            placeholder="Select a topic"
          >
            {TOPICS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-subject">Subject</Label>
          <Input
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Cannot complete life check"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share as much detail as possible. Do not include your recovery phrase."
            rows={6}
            required
          />
          <p className="text-[11px] text-on-surface-variant">
            {message.length}/10 characters minimum. Never share your seed phrase with anyone,
            including our team.
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
            {submitting ? "Sending..." : "Send Message"}
          </Button>
          <p className="text-xs text-on-surface-variant">
            Typical response time: under 48 hours.
          </p>
        </div>
      </form>
    </div>
  );
}
