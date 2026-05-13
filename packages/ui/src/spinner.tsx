import { cn } from "./lib/utils";

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-8 h-8",
} as const;

export function Spinner({
  size = "lg",
  className,
}: {
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full border-2 border-secondary border-t-transparent animate-spin",
        sizeClasses[size],
        className,
      )}
    />
  );
}
