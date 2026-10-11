import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "gradient-signature text-on-primary shadow-sm hover:opacity-90",
        vault:
          "vault-gradient text-on-primary font-headline font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]",
        secondary: "bg-transparent text-secondary hover:bg-surface-container",
        outline: "ghost-border text-on-surface hover:bg-surface-container-high",
        ghost: "bg-transparent text-on-surface hover:bg-surface-container",
        destructive: "bg-error text-on-error hover:opacity-90",
        // v2 (Figma "Button"): semantic tokens, light + dark.
        primary:
          "bg-action-primary text-text-inverse hover:bg-action-primary-hover focus-visible:ring-border-focus",
        outlined:
          "border-[1.5px] border-action-primary bg-bg-surface text-action-primary hover:bg-bg-subtle focus-visible:ring-border-focus",
        link: "text-text-link hover:underline underline-offset-4 focus-visible:ring-border-focus",
        danger:
          "border border-action-danger bg-bg-surface text-action-danger hover:bg-bg-danger focus-visible:ring-border-focus",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-xs",
        md: "h-11 px-6 text-base rounded-xs",
        lg: "h-13 px-8 text-lg rounded-sm",
        xl: "h-14 px-8 text-base rounded-xs",
        icon: "h-10 w-10 rounded-xs",
        // v2 full-height action (Figma: 52 px, radius md, Button type).
        cta: "h-[52px] px-6 text-button font-semibold rounded-md",
        // v2 "Small button" (Figma: 36 px, 8/14 padding, 13/18 semibold, radius 10).
        compact:
          "h-9 gap-[6px] px-[14px] text-[13px] leading-[18px] font-semibold rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
