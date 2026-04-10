import * as React from "react";
import { cn } from "./lib/utils";

const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
  }
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0",
        orientation === "horizontal" ? "h-8 w-full" : "w-8 h-full",
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = "Separator";

export { Separator };
