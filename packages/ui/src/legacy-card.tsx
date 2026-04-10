import * as React from "react";
import { cn } from "./lib/utils";

/**
 * Legacy Card — High-contrast block for pinned/vital information.
 * Uses primary-container background as visual anchor per design guidelines.
 */
const LegacyCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-full bg-primary-container p-6 text-on-primary-container",
      className
    )}
    {...props}
  />
));
LegacyCard.displayName = "LegacyCard";

const LegacyCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-headline text-xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
LegacyCardTitle.displayName = "LegacyCardTitle";

export { LegacyCard, LegacyCardTitle };
