export function getInitials(
  nameOrEmail: string | null | undefined,
  maxLength = 2
): string {
  const source = (nameOrEmail ?? "").trim() || "?";
  return source
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, maxLength)
    .toUpperCase();
}
