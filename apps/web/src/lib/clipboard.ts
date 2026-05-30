/**
 * Clipboard helpers for sensitive secrets (recovery phrase, TOTP secret).
 *
 * Copying a secret to the OS clipboard leaves it readable by any app or page
 * that reads the clipboard until it is overwritten. We can't guarantee a wipe
 * (the user may copy something else, or the browser may deny clipboard reads),
 * so this is a best-effort hardening: after a short delay we clear the clipboard
 * only if it still holds the exact value we wrote.
 */

/** Default auto-clear delay for copied secrets. */
export const SECRET_CLIPBOARD_CLEAR_MS = 60_000;

/**
 * Copy a secret to the clipboard and schedule a best-effort auto-clear.
 *
 * The clipboard is only cleared if, at the timeout, it still contains the same
 * value — so we never wipe something the user copied afterwards. Clipboard
 * read/write can reject (permissions, unfocused document); all failures are
 * swallowed since this is hardening, not a guarantee.
 */
export async function copySecretWithAutoClear(
  value: string,
  clearAfterMs: number = SECRET_CLIPBOARD_CLEAR_MS,
): Promise<void> {
  await navigator.clipboard.writeText(value);
  setTimeout(() => {
    void (async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === value) {
          await navigator.clipboard.writeText("");
        }
      } catch {
        // Reading or writing the clipboard may be denied — non-fatal.
      }
    })();
  }, clearAfterMs);
}
