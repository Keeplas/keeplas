import * as React from "react";
import { cn } from "./lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => {
  return (
    <select
      className={cn(
        "w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Select.displayName = "Select";

export { Select };
