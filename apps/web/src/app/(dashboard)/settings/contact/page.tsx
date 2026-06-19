import { useSearchParams } from "@/lib/navigation";
import {
  ContactForm,
  TOPIC_VALUES,
  type Topic,
} from "@/components/contact-form";

export default function SettingsContactPage() {
  // Seed the topic from a `?topic=` query param (e.g. the Roadmap section links
  // here with topic=feature_request), falling back to "general" when absent or
  // unknown.
  const requestedTopic = useSearchParams().get("topic");
  const initialTopic: Topic = TOPIC_VALUES.includes(requestedTopic as Topic)
    ? (requestedTopic as Topic)
    : "general";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-surface-container-lowest ghost-border rounded-2xl p-6 md:p-8">
        <ContactForm initialTopic={initialTopic} />
      </div>
    </div>
  );
}
