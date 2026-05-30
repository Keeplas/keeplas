"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const THRESHOLD_OPTIONS = [
  { value: 2, key: "two", accent: "bg-secondary-container/40" },
  { value: 3, key: "three", accent: "bg-surface-container-low" },
];

const POSTMORTEM_STEPS = [
  { key: "detection", accent: "bg-secondary" },
  { key: "confirmation", accent: "bg-tertiary" },
  { key: "grace", accent: "bg-warning" },
  { key: "reconstruction", accent: "bg-error" },
  { key: "distribution", accent: "bg-primary" },
];

const SHARD_STEPS = [
  { key: "accept", accent: "bg-secondary/40" },
  { key: "distribution", accent: "bg-secondary" },
  { key: "recoveryTime", accent: "bg-tertiary" },
  { key: "reconstruction", accent: "bg-error" },
];

const ZK_BULLETS = [
  "distribution",
  "reception",
  "verification",
  "submission",
  "reconstruction",
];

export default function RecoveryDocPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          {t("breadcrumb")}
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">{t("recovery.title")}</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          {t("recovery.eyebrow")}
        </span>
        <h1 className="text-headline-lg text-primary">{t("recovery.title")}</h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("recovery.intro")}
        </p>
      </header>

      {/* Two paths */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <Icon path={ICON_PATHS.key} className="w-5 h-5" />
          </span>
          <h3 className="text-headline-sm text-primary">
            {t("recovery.paths.alive.title")}
          </h3>
          <p className="text-body-md text-on-surface-variant">
            {t("recovery.paths.alive.pathA")}
          </p>
          <p className="text-body-md text-on-surface-variant">
            {t("recovery.paths.alive.pathB")}
          </p>
        </article>

        <article className="bg-primary text-on-primary rounded-2xl p-6 space-y-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10">
            <Icon path={ICON_PATHS.heartbeat} className="w-5 h-5" />
          </span>
          <h3 className="text-headline-sm">
            {t("recovery.paths.unreachable.title")}
          </h3>
          <p className="text-body-md text-on-primary-container">
            {t("recovery.paths.unreachable.body")}
          </p>
        </article>
      </section>

      {/* The 24 words */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("recovery.words.heading")}
          </h2>
        </div>

        <div className="space-y-4 text-body-md text-on-surface-variant">
          <p>{t("recovery.words.p1")}</p>
          <p>{t("recovery.words.p2")}</p>
          <div className="bg-error-container/30 rounded-xl p-4 border-l-4 border-error">
            <p className="text-body-md text-on-surface font-medium">
              {t("recovery.words.callout")}
            </p>
          </div>
        </div>
      </section>

      {/* Threshold */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-tertiary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("recovery.threshold.heading")}
          </h2>
        </div>

        <p className="text-body-md text-on-surface-variant">
          {t("recovery.threshold.intro")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {THRESHOLD_OPTIONS.map((option) => (
            <article
              key={option.value}
              className={`rounded-2xl p-4 ghost-border ${option.accent}`}
            >
              <p className="text-headline-md font-bold text-primary">
                {option.value}
              </p>
              <p className="text-label-md text-secondary mt-1">
                {t(`recovery.threshold.options.${option.key}.label`)}
              </p>
              <p className="text-body-md text-on-surface-variant mt-2">
                {t(`recovery.threshold.options.${option.key}.body`)}
              </p>
            </article>
          ))}
        </div>

        <p className="text-body-md text-on-surface-variant">
          {t("recovery.threshold.note")}
        </p>
      </section>

      {/* Post-mortem flow */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-error rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("recovery.postmortem.heading")}
          </h2>
        </div>

        <ol className="relative pl-8 border-l-2 border-error/20 space-y-8">
          {POSTMORTEM_STEPS.map((step) => (
            <Step
              key={step.key}
              stage={t(`recovery.postmortem.steps.${step.key}.stage`)}
              title={t(`recovery.postmortem.steps.${step.key}.title`)}
              body={t(`recovery.postmortem.steps.${step.key}.body`)}
              accent={step.accent}
            />
          ))}
        </ol>
      </section>

      {/* Zero-knowledge guarantees */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("recovery.zk.heading")}
          </h2>
        </div>

        <div className="space-y-4 text-body-md text-on-surface-variant">
          <p>{t("recovery.zk.intro")}</p>

          <ul className="space-y-2 pl-4 list-disc">
            {ZK_BULLETS.map((b) => (
              <li key={b}>
                <strong className="text-primary">
                  {t(`recovery.zk.bullets.${b}.label`)}
                </strong>
                : {t(`recovery.zk.bullets.${b}.body`)}
              </li>
            ))}
          </ul>

          <div className="bg-primary/5 rounded-xl p-4 border-l-4 border-primary">
            <p className="text-body-md text-on-surface font-medium">
              {t("recovery.zk.callout")}
            </p>
          </div>
        </div>
      </section>

      {/* How a contact actually uses their shard */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("recovery.shardUse.heading")}
          </h2>
        </div>

        <p className="text-body-md text-on-surface-variant">
          {t("recovery.shardUse.intro")}
        </p>

        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-6">
          {SHARD_STEPS.map((step) => (
            <Step
              key={step.key}
              stage={t(`recovery.shardUse.steps.${step.key}.stage`)}
              title={t(`recovery.shardUse.steps.${step.key}.title`)}
              body={t(`recovery.shardUse.steps.${step.key}.body`)}
              accent={step.accent}
            />
          ))}
        </ol>
      </section>

      {/* Cross-device behaviour */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-tertiary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("recovery.crossDevice.heading")}
          </h2>
        </div>

        <p className="text-body-md text-on-surface-variant">
          {t("recovery.crossDevice.intro")}
        </p>

        <div className="space-y-4 text-body-md text-on-surface-variant">
          <p>
            <strong className="text-primary">
              {t("recovery.crossDevice.keypair.label")}
            </strong>{" "}
            {t("recovery.crossDevice.keypair.body")}
          </p>
          <p>
            <strong className="text-primary">
              {t("recovery.crossDevice.shard.label")}
            </strong>{" "}
            {t("recovery.crossDevice.shard.body")}
          </p>
          <p>
            <strong className="text-primary">
              {t("recovery.crossDevice.restore.label")}
            </strong>{" "}
            {t("recovery.crossDevice.restore.body")}
          </p>
        </div>

        <div className="bg-error-container/30 rounded-xl p-4 border-l-4 border-error">
          <p className="text-body-md text-on-surface font-medium mb-2">
            {t("recovery.crossDevice.failure.title")}
          </p>
          <p className="text-body-md text-on-surface-variant">
            {t("recovery.crossDevice.failure.body")}
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/docs/trusted-contacts"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            {t("recovery.trustedLink")}
          </span>
        </Link>
        <Link
          href="/settings/recovery-kit"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.print} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            {t("recovery.recoveryKitLink")}
          </span>
        </Link>
      </section>
    </div>
  );
}

function Step({
  stage,
  title,
  body,
  accent,
}: {
  stage: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[41px] top-1 w-4 h-4 rounded-full border-4 border-surface ${accent}`}
      />
      <p className="text-label-md text-on-surface-variant uppercase tracking-wide">
        {stage}
      </p>
      <h3 className="text-headline-sm text-primary mt-1">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1">{body}</p>
    </li>
  );
}
