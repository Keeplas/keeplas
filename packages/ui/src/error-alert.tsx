import { cn } from "./lib/utils";

export function ErrorAlert({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "mb-6 p-3 rounded-xl bg-error-container text-on-error-container text-sm",
        className
      )}
    >
      {message}
    </div>
  );
}
