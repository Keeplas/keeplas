"use client";

import * as React from "react";
import { cn } from "./lib/utils";

const SIZE_PX = {
  sm: 24,
  md: 48,
  lg: 80,
  xl: 128,
} as const;

export interface LoaderProps {
  size?: keyof typeof SIZE_PX;
  label?: string;
  className?: string;
  fullscreen?: boolean;
}

export function Loader({
  size = "lg",
  label,
  className,
  fullscreen = false,
}: LoaderProps) {
  const px = SIZE_PX[size];

  const content = (
    <div
      className={cn(
        "flex min-h-[70vh] w-full flex-col items-center justify-center gap-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <KeeplasLogoMark
        width={px}
        height={px}
        className="keeplas-loader-breathe"
      />

      {label && (
        <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
      )}

      <style>{`
        @keyframes keeplas-loader-breathe {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        .keeplas-loader-breathe {
          animation: keeplas-loader-breathe 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}

interface KeeplasLogoMarkProps {
  width?: number;
  height?: number;
  className?: string;
}

// Keeplas symbol (PRD/v2-mobile-first/design-kit/svg/logo/keeplas-symbole.svg).
// Colors bind to semantic tokens: navy shield on light, cream shield on dark.
export const KeeplasLogoMark = React.forwardRef<
  SVGSVGElement,
  KeeplasLogoMarkProps
>(({ width = 40, height = 40, className }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={width}
    height={height}
    className={className}
    aria-hidden
    focusable={false}
  >
    <path
      d="M24 3 6 9.5v12c0 11 7.6 19.6 18 23.5 10.4-3.9 18-12.5 18-23.5v-12z"
      className="fill-text-primary"
    />
    <path
      d="M24 8.6 10.6 13.4v8.2c0 8.6 5.7 15.5 13.4 18.8 7.7-3.3 13.4-10.2 13.4-18.8v-8.2z"
      fill="none"
      strokeOpacity={0.35}
      strokeWidth={1}
      className="stroke-border-strong"
    />
    <circle
      cx={24}
      cy={22}
      r={9}
      fill="none"
      strokeWidth={1.6}
      className="stroke-border-strong"
    />
    <circle cx={24} cy={19.6} r={2.9} className="fill-border-strong" />
    <path d="M22.4 21.4h3.2l.9 7.1h-5z" className="fill-border-strong" />
  </svg>
));
KeeplasLogoMark.displayName = "KeeplasLogoMark";
