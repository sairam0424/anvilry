/**
 * Pure command-history index walk for the terminal's ↑/↓ recall.
 *
 * Extracted from the hook so the boundary arithmetic (the error-prone part) is unit
 * testable without a DOM. The caller holds the index in a ref and the history in a
 * ref; this function never mutates — it returns the next index and the value to put
 * in the input (or `null` to ignore the keypress and leave the index unchanged).
 *
 * Index convention: `-1` means "not browsing history" (the live input). Up from there
 * jumps to the newest entry; repeated Up walks toward the oldest and clamps at 0; Down
 * walks back toward newest and, stepping past the newest, resets to `-1` and clears.
 */
export function nextHistoryIndex(
  history: readonly string[],
  idx: number,
  dir: "up" | "down",
): { idx: number; value: string | null } {
  if (history.length === 0) return { idx, value: null };

  if (dir === "up") {
    const next = idx < 0 ? history.length - 1 : Math.max(0, idx - 1);
    return { idx: next, value: history[next] ?? "" };
  }

  // down
  if (idx < 0) return { idx, value: null }; // already at the live input — ignore
  const next = idx + 1;
  if (next >= history.length) return { idx: -1, value: "" }; // stepped past newest -> clear
  return { idx: next, value: history[next] ?? "" };
}
