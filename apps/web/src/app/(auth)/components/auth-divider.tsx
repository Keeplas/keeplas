export function AuthDivider() {
  return (
    <div className="flex items-center gap-4 my-10">
      <div className="flex-1 h-px bg-outline-variant/15" />
      <span className="font-label text-[10px] uppercase tracking-widest text-outline-variant">
        Authorized via
      </span>
      <div className="flex-1 h-px bg-outline-variant/15" />
    </div>
  );
}
