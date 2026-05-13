"use client";

import * as React from "react";
import * as ProgressPrimitives from "@radix-ui/react-progress";
import { cn } from "./lib/utils";

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitives.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  const percentage = Math.min(Math.max(((value ?? 0) / max) * 100, 0), 100);
  return (
    <ProgressPrimitives.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface-container-highest",
        className,
      )}
      value={value}
      max={max}
      {...props}
    >
      <ProgressPrimitives.Indicator
        className="h-full rounded-full gradient-signature transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </ProgressPrimitives.Root>
  );
});
Progress.displayName = ProgressPrimitives.Root.displayName;

export { Progress };
