/**
 * Server-side email helpers. Normalization keeps the `users.email` index and
 * auth-account ids consistent (lowercased, trimmed) across signup, linking and
 * recovery. The format check is a guardrail only — full validation happens in
 * the UI.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string | undefined): boolean {
  if (!email) return false;
  return EMAIL.test(email.trim());
}
