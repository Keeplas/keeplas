"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Icon,
  Input,
  Label,
  Loader,
  Select,
  SelectItem,
  Switch,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";

type ActionType =
  | "send_message"
  | "grant_access"
  | "alert_authority"
  | "unlock_vault"
  | "account_wipe";

type StepCategory =
  | "primary_outreach"
  | "incapacity"
  | "posthumous_release"
  | "wipe";

const CATEGORY_LABELS: Record<StepCategory, string> = {
  primary_outreach: "Primary outreach",
  incapacity: "Incapacity handling",
  posthumous_release: "Posthumous release",
  wipe: "Terminal wipe",
};

const ACTION_META: Record<
  ActionType,
  { label: string; description: string; iconPath: string; chipIconPath: string }
> = {
  send_message: {
    label: "Send Message",
    description: "Release encrypted messages to selected recipients.",
    iconPath: ICON_PATHS.mail,
    chipIconPath: ICON_PATHS.mail,
  },
  grant_access: {
    label: "Grant Access",
    description: "Open vault sections to trusted contacts.",
    iconPath: ICON_PATHS.share,
    chipIconPath: ICON_PATHS.key,
  },
  alert_authority: {
    label: "Alert Authority",
    description: "Notify legal counsel or chosen first responder.",
    iconPath: ICON_PATHS.notificationsActive,
    chipIconPath: ICON_PATHS.lawyer,
  },
  unlock_vault: {
    label: "Unlock Vault",
    description: "Release decryption shards to threshold contacts.",
    iconPath: ICON_PATHS.encrypted,
    chipIconPath: ICON_PATHS.encrypted,
  },
  account_wipe: {
    label: "Account Wipe",
    description: "Irreversible erasure of vault and metadata.",
    iconPath: ICON_PATHS.cloudOff,
    chipIconPath: ICON_PATHS.cloudOff,
  },
};

const TRIGGER_PRESETS = [7, 30, 60, 90, 180];

function shortHash(input: string) {
  if (!input) return "0x0000…0000";
  const trimmed = input.replace(/^0x/, "");
  if (trimmed.length <= 8) return `0x${trimmed.toUpperCase()}`;
  return `0x${trimmed.slice(0, 4).toUpperCase()}…${trimmed.slice(-4).toUpperCase()}`;
}

function dotColor(index: number, total: number) {
  if (index === total - 1 && total > 1) return "bg-error";
  if (index === 0) return "bg-secondary";
  return "bg-secondary/50";
}

function dotTextColor(index: number, total: number) {
  if (index === total - 1 && total > 1) return "text-error";
  if (index === 0) return "text-secondary";
  return "text-secondary/70";
}

export default function ScenarioPage() {
  const data = useQuery(api.scenarios.getScenario);
  const getOrCreate = useMutation(api.scenarios.getOrCreateScenario);
  const setSafePause = useMutation(api.scenarios.setSafePause);
  const addStep = useMutation(api.scenarios.addStep);
  const removeStep = useMutation(api.scenarios.removeStep);

  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (data === null) {
      getOrCreate();
    }
  }, [data, getOrCreate]);

  if (data === undefined) {
    return <Loader fullscreen label="Loading Scenario Engine" />;
  }

  const scenario = data?.scenario;
  const steps = data?.steps ?? [];
  const lastCheck = scenario?.lastCheckAt ?? scenario?.createdAt ?? null;

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-8 mb-12">
        <div className="space-y-4">
          <h1 className="text-headline-lg text-primary">
            Scenario Engine
          </h1>
          <p className="text-on-surface-variant max-w-xl text-body-lg">
            Configure autonomous actions triggered by a Life Check failure. These events will
            only execute if the inactivity window is breached without a manual override.
          </p>
        </div>

        <div className="bg-surface-container-low p-6 rounded-full flex items-center space-x-6 ghost-border">
          <div className="text-right">
            <div className="text-label-md text-secondary">
              Safe Pause
            </div>
            <div className="text-body-md text-on-surface-variant">
              {scenario?.isSafePauseActive ? "Active for Travel" : "Engine Live"}
            </div>
          </div>
          <Switch
            checked={scenario?.isSafePauseActive ?? false}
            onCheckedChange={(checked) =>
              setSafePause({
                paused: checked,
                until: checked ? Date.now() + 30 * 24 * 60 * 60 * 1000 : undefined,
              })
            }
          />
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left — Timeline */}
        <section className="col-span-12 lg:col-span-8 space-y-8">
          <div className="bg-surface-container-lowest p-8 md:p-10 rounded-full shadow-2xl shadow-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Icon path={ICON_PATHS.historyToggleOff} className="w-24 h-24" />
            </div>

            <h2 className="text-headline-md text-primary mb-10 flex items-center">
              <Icon path={ICON_PATHS.accountTree} className="w-6 h-6 mr-3 text-secondary" />
              Triggered Event Chain
            </h2>

            {steps.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant">
                <p className="mb-6">No milestones configured yet.</p>
                <Button variant="vault" size="md" onClick={() => setShowAdd(true)}>
                  Add your first milestone
                </Button>
              </div>
            ) : (
              <div className="relative pl-8 border-l-2 border-secondary/20 space-y-12">
                {steps.map((step, idx) => {
                  const total = steps.length;
                  return (
                    <div key={step._id} className="relative">
                      <div
                        className={cn(
                          "absolute -left-[41px] top-0 w-4 h-4 rounded-full border-4 border-surface-container-lowest",
                          dotColor(idx, total)
                        )}
                      />
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div
                            className={cn(
                              "text-label-md mb-1",
                              dotTextColor(idx, total)
                            )}
                          >
                            T+ {step.triggerValue} Days Inactivity
                          </div>
                          <h3 className="text-headline-sm text-primary">
                            {step.label}
                          </h3>
                          <div className="mt-4 flex flex-wrap gap-3">
                            {step.actions.map((action, i) => {
                              const meta = ACTION_META[action.actionType as ActionType];
                              const isHighlight = action.actionType === "grant_access";
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-medium",
                                    isHighlight
                                      ? "bg-primary-container text-white"
                                      : "bg-surface-container"
                                  )}
                                >
                                  <Icon
                                    path={meta?.chipIconPath ?? ICON_PATHS.shieldCheck}
                                    className={cn(
                                      "w-4 h-4",
                                      isHighlight ? "text-white" : "text-secondary"
                                    )}
                                  />
                                  <span>{meta?.label ?? action.actionType}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => removeStep({ stepId: step._id })}
                          className="text-on-surface-variant hover:text-error transition-colors cursor-pointer p-1"
                          aria-label="Remove milestone"
                        >
                          <Icon path={ICON_PATHS.edit} className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {steps.length > 0 && (
              <div className="mt-12 pt-10 border-t border-outline-variant/15">
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center space-x-2 text-secondary font-bold hover:translate-x-1 transition-transform cursor-pointer"
                >
                  <Icon path={ICON_PATHS.plusCircle} className="w-5 h-5" />
                  <span>Add Trigger Milestone</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right — Status / Library / Fail-Safe */}
        <aside className="col-span-12 lg:col-span-4 space-y-8">
          {/* Engine Status */}
          <div className="bg-primary text-white p-8 rounded-full shadow-2xl shadow-primary/10 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="text-label-md text-on-primary-container mb-6">
              Engine Status
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  scenario?.isSafePauseActive
                    ? "bg-tertiary-fixed"
                    : "bg-secondary-fixed animate-pulse"
                )}
              />
              <span className="text-headline-md">
                {scenario?.isSafePauseActive ? "Paused (Travel)" : "Armed & Ready"}
              </span>
            </div>
            <p className="text-body-md text-on-primary-container">
              System monitored. Last life check{" "}
              {lastCheck ? formatTimeAgo(lastCheck) : "—"}. All scenarios synchronized with
              the main vault.
            </p>
          </div>

          {/* Action Library */}
          <div className="bg-surface-container-low p-8 rounded-full">
            <h3 className="text-headline-sm text-primary mb-6 flex items-center">
              <Icon
                path={ICON_PATHS.settingsSuggest}
                className="w-5 h-5 mr-2 text-secondary"
              />
              Action Library
            </h3>
            <div className="space-y-4">
              {(Object.keys(ACTION_META) as ActionType[]).map((type) => {
                const meta = ACTION_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="w-full bg-white p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-secondary/5 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
                        <Icon path={meta.iconPath} className="w-4 h-4 text-secondary" />
                      </div>
                      <span className="text-label-md text-primary">
                        {meta.label}
                      </span>
                    </div>
                    <Icon
                      path={ICON_PATHS.chevronRight}
                      className="w-3 h-3 text-on-surface-variant group-hover:translate-x-1 transition-transform"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fail-Safe Log */}
          <div className="bg-surface-container-highest p-8 rounded-full ghost-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-md text-secondary">
                Fail-Safe Log
              </span>
              <Icon path={ICON_PATHS.info} className="w-4 h-4 text-on-surface-variant" />
            </div>
            <div className="space-y-3 text-[11px] font-mono text-on-surface-variant">
              <div className="flex justify-between border-b border-outline-variant/10 pb-2">
                <span>Latent Integrity:</span>
                <span className="text-primary font-bold">
                  {scenario?.latentIntegrity ?? 100}% Verified
                </span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/10 pb-2">
                <span>Sync Hash:</span>
                <span className="text-primary font-bold">
                  {shortHash(scenario?.syncHash ?? "init")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Trigger Protocol:</span>
                <span className="text-primary font-bold">
                  {scenario?.triggerProtocol ?? "AES-256-GCM"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <AddMilestoneDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onCreate={async (params) => {
          await addStep(params);
        }}
      />
    </div>
  );
}

function AddMilestoneDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (params: {
    triggerValue: number;
    label: string;
    category: StepCategory;
    actions: Array<{ actionType: ActionType; config: string }>;
  }) => Promise<void>;
}) {
  const [triggerValue, setTriggerValue] = useState<number>(7);
  const [label, setLabel] = useState("Primary Outreach Phase");
  const [category, setCategory] =
    useState<StepCategory>("primary_outreach");
  const [selectedActions, setSelectedActions] = useState<Set<ActionType>>(
    new Set<ActionType>(["send_message"])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleAction(type: ActionType) {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || selectedActions.size === 0) {
      setError("Provide a label and at least one action.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({
        triggerValue,
        label: label.trim(),
        category,
        actions: Array.from(selectedActions).map((actionType) => ({
          actionType,
          config: "{}",
        })),
      });
      onOpenChange(false);
      setLabel("Primary Outreach Phase");
      setCategory("primary_outreach");
      setSelectedActions(new Set<ActionType>(["send_message"]));
      setTriggerValue(7);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add milestone."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div>
            <DialogTitle>Add Trigger Milestone</DialogTitle>
            <DialogDescription>
              Pick when in the inactivity window this milestone fires and which actions execute.
            </DialogDescription>
          </div>
          <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
            <Icon path={ICON_PATHS.close} />
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-5 flex-1 overflow-y-auto min-h-0">
          <ErrorAlert message={error} />

          <div className="space-y-2">
            <Label>Trigger window</Label>
            <Select<string>
              value={String(triggerValue)}
              onValueChange={(v) => setTriggerValue(Number(v))}
              placeholder="Inactivity threshold"
            >
              {TRIGGER_PRESETS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  T+{d} days
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Milestone label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Phase</Label>
            <Select<string>
              value={category}
              onValueChange={(v) => setCategory(v as StepCategory)}
              placeholder="Phase"
            >
              {(Object.keys(CATEGORY_LABELS) as StepCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Actions</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(ACTION_META) as ActionType[]).map((type) => {
                const meta = ACTION_META[type];
                const selected = selectedActions.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleAction(type)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all cursor-pointer",
                      selected
                        ? "border-secondary bg-secondary/10"
                        : "border-outline-variant/30 hover:border-secondary/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon path={meta.iconPath} className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{meta.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving}
              className="flex-1 cursor-pointer"
            >
              {saving ? "Adding..." : "Add Milestone"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
