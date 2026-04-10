import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "gradient-signature text-on-primary shadow-sm hover:opacity-90",
        vault:
          "vault-gradient text-on-primary font-headline font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]",
        secondary:
          "bg-transparent text-secondary hover:bg-surface-container",
        outline:
          "ghost-border text-on-surface hover:bg-surface-container-high",
        ghost:
          "bg-transparent text-on-surface hover:bg-surface-container",
        destructive:
          "bg-error text-on-error hover:opacity-90",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-xl",
        md: "h-11 px-6 text-base rounded-xl",
        lg: "h-13 px-8 text-lg rounded-full",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
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
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
