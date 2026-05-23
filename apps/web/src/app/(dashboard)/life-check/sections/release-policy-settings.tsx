"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { HelpHint, Switch, toast } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";

const THRESHOLDS = [1, 2, 3];
const WINDOWS = [3, 7, 14];

const SELECTED_CLS =
  "flex items-center justify-center p-4 bg-secondary text-on-secondary rounded-xl shadow-lg scale-[1.03] transition-transform cursor-pointer font-headline font-bold";
const UNSELECTED_CLS =
  "flex items-center justify-center p-4 bg-surface-container-highest rounded-xl hover:scale-[1.03] transition-transform cursor-pointer font-headline font-bold text-primary";

/**
 * Stage-2 release policy editor: how many trusted contacts must confirm
 * unavailability, how long they have, and the fallback if none do. Auto-saves
 * each change (mirrors the cadence selector's pattern).
 */
export function ReleasePolicySettings() {
  const config = useQuery(api.life_check.getConfig);
  const save = useMutation(api.life_check.saveReleasePolicy);

  const [threshold, setThreshold] = useState(2);
  const [windowDays, setWindowDays] = useState(7);
  const [releaseAnyway, setReleaseAnyway] = useState(true);

  // Seed the editable form from the server config the first time it resolves
  // (and again if it changes), without an effect. Tracking the seeded source
  // and adjusting during render is the React-blessed alternative to a
  // setState-in-effect sync.
  const [seededFrom, setSeededFrom] = useState(config);
  if (config && config !== seededFrom) {
    setSeededFrom(config);
    setThreshold(config.confirmationThreshold ?? 2);
    setWindowDays(config.confirmationWindowDays ?? 7);
    setReleaseAnyway(
      (config.fallbackBehavior ?? "release_anyway") === "release_anyway",
    );
  }

  if (config === null) return null;

  async function persist(values: {
    threshold: number;
    windowDays: number;
    releaseAnyway: boolean;
  }) {
    try {
      await save({
        confirmationThreshold: values.threshold,
        confirmationWindowDays: values.windowDays,
        fallbackBehavior: values.releaseAnyway ? "release_anyway" : "abort",
      });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, "Failed to save release policy"),
      });
    }
  }

  return (
    <section className="bg-surface-container-low rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-headline-sm text-primary mb-1.5 flex items-center gap-2">
          Release policy
          <HelpHint content="If you stop responding to check-ins, your trusted contacts are asked to confirm you're unavailable before anything is released. Set how many must confirm, how long they have, and what happens if none do." />
        </h3>
        <p className="text-body-md text-on-surface-variant">
          The human safeguard before your vault is ever released.
        </p>
      </div>

      <div>
        <p className="text-label-md text-on-surface-variant mb-2 flex items-center gap-1.5">
          Contacts that must confirm you&apos;re unavailable
          <HelpHint content="The minimum number of trusted contacts who must independently confirm they can't reach you before your vault can be released. A higher number guards against any single contact acting alone." />
        </p>
        <div className="grid grid-cols-3 gap-3">
          {THRESHOLDS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setThreshold(n);
                void persist({ threshold: n, windowDays, releaseAnyway });
              }}
              className={threshold === n ? SELECTED_CLS : UNSELECTED_CLS}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-label-md text-on-surface-variant mb-2 flex items-center gap-1.5">
          Days they have to confirm
          <HelpHint content="How long your trusted contacts have to reach the required number once Keeplas alerts them. This is separate from the fixed 72-hour grace window you get to cancel the release after they confirm." />
        </p>
        <div className="grid grid-cols-3 gap-3">
          {WINDOWS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setWindowDays(n);
                void persist({ threshold, windowDays: n, releaseAnyway });
              }}
              className={windowDays === n ? SELECTED_CLS : UNSELECTED_CLS}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 pt-1">
        <div>
          <p className="text-body-md font-bold text-primary">
            Release anyway if no one confirms
          </p>
          <p className="text-label-md text-on-surface-variant">
            {releaseAnyway
              ? "Recommended: if no contact confirms, your vault is still released after the window, so your recipients are reached."
              : "If no contact confirms, nothing is released."}
          </p>
        </div>
        <Switch
          checked={releaseAnyway}
          onCheckedChange={(next) => {
            setReleaseAnyway(next);
            void persist({ threshold, windowDays, releaseAnyway: next });
          }}
        />
      </div>
    </section>
  );
}
