"use client";

import * as React from "react";
import * as SeparatorPrimitives from "@radix-ui/react-separator";
import { cn } from "./lib/utils";

const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitives.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref,
  ) => (
    <SeparatorPrimitives.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-surface-container-highest",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = SeparatorPrimitives.Root.displayName;

export { Separator };
