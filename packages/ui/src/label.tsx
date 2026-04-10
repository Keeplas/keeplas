import * as React from "react";
import { cn } from "./lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
