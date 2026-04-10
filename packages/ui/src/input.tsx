import * as React from "react";
import { cn } from "./lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl bg-surface-container-low px-4 py-2 text-base text-on-surface placeholder:text-on-surface-variant/60 focus:bg-surface-container-high focus:outline-none focus:border focus:border-secondary/15 disabled:cursor-not-allowed disabled:opacity-60 border border-transparent transition-colors",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
