// Lightweight email format guardrail for form inputs. Mirrors the server-side
// check in `@keeplas/backend` lib/email — full validation happens server-side.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | undefined): boolean {
  if (!value) return false;
  return EMAIL.test(value.trim());
}
