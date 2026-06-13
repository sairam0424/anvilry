import type { View } from "@/components/view-context";

/** One rendered line in the scrollback. */
export type Line =
  | { kind: "in"; text: string } // echoed command (the "$ cmd" line)
  | { kind: "out"; text: string }
  | { kind: "err"; text: string }
  | { kind: "art"; text: string }; // decorative ASCII (figlet) — aria-hidden, never announced

/**
 * A command may navigate instead of (or after) printing. The SHELL executes this;
 * commands never import the router/view-context, so they stay pure + testable.
 */
export type NavAction =
  | { type: "view"; view: View } // switch the ViewProvider (classic/chat/gamified)
  | { type: "route"; href: string } // router.push (internal) — e.g. /work/<slug>
  | { type: "external"; href: string } // window.open — e.g. a resume PDF / repo
  | { type: "clear" }; // clear the scrollback

export type CommandResult = { lines: Line[]; nav?: NavAction };

/** What a command can read at run time (no React, no async). */
export type CommandContext = {
  /** the registry, so `help` and autocomplete can enumerate commands */
  registry: Record<string, Command>;
};

export type Command = {
  name: string;
  description: string; // shown by `help`
  usage?: string; // e.g. "open <slug>"
  /** Pure: given args + ctx, return lines to print and/or a nav action. */
  run: (args: string[], ctx: CommandContext) => CommandResult;
};

export type Theme = "cyan" | "green" | "amber";
