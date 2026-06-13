import { allWork, allProjects, getWork, getProject } from "@/lib/content";
import { questNodes, dossierFor, questGroups } from "@/lib/game-model";
import { buildCorpus } from "@/lib/corpus";
import { skills, achievements, resumeVariants } from "@/lib/profile";
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
  run: () => ({ lines: bootBanner() }),
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

const cat: Command = {
  name: "cat",
  description: "show a system's dossier",
  usage: "cat <slug>",
  run: (args) => {
    const slug = args[0];
    if (!slug) return { lines: err("usage: cat <slug>  (try 'ls')") };
    // Bridge the CONTENT slug -> the quest node (node ids != slugs), then resolve.
    const node = questNodes.find((n) => n.resolved.item.slug === slug);
    if (!node) return { lines: err(`not found: ${slug}  (try 'ls')`) };
    const d = dossierFor(node);
    const lines: Line[] = [
      { kind: "out", text: d.name },
      { kind: "out", text: d.subtitle },
    ];
    if (d.register) lines.push({ kind: "out", text: `register: ${d.register}` });
    lines.push({ kind: "out", text: "" }, { kind: "out", text: d.blurb }, { kind: "out", text: "" });
    for (const f of d.facts) lines.push({ kind: "out", text: `  ${f.value}  ${f.label}` });
    lines.push({ kind: "out", text: `  tech: ${d.tech.join(", ")}` });
    return { lines };
  },
};

const tree: Command = {
  name: "tree",
  description: "the system graph as a tree",
  run: () => {
    const lines: Line[] = [{ kind: "out", text: "." }];
    const groups = questGroups();
    groups.forEach((g, gi) => {
      const lastG = gi === groups.length - 1;
      lines.push({ kind: "out", text: `${lastG ? "└── " : "├── "}${g.group}` });
      g.nodes.forEach((n, ni) => {
        const lastN = ni === g.nodes.length - 1;
        const pad = lastG ? "    " : "│   ";
        lines.push({ kind: "out", text: `${pad}${lastN ? "└── " : "├── "}${n.label}` });
      });
    });
    return { lines };
  },
};

const GREP_LIMIT = 30; // cap shown hits — keep the polite live region orientable

const grep: Command = {
  name: "grep",
  description: "search across my work + skills",
  usage: "grep <term>",
  run: (args) => {
    const term = args.join(" ").toLowerCase();
    if (!term) return { lines: err("usage: grep <term>") };
    const hits = buildCorpus()
      .split("\n")
      .filter((line) => line.toLowerCase().includes(term));
    if (hits.length === 0) return { lines: out(`no matches for "${term}"`) };
    // Lead with a count so screen-reader users get orientation before the burst, and
    // never truncate silently — tell the user how many were hidden (no silent swallow).
    const header = `${hits.length} match${hits.length === 1 ? "" : "es"} for "${term}":`;
    const shown = hits.slice(0, GREP_LIMIT);
    const lines = out(header, ...shown);
    if (hits.length > GREP_LIMIT) {
      lines.push({ kind: "out", text: `… +${hits.length - GREP_LIMIT} more — refine with a longer term` });
    }
    return { lines };
  },
};

const classic: Command = {
  name: "classic",
  description: "switch to the classic view",
  run: () => ({ lines: out("switching to classic view …"), nav: { type: "view", view: "classic" } }),
};

const developer: Command = {
  name: "developer",
  description: "open the full-page developer terminal",
  run: () => ({ lines: out("opening developer mode …"), nav: { type: "view", view: "developer" } }),
};

const clear: Command = {
  name: "clear",
  description: "clear the screen",
  run: () => ({ lines: [], nav: { type: "clear" } }),
};

const stack: Command = {
  name: "stack",
  description: "my skills by area",
  run: () => ({
    lines: skills.map((s) => ({ kind: "out", text: `  ${s.group}: ${s.items.join(", ")}` })),
  }),
};

const awards: Command = {
  name: "awards",
  description: "achievements & recognition",
  run: () => ({ lines: achievements.map((a) => ({ kind: "out", text: `  ${a.title} — ${a.detail}` })) }),
};

const resume: Command = {
  name: "resume",
  description: "open a résumé variant",
  usage: "resume [variant]",
  run: (args) => {
    const arg = (args[0] ?? "").toLowerCase();
    if (!arg) {
      return {
        lines: out(
          "résumé variants (resume <name>):",
          ...resumeVariants.map(
            (r) => `  ${r.label.toLowerCase().split(" ")[0].padEnd(12)} ${r.label} — ${r.tag}`,
          ),
        ),
      };
    }
    const match = resumeVariants.find((r) => r.label.toLowerCase().includes(arg));
    if (!match) return { lines: err(`no variant: ${arg}  (run 'resume')`) };
    return { lines: out(`opening ${match.label} …`), nav: { type: "external", href: match.file } };
  },
};

const chat: Command = {
  name: "chat",
  description: "ask the AI concierge",
  run: () => ({ lines: out("opening the AI concierge …"), nav: { type: "view", view: "chat" } }),
};

const neofetch: Command = { ...whoami, name: "neofetch", description: "system info (alias of whoami)" };

const sudo: Command = {
  name: "sudo",
  description: "nice try",
  run: (args) => ({
    lines: err(`sudo: ${args.join(" ") || "permission"} denied — this résumé is read-only ☺`),
  }),
};

// `theme` is intercepted by the shell hook (use-terminal.ts), which owns the cosmetic
// theme state and prints the live "theme → <next>" line. This registry entry exists so
// `help` + autocomplete list the command; its run() is only reached OUTSIDE the shell
// (e.g. a unit test or a non-interactive caller), where there is no theme to cycle — so
// it returns an honest explanation rather than a misleading "theme cycled." success.
const theme: Command = {
  name: "theme",
  description: "cycle the prompt theme (cyan/green/amber)",
  run: () => ({ lines: out("theme cycling is interactive — use the terminal prompt.") }),
};

/** Ordered registry — insertion order drives `help` + autocomplete listing. */
export const COMMANDS: Record<string, Command> = {
  help, whoami, neofetch, ls, cat, tree, grep, stack, awards, resume, open, chat, theme, classic, developer, clear, sudo,
};

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
