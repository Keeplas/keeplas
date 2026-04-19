"use client";

interface ActiveCycleBannerProps {
  status: string;
  currentLevel: number;
  onValidate: () => void;
  onPostpone: (duration: "48h" | "7d") => void;
}

export function ActiveCycleBanner({
  status,
  currentLevel,
  onValidate,
  onPostpone,
}: ActiveCycleBannerProps) {
  return (
    <div className="mb-8 bg-primary-container text-on-primary-container rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-headline-sm text-on-primary mb-1">
            Life Check Active
          </h3>
          <p className="text-body-md text-on-primary-container/90">
            {status === "running"
              ? "Please confirm you are well."
              : "Escalation in progress."}
          </p>
        </div>
        <span className="text-label-md px-3 py-1 rounded-full bg-secondary text-on-secondary">
          Level {currentLevel}
        </span>
      </div>
      <div className="flex gap-3 mt-5">
        <button
          onClick={onValidate}
          className="bg-secondary-fixed text-on-secondary-fixed font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer hover:scale-[1.02] transition-transform"
        >
          I&apos;m alive
        </button>
        <button
          onClick={() => onPostpone("48h")}
          className="bg-surface-container-lowest/10 text-on-primary border border-on-primary/20 font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer"
        >
          Postpone 48h
        </button>
      </div>
    </div>
  );
}
