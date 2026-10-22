import * as React from "react";
import { cn } from "./lib/utils";

const VARIANTS = {
  default:
    "w-full bg-surface-container-low border border-outline-variant rounded-xs px-4 py-3 text-on-surface placeholder:text-outline-variant hover:border-outline focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  // v2 web "App/Field" box (W06-3): 46 px, radius 10, thin border.
  field:
    "h-[46px] w-full rounded-sm border border-border-default bg-bg-surface px-[14px] text-[15px] leading-[22px] text-text-primary placeholder:text-text-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    variant?: keyof typeof VARIANTS;
  }
>(({ className, type, variant = "default", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(VARIANTS[variant], className)}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
