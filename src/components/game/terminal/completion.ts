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
