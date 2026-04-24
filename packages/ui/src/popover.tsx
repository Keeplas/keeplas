"use client";

import * as React from "react";
import * as PopoverPrimitives from "@radix-ui/react-popover";
import { cn } from "./lib/utils";

const Popover = PopoverPrimitives.Root;
const PopoverTrigger = PopoverPrimitives.Trigger;
const PopoverAnchor = PopoverPrimitives.Anchor;

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitives.Content>
>(({ className, align = "start", sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitives.Portal>
    <PopoverPrimitives.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[60] min-w-[var(--radix-popover-trigger-width)]",
        "bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 p-1.5 font-body outline-none",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  </PopoverPrimitives.Portal>
));
PopoverContent.displayName = PopoverPrimitives.Content.displayName;

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
