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
  const ringSize = px + Math.max(16, Math.round(px * 0.3));

  const content = (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center gap-4",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        <span
          className="absolute inset-0 rounded-full border-2 border-secondary/15"
          aria-hidden
        />
        <span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-secondary animate-spin"
          style={{ animationDuration: "1.2s" }}
          aria-hidden
        />
        <KeeplasLogoMark
          width={px}
          height={px}
          className="keeplas-loader-breathe"
        />
      </div>

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

export const KeeplasLogoMark = React.forwardRef<
  SVGSVGElement,
  KeeplasLogoMarkProps
>(({ width = 40, height = 40, className }, ref) => {
  const gradId = React.useId();
  const shieldId = `${gradId}-shield`;
  const accentId = `${gradId}-accent`;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={width}
      height={height}
      className={className}
      aria-hidden
      focusable={false}
    >
      <defs>
        <linearGradient id={shieldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#041632" />
          <stop offset="100%" stopColor="#1b2b48" />
        </linearGradient>
        <linearGradient id={accentId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9eaff" />
          <stop offset="100%" stopColor="#28657a" />
        </linearGradient>
      </defs>
      <path
        d="M256 28 L462 120 C462 120 472 320 256 484 C40 320 50 120 50 120 Z"
        fill={`url(#${shieldId})`}
        stroke="#1b2b48"
        strokeWidth={4}
      />
      <path
        d="M256 60 L432 140 C432 140 440 310 256 452 C72 310 80 140 80 140 Z"
        fill="none"
        stroke="#28657a"
        strokeWidth={2}
        opacity={0.3}
      />
      <circle
        cx={256}
        cy={220}
        r={72}
        fill="none"
        stroke={`url(#${accentId})`}
        strokeWidth={6}
      />
      <path
        d="M256 190 C240 190 228 202 228 218 C228 230 236 240 248 244 L242 290 C242 294 245 298 250 298 L262 298 C267 298 270 294 270 290 L264 244 C276 240 284 230 284 218 C284 202 272 190 256 190Z"
        fill={`url(#${accentId})`}
      />
      <path
        d="M148 180 C148 180 130 250 160 330"
        fill="none"
        stroke="#b9eaff"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        d="M364 180 C364 180 382 250 352 330"
        fill="none"
        stroke="#b9eaff"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <rect
        x={248}
        y={100}
        width={16}
        height={16}
        rx={2}
        transform="rotate(45 256 108)"
        fill="#b9eaff"
        opacity={0.8}
      />
    </svg>
  );
});
KeeplasLogoMark.displayName = "KeeplasLogoMark";
