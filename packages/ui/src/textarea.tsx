import * as React from "react";
import { cn } from "./lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none resize-none disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
