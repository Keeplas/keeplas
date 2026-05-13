import * as React from "react";
import { cn } from "./lib/utils";

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  path: string;
  filled?: boolean;
  strokeWidth?: number;
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className, path, filled = false, strokeWidth = 1.5, ...props }, ref) => {
    if (filled) {
      return (
        <svg
          ref={ref}
          className={cn("w-5 h-5", className)}
          fill="currentColor"
          viewBox="0 0 24 24"
          {...props}
        >
          <path d={path} />
        </svg>
      );
    }
    return (
      <svg
        ref={ref}
        className={cn("w-5 h-5", className)}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        {...props}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    );
  },
);
Icon.displayName = "Icon";

export { Icon };
