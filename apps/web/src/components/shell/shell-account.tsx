import { createContext, useContext, type ReactNode } from "react";

/** The signed-in person as the shell shows them (avatar menu). */
export interface ShellAccount {
  initials: string;
  signOut: () => void;
}

const ShellAccountContext = createContext<ShellAccount | null>(null);

/**
 * Provided by the dashboard layout from the Convex viewer, and by the visual
 * harness from fixtures, so shell components never query Convex themselves.
 */
export function ShellAccountProvider({
  account,
  children,
}: {
  account: ShellAccount;
  children: ReactNode;
}) {
  return (
    <ShellAccountContext.Provider value={account}>
      {children}
    </ShellAccountContext.Provider>
  );
}

export function useShellAccount(): ShellAccount {
  const account = useContext(ShellAccountContext);
  if (!account) {
    throw new Error("useShellAccount must be used within ShellAccountProvider");
  }
  return account;
}
