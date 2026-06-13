# Terminal "Developer Mode" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Anvilry's buried 224px Play-view terminal into a prominent, accessible "Developer Mode" CLI — a ~14-command "queryable resume" grounded entirely in the existing content layer, with a fullscreen overlay, history, autocomplete, command chips, and an ASCII boot banner.

**Architecture:** Extract a pure, content-sourced **command registry** (`commands.ts`) that `help`/autocomplete/tests all derive from; a state hook (`use-terminal.ts`) owns dispatch + history; a presentational shell renders a `role="log"` aria-live output + ARIA-combobox input + chips; a Radix Dialog gives the fullscreen "beast mode". Commands return either printable `Line[]` or a `NavAction` the shell executes — so commands stay pure and unit-testable in Node. Reject xterm.js (canvas hides rows from screen readers; the bespoke DOM already uses the maintainers' recommended a11y pattern).

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · Vitest (node env) · `@radix-ui/react-dialog` (already a dep) · lucide-react.

**Branch:** `feat/terminal-dev-mode` (off latest `develop`, already created). PR → `develop` per project workflow; keep the branch.

**Content layer the commands resolve through (all existing, imported directly):**
- `@/lib/content` → `allWork`, `allProjects`, `getWork(slug)`, `getProject(slug)`, `Work`, `Project`
- `@/lib/game-model` → `questNodes`, `resolveNode(id)`, `dossierFor(node)`, `questGroups()`, `Dossier`
- `@/lib/profile` → `profile` (name, role, company, headline, email, links, githubUser, locationCity/Country), `impactMetrics`, `skills`, `achievements`, `resumeVariants`
- `@/lib/corpus` → `buildCorpus()` (the grounded text blob, for `grep`)

> Node↔slug nuance (already handled by `resolveNode`/`getWork`/`getProject`): graph node ids `aava`/`grpc`/`nhl` ≠ content slugs `aava-code`/`grpc-microservices`/`not-humans-lab`. Commands take CONTENT slugs (what `ls` prints) and use `getWork`/`getProject` directly — NOT raw node ids.

---

## File structure (decomposition)

```
src/components/game/terminal/
  types.ts            # Line, NavAction, CommandResult, CommandContext, Command, Theme
  commands.ts         # the registry: Record<string, Command> — pure, content-sourced
  commands.test.ts    # build-time coverage + anti-fabrication test (node env)
  boot-banner.ts      # ASCII whoami/neofetch banner string from profile
  use-terminal.ts     # 'use client' hook: scrollback, input, history, autocomplete, run()
  terminal.tsx        # 'use client' presentational shell (was src/components/game/terminal.tsx)
  terminal-overlay.tsx# 'use client' Radix Dialog fullscreen wrapper
```
- **Modified:** `src/components/game/game-view.tsx` (re-rank + maximize), `src/components/command-palette.tsx` (⌘K "Developer mode" entry), delete old `src/components/game/terminal.tsx` (moves into `terminal/`).
- **Reused unchanged:** `game-model.ts`, `content.ts`, `profile.ts`, `corpus.ts`, `graph-data.ts`, `globals.css`.

Each file < 500 lines. `commands.ts` is the only file likely to approach it (~14 commands); if it exceeds, split into `commands/` by group — but with ~14 small handlers it stays well under.

---

## Phase 1 — Registry-first refactor (no UX change)

Port the existing 6 commands (`help`/`ls`/`open`/`whoami`/`classic`/`clear`) into the new registry+hook+shell with identical behavior, plus a coverage test. This locks the architecture before adding features.

### Task 1: Terminal types

**Files:**
- Create: `src/components/game/terminal/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/components/game/terminal/types.ts
import type { View } from "@/components/view-context";

/** One rendered line in the scrollback. */
export type Line =
  | { kind: "in"; text: string } // echoed command (the "$ cmd" line)
  | { kind: "out"; text: string }
  | { kind: "err"; text: string };

/** A command may navigate instead of (or after) printing. The SHELL executes this;
 *  commands never import the router/view-context, so they stay pure + testable. */
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
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev && npx tsc --noEmit`
Expected: no errors (file only declares types).

- [ ] **Step 3: Commit**

```bash
git add src/components/game/terminal/types.ts
git commit -m "feat(terminal): command types for the registry refactor"
```

### Task 2: Boot banner

**Files:**
- Create: `src/components/game/terminal/boot-banner.ts`

- [ ] **Step 1: Write the banner builder (derives from profile — zero fabrication)**

```ts
// src/components/game/terminal/boot-banner.ts
import { profile, impactMetrics } from "@/lib/profile";

/** ASCII boot banner for `whoami` / `neofetch`. Every value comes from profile.ts. */
export function bootBanner(): string[] {
  const metrics = impactMetrics.map((m) => `${m.value} ${m.label} (${m.sub})`).join("  ·  ");
  return [
    "   _              _ _            ",
    "  /_\\  _ ___ _ __(_) |_ _ _ _  _ ",
    " / _ \\| ' \\ V / | | |  _| '_| || |",
    "/_/ \\_\\_||_\\_/  |_|_|\\__|_|  \\_, |",
    "                            |__/ ",
    "",
    `${profile.name} — ${profile.role} @ ${profile.company}`,
    profile.headline,
    "",
    metrics,
    `${profile.locationCity}, ${profile.locationCountry}  ·  github.com/${profile.githubUser}`,
    "",
    "Type 'help' to explore — or tap a chip below.",
  ];
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/game/terminal/boot-banner.ts
git commit -m "feat(terminal): ASCII boot banner derived from profile"
```

### Task 3: Command registry — the 6 existing commands

**Files:**
- Create: `src/components/game/terminal/commands.ts`

- [ ] **Step 1: Write the registry with the 6 ported commands**

```ts
// src/components/game/terminal/commands.ts
import { allWork, allProjects, getWork, getProject } from "@/lib/content";
import type { Command, CommandResult, Line } from "./types";
import { bootBanner } from "./boot-banner";
import { profile } from "@/lib/profile";

const out = (...text: string[]): Line[] => text.map((t) => ({ kind: "out" as const, text: t }));
const err = (text: string): Line[] => [{ kind: "err", text }];

const help: Command = {
  name: "help",
  description: "list available commands",
  run: (_args, ctx) => ({
    lines: out(
      "Available commands:",
      ...Object.values(ctx.registry).map((c) => `  ${(c.usage ?? c.name).padEnd(16)} ${c.description}`),
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
    if (which === "work") return { lines: out(...allWork.map((w) => `  ${w.slug.padEnd(22)} ${w.name}`)) };
    if (which === "projects") return { lines: out(...allProjects.map((p) => `  ${p.slug.padEnd(22)} ${p.name}`)) };
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
export const COMMANDS: Record<string, Command> = {
  help, whoami, ls, cat: undefined as never, open, classic, clear,
};
// NOTE: `cat` placeholder removed in P2; for P1 delete the cat key entirely:
delete (COMMANDS as Record<string, unknown>).cat;

export function runCommand(raw: string): CommandResult {
  const trimmed = raw.trim();
  if (!trimmed) return { lines: [] };
  const [name, ...args] = trimmed.split(/\s+/);
  const cmd = COMMANDS[name.toLowerCase()];
  const echo: Line = { kind: "in", text: `$ ${trimmed}` };
  if (!cmd) return { lines: [echo, { kind: "err", text: `command not found: ${name}  (try 'help')` }] };
  const result = cmd.run(args, { registry: COMMANDS });
  return { lines: [echo, ...result.lines], nav: result.nav };
}

/** Command names for autocomplete. */
export const COMMAND_NAMES = Object.keys(COMMANDS);
export { profile };
```

> Clean up the messy `cat` placeholder: write `COMMANDS` with only the 6 real keys (`help, whoami, ls, open, classic, clear`) and drop the `delete` line. The placeholder above is illustrative — the engineer should write the clean 6-key object.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/game/terminal/commands.ts
git commit -m "feat(terminal): command registry with the 6 existing commands"
```

### Task 4: Registry coverage + anti-fabrication test

**Files:**
- Create: `src/components/game/terminal/commands.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/components/game/terminal/commands.test.ts
import { describe, it, expect } from "vitest";
import { COMMANDS, runCommand, COMMAND_NAMES } from "./commands";
import { allWork, allProjects } from "@/lib/content";

describe("terminal command registry", () => {
  it("help lists every registered command (single source of truth)", () => {
    const res = runCommand("help");
    const text = res.lines.map((l) => l.text).join("\n");
    for (const name of COMMAND_NAMES) expect(text).toContain(name);
  });

  it("unknown command fails closed with a hint", () => {
    const res = runCommand("doesnotexist");
    expect(res.lines.some((l) => l.kind === "err" && /command not found/.test(l.text))).toBe(true);
  });

  it("ls lists real work + project slugs only", () => {
    const text = runCommand("ls").lines.map((l) => l.text).join("\n");
    for (const w of allWork) expect(text).toContain(w.slug);
    for (const p of allProjects) expect(text).toContain(p.slug);
  });

  it("open resolves a real slug to its route, rejects a fake one", () => {
    const real = allWork[0].slug;
    const ok = runCommand(`open ${real}`);
    expect(ok.nav).toEqual({ type: "route", href: `/work/${real}` });
    const bad = runCommand("open totally-fake-slug");
    expect(bad.nav).toBeUndefined();
    expect(bad.lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("clear returns a clear nav action", () => {
    expect(runCommand("clear").nav).toEqual({ type: "clear" });
  });

  it("classic switches view", () => {
    expect(runCommand("classic").nav).toEqual({ type: "view", view: "classic" });
  });
});
```

- [ ] **Step 2: Run — verify it passes**

Run: `pnpm test`
Expected: this file PASSES alongside the existing 24 tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/game/terminal/commands.test.ts
git commit -m "test(terminal): registry coverage + anti-fabrication (help lists all, slugs real, fail-closed)"
```

### Task 5: Terminal state hook

**Files:**
- Create: `src/components/game/terminal/use-terminal.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/components/game/terminal/use-terminal.ts
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useView } from "@/components/view-context";
import { runCommand, COMMAND_NAMES } from "./commands";
import { bootBanner } from "./boot-banner";
import type { Line } from "./types";

const greeting: Line[] = bootBanner().map((t) => ({ kind: "out", text: t }));

export function useTerminal() {
  const router = useRouter();
  const { setView } = useView();
  const [lines, setLines] = useState<Line[]>(greeting);
  const [input, setInput] = useState("");
  const history = useRef<string[]>([]); // past commands (newest last)
  const histIndex = useRef<number>(-1); // -1 = not browsing

  const run = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const { lines: newLines, nav } = runCommand(raw);
      if (trimmed) {
        history.current = [...history.current, trimmed];
        histIndex.current = -1;
      }
      if (nav?.type === "clear") {
        setLines([]);
        return;
      }
      setLines((prev) => [...prev, ...newLines]);
      if (nav?.type === "view") setView(nav.view);
      else if (nav?.type === "route") router.push(nav.href);
      else if (nav?.type === "external" && typeof window !== "undefined")
        window.open(nav.href, "_blank", "noopener,noreferrer");
    },
    [router, setView],
  );

  /** ↑/↓ history navigation; returns the value to put in the input, or null to ignore. */
  const recall = useCallback((dir: "up" | "down"): string | null => {
    const h = history.current;
    if (h.length === 0) return null;
    if (dir === "up") {
      histIndex.current = histIndex.current < 0 ? h.length - 1 : Math.max(0, histIndex.current - 1);
    } else {
      if (histIndex.current < 0) return null;
      histIndex.current = histIndex.current + 1;
      if (histIndex.current >= h.length) {
        histIndex.current = -1;
        return "";
      }
    }
    return h[histIndex.current] ?? "";
  }, []);

  /** Autocomplete: command-name prefix match on the first token. */
  const complete = useCallback((value: string): string | null => {
    const parts = value.split(/\s+/);
    if (parts.length !== 1) return null; // only complete the command word for now
    const matches = COMMAND_NAMES.filter((n) => n.startsWith(parts[0].toLowerCase()));
    return matches.length === 1 ? matches[0] + " " : null;
  }, []);

  return { lines, input, setInput, run, recall, complete };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/game/terminal/use-terminal.ts
git commit -m "feat(terminal): state hook — scrollback, history, autocomplete, nav dispatch"
```

### Task 6: Presentational shell (replaces old terminal.tsx)

**Files:**
- Create: `src/components/game/terminal/terminal.tsx`
- Delete: `src/components/game/terminal.tsx`
- Modify: `src/components/game/game-view.tsx` (update the import path)

- [ ] **Step 1: Write the shell**

```tsx
// src/components/game/terminal/terminal.tsx
"use client";

import { useRef, useEffect } from "react";
import { TerminalSquare } from "lucide-react";
import { useTerminal } from "./use-terminal";
import { cn } from "@/lib/utils";

export function Terminal({ maxHeightClass = "max-h-72" }: { maxHeightClass?: string }) {
  const { lines, input, setInput, run, recall, complete } = useTerminal();
  const histRef = useRef<HTMLDivElement>(null);

  // Pin-aware autoscroll: only follow when near the bottom.
  useEffect(() => {
    const el = histRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      const v = recall("up");
      if (v !== null) { e.preventDefault(); setInput(v); }
    } else if (e.key === "ArrowDown") {
      const v = recall("down");
      if (v !== null) { e.preventDefault(); setInput(v); }
    } else if (e.key === "Tab") {
      const c = complete(input);
      if (c) { e.preventDefault(); setInput(c); }
    }
  };

  return (
    <section aria-label="Developer mode terminal" className="overflow-hidden rounded-2xl border border-border bg-bg-base/80 font-mono text-xs">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-fg-subtle">
        <TerminalSquare size={13} className="text-accent" />
        <span>sairam@anvilry</span>
        <span className="ml-auto text-[10px]">keyboard-native · type 'help'</span>
      </div>
      <div ref={histRef} className={cn("space-y-1 overflow-y-auto px-4 py-3", maxHeightClass)} role="log" aria-live="polite" aria-atomic="false">
        {lines.map((l, i) => (
          <pre key={i} className={l.kind === "in" ? "whitespace-pre-wrap text-accent" : l.kind === "err" ? "whitespace-pre-wrap text-amber" : "whitespace-pre-wrap text-fg-muted"}>
            {l.text}
          </pre>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); run(input); setInput(""); }} className="flex items-center gap-2 border-t border-border px-4 py-2">
        <span className="text-accent" aria-hidden="true">{">"}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="type a command — e.g. ls, open mindforge, whoami"
          aria-label="Terminal command input"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="no-focus-ring flex-1 bg-transparent py-1 text-fg outline-none placeholder:text-fg-subtle"
        />
      </form>
    </section>
  );
}
```

> Reuse the `no-focus-ring` class added in the cmdk fix so the input doesn't get the global focus box (the row/section is the affordance).

- [ ] **Step 2: Update game-view import + delete the old file**

In `src/components/game/game-view.tsx` change:
`import { Terminal } from "@/components/game/terminal";`
to
`import { Terminal } from "@/components/game/terminal/terminal";`
Then: `git rm src/components/game/terminal.tsx`

- [ ] **Step 3: Lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean; 25 test files pass (24 + new commands.test); `/` still SSG.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(terminal): split into registry + hook + shell (was one 162-line file)"
```

---

## Phase 2 — Grounded command expansion

Add the remaining commands to the registry. Each is a small pure handler + a test assertion. Add them all to `COMMANDS` (insertion order = help order): `cat`, `tree`, `grep`, `stack`, `awards`, `resume`, `chat`, `neofetch`, `theme`, `sudo`.

### Task 7: `cat`, `tree`, `grep`

**Files:**
- Modify: `src/components/game/terminal/commands.ts`
- Modify: `src/components/game/terminal/commands.test.ts`

- [ ] **Step 1: Add the three commands to commands.ts**

```ts
import { resolveNode, dossierFor, questGroups, questNodes } from "@/lib/game-model";
import { buildCorpus } from "@/lib/corpus";

const cat: Command = {
  name: "cat",
  description: "show a system's dossier",
  usage: "cat <slug>",
  run: (args) => {
    const slug = args[0];
    if (!slug) return { lines: err("usage: cat <slug>  (try 'ls')") };
    // map content slug -> the quest node id, then resolve the dossier
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
    return { lines: hits.slice(0, 30).map((t) => ({ kind: "out", text: t })) };
  },
};
```

> `cat` maps the CONTENT slug to a quest node via `questNodes.find(n => n.resolved.item.slug === slug)` — this is the correct bridge because `dossierFor` takes a `QuestNode`, and node ids ≠ slugs.

- [ ] **Step 2: Add tests**

```ts
import { profile } from "@/lib/profile";

it("cat shows real dossier with honest register", () => {
  const text = runCommand("cat pensieve").lines.map((l) => l.text).join("\n");
  expect(text).toContain("Pensieve");
  expect(text).toMatch(/register:.*Co-built/);
});
it("cat rejects a fake slug", () => {
  expect(runCommand("cat nope").lines.some((l) => l.kind === "err")).toBe(true);
});
it("tree lists every system group + node from questGroups", () => {
  const text = runCommand("tree").lines.map((l) => l.text).join("\n");
  expect(text).toContain("Production Work");
});
it("grep returns only real corpus lines, empty term errors", () => {
  expect(runCommand("grep").lines.some((l) => l.kind === "err")).toBe(true);
  const hit = runCommand("grep ascendion").lines.map((l) => l.text).join("\n").toLowerCase();
  expect(hit).toContain("ascendion");
});
```

- [ ] **Step 3: Run** — `pnpm test` → all pass.
- [ ] **Step 4: Commit**

```bash
git add src/components/game/terminal/commands.ts src/components/game/terminal/commands.test.ts
git commit -m "feat(terminal): cat (dossier) · tree (graph) · grep (corpus search)"
```

### Task 8: `stack`, `awards`, `resume`, `chat`, `neofetch`, `theme`, `sudo`

**Files:**
- Modify: `src/components/game/terminal/commands.ts`
- Modify: `src/components/game/terminal/commands.test.ts`

- [ ] **Step 1: Add the commands**

```ts
import { skills, achievements, resumeVariants } from "@/lib/profile";

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
          ...resumeVariants.map((r) => `  ${r.label.toLowerCase().split(" ")[0].padEnd(12)} ${r.label} — ${r.tag}`),
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
  run: (args) => ({ lines: err(`sudo: ${args.join(" ") || "permission"} denied — this resume is read-only ☺`) }),
};
```

> `theme` needs hook state, so it's wired in P3 (Task 11). For P1/P2 the registry's `theme` entry can return an explanatory line; the actual cycling is a shell concern. Add a minimal `theme` command in P3 alongside the shell state.

- [ ] **Step 2: Add tests**

```ts
it("stack lists real skill groups", () => {
  const text = runCommand("stack").lines.map((l) => l.text).join("\n");
  expect(text).toContain(skills[0].group);
});
it("awards lists achievements", () => {
  const text = runCommand("awards").lines.map((l) => l.text).join("\n");
  expect(text).toContain(achievements[0].title);
});
it("resume lists variants, opens a real one, rejects fake", () => {
  expect(runCommand("resume").lines.length).toBeGreaterThan(1);
  const opened = runCommand("resume master");
  expect(opened.nav?.type).toBe("external");
  expect(runCommand("resume nope").lines.some((l) => l.kind === "err")).toBe(true);
});
it("chat switches to chat view; sudo is a harmless gag", () => {
  expect(runCommand("chat").nav).toEqual({ type: "view", view: "chat" });
  expect(runCommand("sudo rm -rf /").lines.some((l) => l.kind === "err")).toBe(true);
});
it("every help-listed command name resolves (no orphan in registry)", () => {
  for (const name of COMMAND_NAMES) expect(COMMANDS[name]).toBeTruthy();
});
```

- [ ] **Step 3: Run** — `pnpm test` → all pass. Update `COMMANDS` to include all new keys in order.
- [ ] **Step 4: Commit**

```bash
git add src/components/game/terminal/commands.ts src/components/game/terminal/commands.test.ts
git commit -m "feat(terminal): stack · awards · resume · chat · neofetch · sudo (all content-grounded)"
```

---

## Phase 3 — Terminal UX polish

### Task 9: Command chips (non-typer on-ramp)

**Files:**
- Modify: `src/components/game/terminal/terminal.tsx`

- [ ] **Step 1: Add a chip row above the input** that calls `run(cmd)` on click.

```tsx
const CHIPS = ["whoami", "ls work", "stack", "tree", "resume"];
// ...inside the component, just above the <form>:
<div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2" role="group" aria-label="Quick commands">
  {CHIPS.map((c) => (
    <button
      key={c}
      type="button"
      onClick={() => run(c)}
      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {c}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Manual check** — `pnpm dev`, open Play, click each chip → runs the command; keyboard-focusable with visible ring.
- [ ] **Step 3: Commit** — `git commit -m "feat(terminal): clickable command chips for non-typers"`

### Task 10: Blinking cursor + typewriter boot (reduced-motion aware)

**Files:**
- Modify: `src/app/globals.css` (cursor keyframe), `src/components/game/terminal/terminal.tsx`

- [ ] **Step 1: Add a CSS blink keyframe (disabled under reduced-motion)** in `globals.css`:

```css
@keyframes terminal-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
.terminal-cursor { animation: terminal-blink 1s steps(1) infinite; }
@media (prefers-reduced-motion: reduce) { .terminal-cursor { animation: none; opacity: 1; } }
```

- [ ] **Step 2: Render a `<span className="terminal-cursor text-accent">▍</span>`** after the input prompt when the input is empty/unfocused (cosmetic only — never conveys meaning, so reduced-motion just shows it solid).
- [ ] **Step 3: Typewriter** — only the boot banner; gate behind `useReducedMotion()` (instant when reduced). Keep it visual-only; the full text is in the DOM immediately for screen readers (reveal via CSS/width, not by withholding text).
- [ ] **Step 4: Manual check** + reduced-motion check (DevTools → Rendering → emulate prefers-reduced-motion) → no animation, text fully present.
- [ ] **Step 5: Commit** — `git commit -m "feat(terminal): blinking cursor + boot typewriter (reduced-motion aware)"`

### Task 11: `theme` command + prompt theming

**Files:**
- Modify: `use-terminal.ts` (theme state), `terminal.tsx` (apply theme), `commands.ts` (theme command returns a marker the shell reads)

- [ ] **Step 1:** add `theme: Theme` state to the hook + a `cycleTheme()`; `theme` command returns `{ lines, nav: undefined }` plus a sentinel the hook interprets (simplest: special-case `name==="theme"` in the hook's `run` before dispatch, cycling cyan→green→amber and printing the new theme). Apply theme via a class on the section that swaps the prompt/accent color.
- [ ] **Step 2:** test: `runCommand("theme")` prints the current/next theme name (pure part); the cycle itself is hook-tested manually.
- [ ] **Step 3: Commit** — `git commit -m "feat(terminal): theme command (cyan/green/amber prompt)"`

---

## Phase 4 — Promote in Play + fullscreen overlay

### Task 12: Fullscreen "beast mode" overlay

**Files:**
- Create: `src/components/game/terminal/terminal-overlay.tsx`
- Modify: `src/components/game/terminal/terminal.tsx` (maximize button)

- [ ] **Step 1: Write the overlay** using `@radix-ui/react-dialog` (already a dep), reusing the cmdk pattern (visually-hidden `Title`/`Description`, focus trap, Esc). It renders the same `<Terminal maxHeightClass="max-h-[70vh]" />` inside a large centered dialog.

```tsx
// src/components/game/terminal/terminal-overlay.tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Terminal } from "./terminal";

export function TerminalOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,56rem)] -translate-x-1/2 -translate-y-1/2">
          <Dialog.Title className="sr-only">Developer mode terminal</Dialog.Title>
          <Dialog.Description className="sr-only">A command-line interface to explore Sairam&apos;s work.</Dialog.Description>
          <div className="relative">
            <Dialog.Close className="absolute -right-2 -top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Close terminal">
              <X size={14} />
            </Dialog.Close>
            <Terminal maxHeightClass="max-h-[70vh]" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

> Each `<Terminal/>` instance has its own `useTerminal` state — the overlay is a *separate* session (acceptable; it boots fresh). If shared scrollback is wanted later, lift state up — out of scope for v1.

- [ ] **Step 2: Add a maximize button** to the terminal header that opens the overlay. Since the inline terminal and overlay are separate instances, put the `open` state + button in `game-view.tsx` (Task 13) or a small wrapper. Wire the button to `onOpenChange(true)`.
- [ ] **Step 3: Commit** — `git commit -m "feat(terminal): fullscreen beast-mode overlay (Radix dialog)"`

### Task 13: Promote the terminal in game-view + mobile collapse

**Files:**
- Modify: `src/components/game/game-view.tsx`

- [ ] **Step 1: Re-rank + label.** Order: `BuildGraph` (companion) → a prominent **"Developer Mode"** labelled section wrapping `<Terminal>` with a maximize button (opens `TerminalOverlay`) → `GraphIndex` (default floor) → `EasterEggs`. Add a `useState` for the overlay open-state here.

```tsx
// inside GameView:
const [termMax, setTermMax] = useState(false);
// ...in the returned JSX, between <BuildGraph/> and <GraphIndex/>:
<section className="mt-8" aria-labelledby="devmode-label">
  <div className="flex items-center justify-between">
    <p id="devmode-label" className="mono-label">// developer mode — query my work via CLI</p>
    <button type="button" onClick={() => setTermMax(true)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      ⛶ Maximize
    </button>
  </div>
  <div className="mt-3"><Terminal /></div>
</section>
<TerminalOverlay open={termMax} onOpenChange={setTermMax} />
```

- [ ] **Step 2:** ensure `GraphIndex` stays AFTER and remains the keyboard/SSR/mobile default; on mobile the terminal is fine as a normal section (it's DOM-based, scrolls). No content gated behind it.
- [ ] **Step 3: Lint + build** — `pnpm lint && pnpm build` → green, `/` SSG.
- [ ] **Step 4: Commit** — `git commit -m "feat(game): promote terminal to a prominent Developer Mode panel + maximize"`

### Task 14: ⌘K "Developer mode" command-palette entry

**Files:**
- Modify: `src/components/command-palette.tsx`

- [ ] **Step 1:** in the `views` actions array, the Play entry already switches to gamified. Add a dedicated action: `{ id: "v-dev", label: "Developer mode", hint: "terminal — query my work", icon: <TerminalSquare size={16} />, run: () => switchTo("gamified"), keywords: "terminal cli developer console" }`. (Import `TerminalSquare` — already imported.) This routes users to Play where the terminal is prominent.
- [ ] **Step 2: Manual check** — ⌘K → "Developer mode" → lands in Play with the terminal visible.
- [ ] **Step 3: Commit** — `git commit -m "feat(nav): ⌘K 'Developer mode' entry → Play terminal"`

---

## Phase 5 — Verify & release

### Task 15: Full verification + PR

- [ ] **Step 1: Build green** — `pnpm build` (all tests pass incl. commands.test; `/` SSG; files <500 lines: `find src/components/game/terminal -name '*.ts*' | xargs wc -l`).
- [ ] **Step 2: Real-browser audit (Playwright, fresh dev server per attempt — server is flaky under load, restart if it drops):**
  - Play view: terminal is prominent + labelled; `whoami` banner shows real metrics; `cat pensieve` shows the honest register; `tree`/`stack`/`grep ascendion`/`resume` work; `open mindforge` navigates to `/projects/mindforge`; chips run on click; ↑/↓ history + Tab autocomplete work.
  - Maximize → overlay traps focus, Esc closes, focus returns.
  - Reduced-motion: no typewriter/blink animation, text fully present.
  - Mobile 360px: terminal usable; GraphIndex still the default; no horizontal overflow.
  - No console errors (the DialogTitle pattern from the overlay must not regress).
- [ ] **Step 3: Push branch** (user runs the push per workflow) → **PR into `develop`**; keep the branch.
- [ ] **Step 4:** after merge to develop → release PR develop→main → production deploy → re-audit live.

---

## Self-review notes (done)
- **Spec coverage:** placement (T13/T12), full command set (T3/7/8), flourish (T9/10/11 chips/cursor/typewriter/theme), non-typers (T9 chips), a11y (role=log T6, combobox/history T5/6, overlay focus-trap T12, reduced-motion T10), registry-first <500 lines (T3), coverage/anti-fabrication test (T4/7/8) — all mapped.
- **Type consistency:** `Line`/`NavAction`/`Command`/`CommandResult`/`CommandContext` defined in T1, used consistently (`run(args, ctx) => CommandResult`, `nav` of type `NavAction`) through T3–T8; `dossierFor(node)` takes a `QuestNode` (T7 bridges slug→node via `questNodes.find`).
- **No placeholders:** every code step shows real code; the only deferred bit is `theme` cycling (explicitly P3/T11) and shared overlay scrollback (explicit non-goal).
