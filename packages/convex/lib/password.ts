// Server-side password policy — the authoritative gate. The client renders a
// matching live strength meter (`packages/ui/src/password-strength.tsx`), but a
// client can be bypassed, so every password-creation boundary (signup +
// recovery reset) MUST run this. Keep the five rules in sync with the UI copy.

export const PASSWORD_MIN_LENGTH = 8;

const RULES: { test: (pw: string) => boolean; message: string }[] = [
  {
    test: (pw) => pw.length >= PASSWORD_MIN_LENGTH,
    message: `at least ${PASSWORD_MIN_LENGTH} characters`,
  },
  { test: (pw) => /[A-Z]/.test(pw), message: "an uppercase letter" },
  { test: (pw) => /[a-z]/.test(pw), message: "a lowercase letter" },
  { test: (pw) => /[0-9]/.test(pw), message: "a number" },
  { test: (pw) => /[^A-Za-z0-9]/.test(pw), message: "a special character" },
];

export function isStrongPassword(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}

/** Throws a descriptive `Error` when the password violates the policy. */
export function assertStrongPassword(password: string): void {
  const failed = RULES.filter((rule) => !rule.test(password)).map(
    (rule) => rule.message,
  );
  if (failed.length > 0) {
    throw new Error(
      `Password is too weak: it must contain ${failed.join(", ")}.`,
    );
  }
}
