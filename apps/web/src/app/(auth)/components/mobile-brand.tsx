import Image from "next/image";

export function MobileBrand() {
  return (
    <div className="absolute top-8 left-8 md:hidden flex items-center gap-2">
      <Image
        src="/assets/logo/logo.svg"
        alt="Keeplas"
        width={28}
        height={28}
      />
      <h1 className="font-headline text-primary text-2xl font-black tracking-tighter">
        Keeplas
      </h1>
    </div>
  );
}
