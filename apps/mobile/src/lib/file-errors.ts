export type FileProblem =
  "offline" | "missing" | "decrypt" | "space" | "unknown";

export class FileProblemError extends Error {
  constructor(
    readonly problem: FileProblem,
    message: string = problem,
  ) {
    super(message);
    this.name = "FileProblemError";
  }
}

export function classifyFileError(
  error: unknown,
  online: boolean | undefined,
): FileProblem {
  if (online === false) return "offline";
  if (error instanceof FileProblemError) return error.problem;
  if (!(error instanceof Error)) return "unknown";
  const text = `${error.name} ${error.message}`;
  if (/ENOSPC|no space|disk full|storage full/i.test(text)) return "space";
  if (
    /OperationError|decrypt|corrupted stream|auth(entication)? tag/i.test(text)
  )
    return "decrypt";
  if (/\b404\b|\b410\b|not found/i.test(text)) return "missing";
  if (
    /network|timed out|offline|internet|unable to resolve|connection/i.test(
      text,
    )
  )
    return "offline";
  return "unknown";
}

export function errorReference(now: number = Date.now()): string {
  return `ERR-${now.toString(36).toUpperCase().slice(-5)}`;
}
