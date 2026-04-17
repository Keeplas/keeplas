"use client";

const ACCESS_LINKS = [
  {
    href: "/trusted-contacts",
    label: "Trusted Contacts",
    description: "Recovery partners & guardians",
  },
  {
    href: "/life-check",
    label: "Life Check Protocol",
    description: "Proof of life configuration",
  },
  {
    href: "/emergency-card",
    label: "Emergency Card",
    description: "Public safety profile",
  },
];

export function VaultAccessSection() {
  return (
    <section
      id="access"
      className="scroll-mt-32 grid grid-cols-1 md:grid-cols-12 gap-8"
    >
      <div className="md:col-span-4 space-y-3">
        <h2 className="text-primary font-headline text-xl font-bold tracking-tight">
          Vault Access
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Manage who may reach your vault in an emergency, and review access history.
        </p>
      </div>
      <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ACCESS_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between hover:bg-surface-container transition-colors group"
          >
            <div>
              <p className="font-headline font-bold text-primary">
                {link.label}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {link.description}
              </p>
            </div>
            <svg
              className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </a>
        ))}
        <div className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between opacity-60">
          <div>
            <p className="font-headline font-bold text-primary">
              Access Audit Log
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Coming soon</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Soon
          </span>
        </div>
      </div>
    </section>
  );
}
