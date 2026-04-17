"use client";

export function BillingSection() {
  return (
    <section
      id="billing"
      className="scroll-mt-32 bg-primary text-on-primary rounded-2xl p-6 md:p-10 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-52 h-52 bg-secondary opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-3 max-w-xl">
          <span className="inline-flex items-center px-3 py-1 bg-on-primary/10 backdrop-blur rounded-full text-[10px] font-bold font-headline uppercase tracking-widest ghost-border">
            Current Tier
          </span>
          <h2 className="text-2xl md:text-3xl font-headline font-black tracking-tight">
            Pro Legacy Curator
          </h2>
          <p className="text-on-primary/70 leading-relaxed text-sm">
            You are currently utilizing the Pro tier, which includes 50GB encrypted storage, unlimited heirs, and automated Life Checks.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="p-5 bg-on-primary/5 backdrop-blur rounded-xl ghost-border min-w-[160px]">
            <p className="text-[10px] uppercase tracking-widest text-secondary-fixed font-bold mb-1">
              Renewal Date
            </p>
            <p className="text-lg font-headline font-bold">—</p>
            <p className="text-[10px] text-on-primary/50 mt-1 uppercase tracking-widest">
              Free plan active
            </p>
          </div>
          <button className="bg-secondary-fixed text-on-secondary-fixed px-6 py-3 rounded-xl font-headline font-extrabold uppercase tracking-widest text-[11px] hover:bg-secondary-fixed-dim transition-colors cursor-pointer">
            Upgrade Plan
          </button>
        </div>
      </div>
    </section>
  );
}
