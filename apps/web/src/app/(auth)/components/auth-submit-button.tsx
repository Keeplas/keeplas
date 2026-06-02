import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button, cn } from "@keeplas/ui";

interface AuthSubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function AuthSubmitButton({
  className,
  children,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant="vault"
      size="xl"
      className={cn("w-full group", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
