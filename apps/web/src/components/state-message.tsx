import type { ReactNode } from "react";
import { cn, Icon } from "@keeplas/ui";

const TONE_CLASS = {
  neutral: "bg-bg-info text-text-primary",
  warning: "bg-status-pending/15 text-status-pending",
  success: "bg-status-active/15 text-status-active",
} as const;

interface StateMessageProps {
  icon: string;
  tone?: keyof typeof TONE_CLASS;
  title: string;
  body: ReactNode;
  /** Actions under the body (Figma: one full-width primary button). */
  children?: ReactNode;
}

/** Figma "State Message": icon in a tinted circle, title, body, actions. */
export function StateMessage({
  icon,
  tone = "neutral",
  title,
  body,
  children,
}: StateMessageProps) {
  return (
    <div className="flex w-full max-w-[456px] flex-col items-center gap-[12px] rounded-lg px-[20px] pb-[32px] pt-[40px] text-center">
      <div
        className={cn(
          "mb-[4px] flex size-[80px] items-center justify-center rounded-full",
          TONE_CLASS[tone],
        )}
      >
        <Icon path={icon} className="size-[35px]" />
      </div>
      <h1 className="text-h2 text-text-primary">{title}</h1>
      <p className="text-body text-text-muted">{body}</p>
      {children ? (
        <div className="mt-[8px] flex w-full flex-col items-center gap-[12px]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
