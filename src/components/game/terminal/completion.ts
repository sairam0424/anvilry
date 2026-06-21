/**
 * Terminal completion — prefix Tab autocomplete (original) + fuzzy suggestions
 * (new, for the dropdown overlay while typing).
 */

/**
 * Pure Tab-autocomplete for the terminal input. Extracted from the hook so its three
 * branches are unit-testable without React/DOM: it only completes the FIRST (command)
 * word, and only when exactly one command matches the prefix — multiple or zero matches
 * leave the input alone (return null) rather than guessing.
 */
export function completeCommand(value: string, names: readonly string[]): string | null {
  const parts = value.split(/\s+/);
  if (parts.length !== 1 || !parts[0]) return null; // only complete the lone command word
  const prefix = parts[0].toLowerCase();
  const matches = names.filter((n) => n.startsWith(prefix));
  return matches.length === 1 ? matches[0] + " " : null;
}

/**
 * Fuzzy match score: how well does `query` match `candidate`?
 * Uses a simple character-subsequence algorithm — all chars of query must appear
 * in candidate in order. Score favors prefix matches and contiguous runs.
 * Returns null if no match, or a numeric score (higher = better match).
 */
export function fuzzyScore(query: string, candidate: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  // Exact prefix match gets highest score
  if (c.startsWith(q)) return 1000 - c.length;

  // Subsequence match
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -1;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      // Bonus for contiguous run
      score += lastMatchIdx === ci - 1 ? 10 : 1;
      lastMatchIdx = ci;
      qi++;
    }
  }
  if (qi < q.length) return null; // not all chars matched
  return score;
}

export interface Suggestion {
  name: string;
  description: string;
}

/**
 * Get ranked fuzzy suggestions for the current input.
 * Only suggests when typing the first (command) word — no suggestions for args.
 * Returns up to `limit` results ranked by fuzzy score, highest first.
 */
export function getSuggestions(
  input: string,
  commands: readonly Suggestion[],
  limit = 5,
): Suggestion[] {
  const parts = input.trim().split(/\s+/);
  if (parts.length > 1) return []; // don't suggest for arg position
  const query = parts[0] ?? "";
  if (!query) return [];

  const scored = commands
    .map((cmd) => ({ cmd, score: fuzzyScore(query, cmd.name) }))
    .filter((x): x is { cmd: Suggestion; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.cmd);
}
