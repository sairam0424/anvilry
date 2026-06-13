import { describe, it, expect } from "vitest";
import { completeCommand } from "./completion";
import { COMMAND_NAMES } from "./commands";

/**
 * Tab-autocomplete branches. Uses the REAL registry names so the single/multi-match
 * cases stay honest as commands are added: `h` is unique (help), `c` is ambiguous
 * (cat/chat/classic/clear), `zzz` matches nothing.
 */
describe("completeCommand", () => {
  it("completes a unique prefix and appends a trailing space", () => {
    expect(completeCommand("h", COMMAND_NAMES)).toBe("help ");
    expect(completeCommand("w", COMMAND_NAMES)).toBe("whoami ");
  });

  it("is case-insensitive on the prefix", () => {
    expect(completeCommand("HE", COMMAND_NAMES)).toBe("help ");
  });

  it("returns null for an ambiguous prefix (multiple matches — no guessing)", () => {
    // c -> cat, chat, classic, clear
    expect(completeCommand("c", COMMAND_NAMES)).toBeNull();
    // t -> tree, theme
    expect(completeCommand("t", COMMAND_NAMES)).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(completeCommand("zzz", COMMAND_NAMES)).toBeNull();
  });

  it("only completes the command word — not args (more than one token)", () => {
    expect(completeCommand("open mind", COMMAND_NAMES)).toBeNull();
    expect(completeCommand("ls ", COMMAND_NAMES)).toBeNull(); // trailing space => 2 tokens
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(completeCommand("", COMMAND_NAMES)).toBeNull();
    expect(completeCommand("   ", COMMAND_NAMES)).toBeNull();
  });

  it("a full exact command name is still a unique match (completes itself + space)", () => {
    expect(completeCommand("help", COMMAND_NAMES)).toBe("help ");
  });
});
