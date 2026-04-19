import Image from "next/image";

export function AuthHeroSection() {
  return (
    <section className="hidden md:flex w-1/2 vault-gradient relative overflow-hidden flex-col justify-between p-16">
      {/* Decorative grain texture */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(#ffffff 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top: Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={36}
            height={36}
          />
          <h1 className="text-headline-lg text-surface-container-lowest">
            Keeplas
          </h1>
        </div>
        <div className="mb-12" />
      </div>

      {/* Center: Hero text */}
      <div className="relative z-10 max-w-lg">
        <span className="text-label-md text-secondary-fixed mb-6 block">
          The Digital Curator
        </span>
        <h2 className="text-display-lg text-surface-container-lowest mb-8">
          Secure Your <br />
          Digital Legacy.
        </h2>
        <p className="text-body-lg text-on-primary-container font-light">
          A private gallery for your most vital assets. Protected by
          architectural-grade encryption, curated for your next generation.
        </p>
      </div>

      {/* Bottom: Stats */}
      <div className="relative z-10 flex gap-12 items-center">
        <div className="flex flex-col">
          <span className="text-headline-md text-surface-container-lowest">
            AES-256
          </span>
          <span className="text-label-md text-on-primary-container">
            Encryption Standard
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-headline-md text-surface-container-lowest">
            Zero-Knowledge
          </span>
          <span className="text-label-md text-on-primary-container">
            Architecture
          </span>
        </div>
      </div>

      {/* Background blur */}
      <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] opacity-10 blur-3xl rounded-full bg-secondary-fixed pointer-events-none" />
    </section>
  );
}
