# Design: Terminal → "Developer Mode" beast upgrade (Anvilry Play view)

## Context

Anvilry's Play (gamified) view has three layers over one content source: the R3F **Build Graph**, the accessible DOM **dossier index**, and a **terminal** (`src/components/game/terminal.tsx`). The terminal is currently a buried ~224px (`max-h-56`) box sandwiched between the graph and the index, with 6 commands (`help`/`ls`/`open`/`whoami`/`classic`/`clear`). **Most visitors never notice it.**

The owner wants to turn it into a memorable **"developer mode" showcase** — a CLI a recruiter/engineer uses to explore Sairam's *real* data as if querying a resume from a shell. A 6-lens deep-research + adversarial synthesis produced the locked direction below; four owner decisions are locked (placement, command scope, flourish, non-typer path).

**Goal:** promote the terminal from "easy to miss" to a co-equal, delightful, fully-grounded, accessible CLI — without fragmenting the 3-view architecture or the single content-derivation layer.

## Locked decisions

- **Placement:** stays **inside Play** (NOT a 4th view) — a co-equal full-width panel (graph above as visual companion, DOM index below as the a11y/mobile/no-JS floor) **+ a maximize → focus-trapped fullscreen overlay** (Radix Dialog, already a dep) for the "beast mode" moment.
- **Command set:** full beast (~14): `whoami`/`neofetch` · `ls [work|projects]` · `cat <slug>` · `tree` · `grep <term>` · `stack` · `awards` · `resume [variant]` · `open <slug>` · `chat` · `classic` · `clear` · `help` · `sudo` (one easter egg).
- **Flourish:** full — ASCII boot banner with real impact metrics, typewriter intro (visual-only; instant under `prefers-reduced-motion`), blinking cursor, arrow-key history, Tab autocomplete, `theme`.
- **Non-typers:** clickable **command chips** (run on click) + the existing "Back to Classic" escape hatch.

## Why this shape (research verdict)

- **Not a 4th view:** a `dev` view would edit the `View` union, switcher, router, command-palette, and `page.tsx`, and duplicate the WebGL-dispose / deep-link / escape-hatch / SEO / reduced-motion scaffolding. Expanding in Play inherits all of it free. "Easy to miss" is a *prominence* bug — fixed with layout + a labelled panel + chips + a ⌘K "Developer mode" entry.
- **Extend bespoke, reject xterm.js:** xterm renders to canvas and hides rows from screen readers; its maintainers' own a11y fix is the `aria-live=polite` + `aria-atomic=false` pattern the current `terminal.tsx` already uses. xterm/react-console-emulator add 80KB+ gz for what is a synchronous allowlist dispatcher. The genre universally ignores a11y → a screen-reader-drivable terminal is Sairam's differentiator.
- **Zero fabrication is structural:** every command resolves through the SAME content layer the graph + chat use (`getWork`/`getProject`/`resolveNode`/`questNodes`/`dossierFor`/`questGroups`/`profile`/`buildCorpus`). The CLI cannot invent data.

## Architecture

**One new module + a refactor of the existing component into focused units (the file is 162 lines + would blow past the <500-line rule with ~14 commands + history + autocomplete):**

- `src/components/game/terminal/commands.ts` — **the command registry** (the critic's sole mustFix, built FIRST). A map of `name → { description, usage, run(args, ctx) => Line[] | NavAction }`. Pure, content-sourced, unit-testable. `help` + autocomplete + tests all derive from this one registry (single source).
- `src/components/game/terminal/use-terminal.ts` — terminal state hook: scrollback lines, input, command history (↑/↓), `run(raw)`, autocomplete candidates. Owns the dispatch loop.
- `src/components/game/terminal/terminal.tsx` — the presentational shell: prompt, `role="log"` aria-live output, input (ARIA combobox for autocomplete), command chips, maximize button. Renders the registry's output.
- `src/components/game/terminal/boot-banner.tsx` — the ASCII `whoami`/neofetch banner (derived from `profile.ts` impactMetrics; typewriter visual-only).
- `src/components/game/terminal/terminal-overlay.tsx` — Radix Dialog wrapper for fullscreen "beast mode" (focus trap, Esc, a11y title — reuse the `@radix-ui/react-dialog` already added for the ⌘K fix).
- `src/components/game/game-view.tsx` — re-rank: BuildGraph (companion) → **Terminal panel (prominent, labelled "Developer Mode", maximize button)** → GraphIndex (default floor). Mobile/reduced-motion: terminal collapses to a compact box or a "tap to open" that uses the overlay; GraphIndex stays the default.

**Data flow:** `commands.ts` imports the content layer directly (`@/lib/game-model`, `@/lib/content`, `@/lib/profile`, `@/lib/corpus`). No network, no eval, no fake filesystem. `grep` is a substring match over the in-memory `buildCorpus()` string + skills/tech; `tree` renders `questGroups()`/`graphEdges`; `cat` renders `dossierFor` structured fields (NOT MDX body); `open`/`chat`/`classic` return a `NavAction` the shell executes (router.push / setView).

## Command spec (all grounded)

| Command | Source | Output |
|---|---|---|
| `whoami` / `neofetch` | `profile.ts` | ASCII banner: name, role@company, 3 impact metrics, links |
| `ls [work\|projects]` | `allWork`/`allProjects` | slug + name list (default: both, grouped) |
| `cat <slug>` | `resolveNode`/`dossierFor` | dossier: name, role, **honest register**, summary, real metrics, tech |
| `tree` | `questGroups`/`graphEdges` | ASCII tree of groups → systems (real lineage edges) |
| `grep <term>` | `buildCorpus()` + skills/tech | matching lines (substring, case-insensitive) |
| `stack` / `skills` | `profile.skills` | skill groups + items |
| `awards` | `profile.achievements` | achievements list |
| `resume [variant]` | `profile.resumeVariants` | list variants / open the PDF |
| `open <slug>` | `getWork`/`getProject` | NavAction → `/work\|/projects/<slug>` |
| `chat` / `classic` | ViewProvider | NavAction → switch view |
| `clear` · `help` | registry | utility (help auto-generated from registry) |
| `theme` | local | cycle prompt theme (cosmetic) |
| `sudo` | — | one honest easter egg ("nice try" — no fake admin data) |

Unknown command → friendly `command not found: x (try 'help')`. Unknown slug → `not found: x (try 'ls')`.

## Accessibility & mobile (non-negotiable)

- Output stays a **polite `role="log"`** live region (`aria-atomic=false` → only new lines announce); errors escalate to assertive. Focus parks on the input; focus returns to trigger when the overlay closes.
- **Autocomplete = ARIA combobox + listbox** (Tab/↑↓ cycle, Enter accept, Esc dismiss).
- **Command chips** give non-typers (and touch users) full access without typing; chips share the registry `run` path.
- **Reduced-motion:** typewriter/cursor animations become instant; no motion conveys meaning.
- **Mobile:** terminal collapses to a compact box or opens via the overlay on tap; **GraphIndex remains the default explore surface** — content is NEVER gated behind the CLI.
- **GraphIndex + escape hatch stay the first focusable / no-JS / SSR floor.** R3F canvas still disposes on Play-view exit even as a companion column.

## Phased build (one commit per task)

Branch `feat/terminal-dev-mode` off latest `develop` (PR → develop per workflow).

- **P1 — Registry-first refactor (no UX change):** extract `commands.ts` + `use-terminal.ts` from the current `terminal.tsx`; port the existing 6 commands through the registry; identical behavior. Add a **build-time coverage test** asserting every registry command resolves only real content + `help` lists them all. (Keeps every file <500 lines from the start.)
- **P2 — Grounded command expansion:** add `cat`/`tree`/`grep`/`stack`/`awards`/`resume`/`chat`/`neofetch`/`theme`/`sudo` to the registry, each sourced from the content layer; extend the coverage/anti-fabrication test.
- **P3 — Terminal UX:** arrow-key history, ARIA combobox autocomplete, command chips, blinking cursor, boot banner + typewriter (reduced-motion aware).
- **P4 — Promote in Play + maximize overlay:** re-rank `game-view.tsx` (prominent labelled panel), Radix fullscreen overlay, ⌘K "Developer mode" command, mobile collapse. Verify a11y (VoiceOver/keyboard), reduced-motion, mobile, and that GraphIndex stays the default.
- **P5 — Verify & release:** real-browser audit (focus, chips, autocomplete, overlay, mobile), build green, PR → develop → release to main.

## Critical files
- **New:** `src/components/game/terminal/{commands,use-terminal,boot-banner,terminal-overlay}.ts(x)` + `commands.test.ts`.
- **Refactored:** `src/components/game/terminal.tsx` → `terminal/terminal.tsx` (presentational).
- **Modified:** `src/components/game/game-view.tsx` (re-rank + maximize), `src/components/command-palette.tsx` (⌘K "Developer mode" entry).
- **Reused unchanged:** `src/lib/game-model.ts`, `content.ts`, `profile.ts`, `corpus.ts`, `graph-data.ts`.

## Verification
1. **Build/lint/test:** `pnpm build` green; coverage test fails the build if any command surfaces non-content / a command is missing from `help`.
2. **Grounding:** `cat pensieve` shows the honest "Co-built · production-hardened" register + real metrics; `grep kafka` returns only real corpus lines; no command can emit a value absent from the content layer.
3. **A11y (real Chromium + VoiceOver):** keyboard-only operable; output announced once-per-line (not per-char); autocomplete combobox works; overlay traps focus + restores on close; chips operable.
4. **Reduced-motion / mobile (360px):** typewriter instant; terminal collapses; GraphIndex remains the default; escape hatch lands on a navigable Classic.
5. **No regression:** Classic SEO untouched; R3F disposes on exit; `/` still SSG; files <500 lines.

## Non-goals (YAGNI)
No real shell / PTY / eval / fake filesystem / network commands. No xterm.js. No 4th top-level view. No analytics/instrumentation. `npx sairam` CLI card is a possible future README hook, out of scope here.
