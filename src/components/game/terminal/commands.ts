import { allWork, allProjects, getWork, getProject } from "@/lib/content";
import { bootBanner } from "./boot-banner";
import type { Command, CommandResult, Line } from "./types";

const out = (...text: string[]): Line[] => text.map((t) => ({ kind: "out" as const, text: t }));
const err = (text: string): Line[] => [{ kind: "err", text }];

const help: Command = {
  name: "help",
  description: "list available commands",
  run: (_args, ctx) => ({
    lines: out(
      "Available commands:",
      ...Object.values(ctx.registry).map(
        (c) => `  ${(c.usage ?? c.name).padEnd(16)} ${c.description}`,
      ),
    ),
  }),
};

const whoami: Command = {
  name: "whoami",
  description: "who is Sairam (boot banner)",
  run: () => ({ lines: bootBanner().map((t) => ({ kind: "out", text: t })) }),
};

const ls: Command = {
  name: "ls",
  description: "list systems",
  usage: "ls [work|projects]",
  run: (args) => {
    const which = (args[0] ?? "").toLowerCase();
    if (which === "work") {
      return { lines: out(...allWork.map((w) => `  ${w.slug.padEnd(22)} ${w.name}`)) };
    }
    if (which === "projects") {
      return { lines: out(...allProjects.map((p) => `  ${p.slug.padEnd(22)} ${p.name}`)) };
    }
    return {
      lines: out(
        "work/",
        ...allWork.map((w) => `  ${w.slug.padEnd(22)} ${w.name}`),
        "projects/",
        ...allProjects.map((p) => `  ${p.slug.padEnd(22)} ${p.name}`),
      ),
    };
  },
};

const open: Command = {
  name: "open",
  description: "open a system's dossier page",
  usage: "open <slug>",
  run: (args) => {
    const slug = args[0];
    if (!slug) return { lines: err("usage: open <slug>  (try 'ls')") };
    const target = getWork(slug) ?? getProject(slug);
    if (!target) return { lines: err(`not found: ${slug}  (try 'ls')`) };
    return { lines: out(`opening ${target.name} …`), nav: { type: "route", href: target.url } };
  },
};

const classic: Command = {
  name: "classic",
  description: "switch to the classic view",
  run: () => ({ lines: out("switching to classic view …"), nav: { type: "view", view: "classic" } }),
};

const clear: Command = {
  name: "clear",
  description: "clear the screen",
  run: () => ({ lines: [], nav: { type: "clear" } }),
};

/** Ordered registry — insertion order drives `help` + autocomplete listing. */
export const COMMANDS: Record<string, Command> = { help, whoami, ls, open, classic, clear };

export function runCommand(raw: string): CommandResult {
  const trimmed = raw.trim();
  if (!trimmed) return { lines: [] };
  const [name, ...args] = trimmed.split(/\s+/);
  const cmd = COMMANDS[name.toLowerCase()];
  const echo: Line = { kind: "in", text: `$ ${trimmed}` };
  if (!cmd) {
    return { lines: [echo, { kind: "err", text: `command not found: ${name}  (try 'help')` }] };
  }
  const result = cmd.run(args, { registry: COMMANDS });
  return { lines: [echo, ...result.lines], nav: result.nav };
}

/** Command names for autocomplete. */
export const COMMAND_NAMES = Object.keys(COMMANDS);
