import { allWork, allProjects, getWork, getProject } from "@/lib/content";
import { questNodes, dossierFor, questGroups } from "@/lib/game-model";
import { buildCorpus } from "@/lib/corpus";
import { profile, skills, achievements, resumeVariants } from "@/lib/profile";
import { personal, now, hasPersonalContent, hasNow } from "@/lib/personal";
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
      // Hidden commands (the personal-reveal eggs) are dispatchable but never listed.
      ...Object.values(ctx.registry)
        .filter((c) => !c.hidden)
        .map((c) => `  ${(c.usage ?? c.name).padEnd(16)} ${c.description}`),
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
  description: "open a system's dossier (or github/linkedin/resume)",
  usage: "open <slug|github|linkedin|resume>",
  run: (args) => {
    const slug = args[0];
    if (!slug) return { lines: err("usage: open <slug>  (try 'ls', or 'open github')") };
    // Quick targets for the common recruiter destinations.
    if (slug === "github") return { lines: out(`opening ${profile.links.github} …`), nav: { type: "external", href: profile.links.github } };
    if (slug === "linkedin") return { lines: out(`opening ${profile.links.linkedin} …`), nav: { type: "external", href: profile.links.linkedin } };
    if (slug === "resume" || slug === "résumé") return { lines: out("opening /resume …"), nav: { type: "route", href: profile.links.resume } };
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

const contact: Command = {
  name: "contact",
  description: "how to reach me",
  run: () => ({
    lines: out(
      `${profile.name} — ${profile.role} @ ${profile.company}`,
      `location: ${profile.location}`,
      "",
      `email:    ${profile.email}`,
      `github:   ${profile.links.github}`,
      `linkedin: ${profile.links.linkedin}`,
      `résumé:   run 'resume' to download a variant`,
    ),
  }),
};

const email: Command = {
  name: "email",
  description: "open a mail draft",
  // Print the address as selectable text FIRST (works even if the popup is blocked /
  // for SR users), THEN attempt the mailto.
  run: () => ({
    lines: out(profile.email, "opening your mail client …"),
    nav: { type: "external", href: `mailto:${profile.email}` },
  }),
};

const social: Command = {
  name: "social",
  description: "my profiles",
  run: () => ({
    lines: out(`github:   ${profile.links.github}`, `linkedin: ${profile.links.linkedin}`),
  }),
};

const summary: Command = {
  name: "summary",
  description: "everything in one hit (identity, work, projects, skills, awards)",
  run: () => {
    const lines: Line[] = [];
    lines.push({ kind: "out", text: `${profile.name} — ${profile.role} @ ${profile.company} (${profile.tenure})` });
    lines.push({ kind: "out", text: profile.headline });
    lines.push({ kind: "out", text: "" }, { kind: "out", text: "PRODUCTION WORK" });
    for (const w of allWork) lines.push({ kind: "out", text: `  ${w.name} — ${w.register} · ${w.role}` });
    lines.push({ kind: "out", text: "" }, { kind: "out", text: "OPEN-SOURCE PROJECTS" });
    for (const p of allProjects) lines.push({ kind: "out", text: `  ${p.name} — ${p.tagline}` });
    lines.push({ kind: "out", text: "" }, { kind: "out", text: "SKILLS" });
    for (const s of skills) lines.push({ kind: "out", text: `  ${s.group}: ${s.items.join(", ")}` });
    lines.push({ kind: "out", text: "" }, { kind: "out", text: "RECOGNITION" });
    for (const a of achievements) lines.push({ kind: "out", text: `  ${a.title} — ${a.detail}` });
    lines.push({ kind: "out", text: "" }, { kind: "out", text: "→ run 'resume' to download · 'contact' to reach me" });
    return { lines };
  },
};

const career: Command = {
  name: "career",
  description: "experience, grouped by employer",
  // Group under the single Ascendion tenure. The content has NO per-item dates, so we
  // deliberately print NO per-item years — implying a chronology would be fabrication.
  run: () => {
    const lines: Line[] = [
      { kind: "out", text: `${profile.company} · ${profile.tenure}` },
      { kind: "out", text: `  ${profile.role}` },
      { kind: "out", text: "" },
    ];
    for (const w of allWork) {
      lines.push({ kind: "out", text: `  ${w.name}` });
      lines.push({ kind: "out", text: `    ${w.register} · ${w.role}` });
      if (w.metrics[0]) lines.push({ kind: "out", text: `    ${w.metrics[0].value} ${w.metrics[0].label}` });
    }
    return { lines };
  },
};

/** Frequency of each tech across all work + projects (case-insensitive, label-preserving). */
function techFrequency(): { tech: string; count: number }[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of [...allWork, ...allProjects]) {
    for (const t of item.tech) {
      const key = t.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label: t, count: 1 });
    }
  }
  return [...counts.values()]
    .map((c) => ({ tech: c.label, count: c.count }))
    .sort((a, b) => b.count - a.count || a.tech.localeCompare(b.tech));
}

const TOP_LIMIT = 12;

const find: Command = {
  name: "find",
  description: "which systems use a tech",
  usage: "find <tech>",
  run: (args) => {
    const term = args.join(" ").toLowerCase();
    if (!term) return { lines: err("usage: find <tech>  (try 'find kafka')") };
    const hits = [...allWork, ...allProjects].filter((item) =>
      item.tech.some((t) => t.toLowerCase().includes(term)),
    );
    if (hits.length === 0) return { lines: out(`no systems use "${term}"  (try 'top' for the full stack)`) };
    const header = `${hits.length} system${hits.length === 1 ? "" : "s"} use "${term}":`;
    return { lines: out(header, ...hits.map((h) => `  ${h.slug.padEnd(22)} ${h.name}`)) };
  },
};

const top: Command = {
  name: "top",
  description: "most-used tech across my work",
  run: () => {
    const freq = techFrequency();
    const shown = freq.slice(0, TOP_LIMIT);
    // Number lives in TEXT (not only a bar) so screen readers get the real value.
    const lines = out(
      `most-used tech (${freq.length} total across ${allWork.length + allProjects.length} systems):`,
      ...shown.map((f) => `  ${f.tech.padEnd(20)} ×${f.count}`),
    );
    if (freq.length > TOP_LIMIT) {
      lines.push({ kind: "out", text: `  … +${freq.length - TOP_LIMIT} more — run 'stack' for all skills` });
    }
    return { lines };
  },
};

const stats: Command = {
  name: "stats",
  description: "portfolio rollup (computed)",
  // Aggregates the boot banner does NOT already show (skip the 2K/3K user metrics).
  run: () => {
    const commits = allProjects.reduce((sum, p) => sum + (p.commits ?? 0), 0);
    const distinctTech = techFrequency().length;
    return {
      lines: out(
        `production systems:  ${allWork.length}`,
        `open-source repos:   ${allProjects.length}`,
        `OSS commits:         ${commits} (snapshot)`,
        `distinct tech:       ${distinctTech}`,
        `skill groups:        ${skills.length}`,
        `recognitions:        ${achievements.length}`,
        `résumé variants:     ${resumeVariants.length}`,
      ),
    };
  },
};

// ── Personal / "beyond the résumé" — see src/lib/personal.ts (owner-authored). ──
// `about` is ALWAYS visible (the non-secret a11y door); secret/uses/now are HIDDEN
// (discoverable via the whoami breadcrumb + console hint). All are EMPTY-SAFE: with no
// owner content they print an honest "coming soon" — never a fabricated fact.

const about: Command = {
  name: "about",
  description: "a short bio (and what else is hidden here)",
  run: () => {
    const lines: Line[] = [
      { kind: "out", text: `${profile.name} — ${profile.role} @ ${profile.company}` },
      { kind: "out", text: profile.subhead },
    ];
    if (hasPersonalContent) {
      lines.push({ kind: "out", text: "" });
      lines.push({ kind: "out", text: "there's more than the résumé here — run 'secret' for the personal side." });
    }
    return { lines };
  },
};

const secret: Command = {
  name: "secret",
  description: "the personal side (hobbies, fun facts, what I'm learning)",
  hidden: true,
  run: () => {
    if (!hasPersonalContent) {
      return { lines: out("personal notes coming soon — meanwhile, try 'whoami' or 'summary'.") };
    }
    const lines: Line[] = [];
    const section = (title: string, items: readonly string[]) => {
      if (items.length === 0) return;
      lines.push({ kind: "out", text: title });
      for (const it of items) lines.push({ kind: "out", text: `  • ${it}` });
      lines.push({ kind: "out", text: "" });
    };
    section("hobbies", personal.hobbies);
    section("fun facts", personal.funFacts);
    section("currently learning", personal.currentlyLearning);
    section("ask me about", personal.askMeAbout);
    lines.push({ kind: "out", text: "→ also try 'uses' (my toolkit) and 'now' (current focus)." });
    return { lines };
  },
};

const personalAlias: Command = { ...secret, name: "personal" };

const uses: Command = {
  name: "uses",
  description: "my editor, terminal & daily toolkit",
  hidden: true,
  run: () => {
    if (personal.uses.length === 0) {
      return { lines: out("toolkit coming soon — meanwhile, run 'stack' for my professional skills.") };
    }
    return {
      lines: personal.uses.map((g) => ({ kind: "out" as const, text: `  ${g.group}: ${g.items.join(", ")}` })),
    };
  },
};

const nowCmd: Command = {
  name: "now",
  description: "what I'm focused on right now",
  hidden: true,
  run: () => {
    if (!hasNow) return { lines: out("nothing pinned right now — run 'summary' for the full picture.") };
    const lines: Line[] = now.focus.map((f) => ({ kind: "out" as const, text: `  • ${f}` }));
    // Honest staleness line (no implied-current). Date is read at call time (client).
    const updatedMs = Date.parse(now.updated);
    if (!Number.isNaN(updatedMs)) {
      const days = Math.floor((Date.now() - updatedMs) / 86_400_000);
      const when = days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
      lines.push({ kind: "out", text: "" });
      lines.push({ kind: "out", text: days > 90 ? `(last updated ${when} — may be stale)` : `(updated ${when})` });
    }
    return { lines };
  },
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
  help, whoami, neofetch, ls, cat, tree, grep, find, top, stats, stack, awards, summary, career,
  about, resume, open, contact, email, social, chat, theme, classic, developer, clear, sudo,
  // hidden (dispatchable + tracked, but absent from help + autocomplete) — the eggs:
  secret, personal: personalAlias, uses, now: nowCmd,
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

/** Command names for autocomplete — VISIBLE commands only, so Tab never broadcasts the
 *  hidden egg commands (secret/personal/uses/now). Full dispatch still uses COMMANDS. */
export const COMMAND_NAMES = Object.entries(COMMANDS)
  .filter(([, c]) => !c.hidden)
  .map(([name]) => name);

/**
 * The canonical command word for an analytics event — PII-safe by construction. Returns
 * the registered command name (e.g. "grep", "open") or "unknown" for an unrecognized
 * first token; NEVER the raw input or its arguments, so free-text args (a searched term,
 * a typo) can't leak into analytics. Pure + unit-tested.
 */
export function commandEventName(raw: string): string {
  const first = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return first in COMMANDS ? first : "unknown";
}
