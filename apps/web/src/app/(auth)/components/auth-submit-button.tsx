"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function AuthSubmitButton({
  className,
  children,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={cn(
        "w-full vault-gradient text-on-primary font-headline font-bold py-4 rounded-xl",
        "shadow-lg shadow-primary/10 hover:shadow-primary/20",
        "hover:scale-[1.02] active:scale-[0.98] transition-all",
        "flex items-center justify-center gap-2 group",
        "disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
