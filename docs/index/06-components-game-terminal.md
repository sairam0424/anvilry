---
kind: doc
title: Components — Gamified View & Developer Terminal
domain: [content]
status: current
version: v3.8.0
---

# Components — Gamified View & Developer Terminal

> Part of the Anvilry v3.8.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> Describes Anvilry v3.8.0 (`package.json` 3.8.0), i.e. `main` at a929932 plus five later fixes (notes hidden at the data layer when `NOTES_ENABLED` is off; per-class rate-limit buckets with a cron bypass; shared admin auth; command-palette talk-mode gated by `isVoiceViewActive`; `MIN_ROUTES=17` and dead-component removal). None of the five changes a file in this scope. Line citations are re-pointed to that tree.

**Scope:** `src/components/game/**` (incl. `src/components/game/terminal/**`), excluding `*.test.*` / `*.dom.test.*`
**Files indexed:** 23

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/components/game/game-view.tsx` | GAMIFIED ("Build Graph") view shell: escape hatch → header → 3D graph → DOM index → glass-box → flag-gated skill tree | `GameView` (component) |
| `src/components/game/developer-view.tsx` | DEVELOPER view shell: full-page terminal + recruiter rail on lg+, plus the fullscreen overlay | `DeveloperView` (component) |
| `src/components/game/developer-rail.tsx` | lg+ sidebar `<aside>`: impact metrics, every `resumeVariants` PDF (one today), six tooltip-wrapped contact links | `DeveloperRail` (component) |
| `src/components/game/build-graph.tsx` | Gate + wrapper for the lazy R3F scene; inline dossier panel on node select | `BuildGraph` (component) |
| `src/components/game/build-graph-scene.tsx` | The R3F `<Canvas>` itself: per-node meshes, line-segment edges, OrbitControls; node/edge colors resolved from live theme tokens | `default` = `BuildGraphScene` (component) |
| `src/components/game/graph-index.tsx` | Server-renderable DOM-first index of every system, grouped by `questGroups()` | `GraphIndex` (component) |
| `src/components/game/dossier-card.tsx` | One system card built from `dossierFor(node)`; accent rail from live theme tokens; deep-links to Classic; unlocks `dossier-open` | `DossierCard` (component) |
| `src/components/game/webgl-boundary.tsx` | Class error boundary that renders `null` when a WebGL child throws | `WebGLBoundary` (class component) |
| `src/components/game/easter-eggs.tsx` | Global console greeting + Konami-code disclosure card (mounted in root layout) | `EasterEggs` (component) |
| `src/components/game/discovery-badge.tsx` | Floating "★ N/5 discovered" status pill | `DiscoveryBadge` (component) |
| `src/components/game/glass-box-demo.tsx` | Scripted multi-agent trace UI; ships dark behind `traceApproved` | `GlassBoxDemo` (component) |
| `src/components/game/use-trace-runner.ts` | Timer state machine that reveals trace steps + drives the live region | `useTraceRunner` (hook), `RunnerStatus` (type) |
| `src/components/game/skill-tree.tsx` | Standalone SVG "RPG skill tree" (2 rows × 3 hex categories), flag-gated; four of six group colors follow the live theme | `SkillTree` (component) |
| `src/components/game/terminal/commands.ts` | The pure command registry + dispatcher (see [registry table](#terminal-command-registry)) | `COMMANDS`, `COMMAND_NAMES`, `runCommand`, `commandEventName` |
| `src/components/game/terminal/use-terminal.ts` | Shell hook: scrollback, input, history refs, theme cycling, NavAction execution, analytics | `useTerminal` (hook) |
| `src/components/game/terminal/terminal.tsx` | Presentational terminal: log live region, horizontally scrolling chip rail, combobox input, fuzzy dropdown, ghost hint | `Terminal` (component) |
| `src/components/game/terminal/terminal-overlay.tsx` | Radix Dialog "beast mode" fullscreen wrapper hosting a *second* `<Terminal>`; tooltip-wrapped close button | `TerminalOverlay` (component) |
| `src/components/game/terminal/boot-banner.ts` | Two banners: the `whoami`/`neofetch` figlet identity block and the 404 kernel-panic sequence | `bootBanner`, `bootBanner404` |
| `src/components/game/terminal/completion.ts` | Pure Tab-prefix completion + fuzzy subsequence scoring for the dropdown | `completeCommand`, `fuzzyScore`, `getSuggestions`, `Suggestion` (interface) |
| `src/components/game/terminal/history.ts` | Pure ↑/↓ history index arithmetic | `nextHistoryIndex` |
| `src/components/game/terminal/theme.ts` | Cosmetic prompt-theme cycle order | `THEMES`, `nextTheme` |
| `src/components/game/terminal/fmt.ts` | Box-drawing / table / row formatters producing `Line[]` at 56-char content width | `divider`, `blank`, `section`, `row`, `bullet`, `box`, `table`, `grouped`, `statsBox` |
| `src/components/game/terminal/types.ts` | Type-only contract for the terminal (`Line`, `NavAction`, `Command`, `Theme`) | `Line`, `NavAction`, `CommandResult`, `CommandContext`, `Command`, `Theme` (types) |

## Terminal command registry

Read in full from `src/components/game/terminal/commands.ts:689-722` (registry) — insertion order below matches the registry, which drives `help` output and autocomplete order. **32 entries, 28 visible + 4 hidden** (the visible `integrity` command sits between `awards` and `summary`). Every `run()` is pure (no React, no router); the shell (`use-terminal.ts`) executes the returned `NavAction`.

| Name | Args | What it does | Output shape | Side effects |
|---|---|---|---|---|
| `help` | — | Lists visible commands split into "commands" / "navigation" buckets; nav bucket is the fixed list `classic, developer, chat, cd, clear` (`commands.ts:21`) | `fmt.section` + two `fmt.table` blocks + a literal `tip: … try 'secret'.` line (`commands.ts:36`) | none |
| `whoami` | — | Prints `bootBanner()` | ASCII `art` lines + identity `out` lines | none |
| `neofetch` | — | Spread-copy of `whoami` with a different name and the description "system info (alias of whoami)" (`commands.ts:659-663`) | same as `whoami` | none |
| `ls` | `[work\|projects]` | Lists `allWork` and/or `allProjects` slugs + names; no/unknown arg prints both sections (`commands.ts:71-79`) | `fmt.section` + `fmt.table` rows (`●` work, `▸` projects) | none |
| `cat` | `<slug>` | Resolves a **content slug** → quest node via `questNodes.find(n => n.resolved.item.slug === slug)` then renders `dossierFor(node)` (`commands.ts:132-145`) | `fmt.box("// <NAME>")` with rows, dividers, blurb, facts, tech | none; `err` on miss |
| `tree` | — | Renders `questGroups()` as an ASCII tree with `├──`/`└──` prefixes (`commands.ts:149-169`) | plain `out` lines starting with `.` | none |
| `grep` | `<term>` | Case-insensitive line filter over `buildCorpus()` (`commands.ts:180-182`); count-first header, capped at `GREP_LIMIT = 30` with an explicit "+N more" line (`commands.ts:171,189-194`) | `out` lines | none |
| `find` | `<tech>` | Filters `[...allWork, ...allProjects]` where any `item.tech` includes the term (`commands.ts:470-472`) | `out` header + `slug.padEnd(22) name` rows | none |
| `top` | — | `techFrequency()` sorted desc by count then A→Z; capped at `TOP_LIMIT = 12` with a "+N more" line (`commands.ts:461,498-503`) | `out` lines `tech ×count` | none |
| `stats` | — | Computed rollup: work count, project count, summed `p.commits` labelled "(snapshot)", distinct tech, skill groups, achievements, résumé variants (`commands.ts:509-526`; the variant count is `resumeVariants.length`, currently 1) | `fmt.statsBox("// PORTFOLIO STATS")` | none |
| `stack` | — | `skills.flatMap(s => fmt.grouped(s.group, s.items))` | `// GROUP` headers + `▸` bullets | none |
| `awards` | — | `achievements` as `✓ title  detail` rows | `fmt.section` + `fmt.row` | none |
| `integrity` | — | Reads the committed claims-integrity ledger (`integrityChain` from `@/lib/integrity-chain`, which inlines `data/integrity-chain.json`): entry count, head hash sliced to 19 chars + `…`, head/first sealed dates and 7-char parent commit SHAs, then a disclaimer that this is a tamper-evidence log, not a certification. Empty chain prints "no sealed entries yet." (`commands.ts:242-288`) | `fmt.box("// CLAIMS INTEGRITY LEDGER")` | none |
| `summary` | — | Identity + work + projects + skills + recognition in one dump, ending with a run-`resume`/`contact` pointer (`commands.ts:384-417`) | mixed `fmt.row`/`table`/`section`/`divider` | none |
| `career` | — | Groups everything under the single `profile.company` / `profile.tenure` line; **deliberately prints no per-item years** because content has no per-item dates (`commands.ts:422-423`); shows only `w.metrics[0]` if present (`commands.ts:428-430`) | `fmt.row` blocks per work item | none |
| `about` | — | Always-visible bio door: name/role/company + `profile.subhead`; appends "run 'secret'" only when `hasPersonalContent` (`commands.ts:544-550`) | plain `out` lines | none |
| `resume` | `[variant]` | No arg → lists variants. Arg → substring match on `label.toLowerCase()`. Visible set is `resumeVariants` when `NEXT_PUBLIC_RESUME_VARIANTS === "true"`, else only `resumeVariants[0]` — flag read **inside** `run()` so `vi.stubEnv` works (`commands.ts:295-299`). `resumeVariants` has a single entry today (`src/lib/profile.ts:136-142`), so the flag currently changes nothing | `out` lines; listing pads `label.split(" ")[0]` to 12 chars | `nav: {type:"external", href: match.file}` → `window.open` the PDF |
| `open` | `<slug\|github\|linkedin\|npm\|pypi\|devto\|substack\|resume\|résumé>` | Looks the first arg up in `OPEN_LINK_TARGETS` (`commands.ts:85-92`, six external profile links), then special-cases `resume`/`résumé`, else `getWork(slug) ?? getProject(slug)` (`commands.ts:104-119`) | `out` "opening … " line | the six profile keys → `external`; `resume`/`résumé` → `route` `profile.links.resume` (`/resume`); a slug → `route` `target.url` |
| `contact` | — | Boxed name, role @ company, location, email, github, linkedin, npm (with `https://` stripped so `fmt.box` does not slice it, `commands.ts:344-348`), pypi, dev.to, substack, and a "run 'resume'" pointer (`commands.ts:332-355`) | `fmt.box("// CONTACT")` | none |
| `email` | — | Prints the address as selectable text **first**, then attempts the mailto (`commands.ts:360-365`) | 2 `out` lines | `nav: {type:"external", href:"mailto:<email>"}` |
| `social` | — | GitHub, LinkedIn, npm, PyPI, dev.to and Substack URLs (`commands.ts:368-381`) | 6 `out` lines | none |
| `chat` | — | Switch to the chat view | 1 `out` line | `nav: {type:"view", view:"chat"}` |
| `theme` | — | Registry entry exists only so `help`/autocomplete list it; **the shell intercepts `theme` before dispatch** (`use-terminal.ts:47`). Reaching `run()` means there is no shell, so it returns an honest explanation instead of a fake success (`commands.ts:675-686`) | 1 `out` line | none *from the registry*; in-shell it cycles `cyan→green→amber` |
| `classic` | — | Switch to the classic view | 1 `out` line | `nav: {type:"view", view:"classic"}` |
| `developer` | — | Switch to the developer view | 1 `out` line | `nav: {type:"view", view:"developer"}` |
| `cd` | `[path]` | Only `""`, `/`, `~` are valid → home; anything else errors (`commands.ts:647-656`) | `out` or `err` | `nav: {type:"route", href:"/"}` |
| `clear` | — | Returns **zero** lines + the clear action | `[]` | `nav: {type:"clear"}` → `setLines([])`; the `$ clear` echo is discarded too (`use-terminal.ts:58-61`) |
| `sudo` | `[anything]` | Joke denial echoing the args | 1 `err` line | none |
| **`secret`** *(hidden)* | — | **Easter egg.** Prints `personal.hobbies / funFacts / currentlyLearning / askMeAbout` as `• ` bullets, then points at `uses` + `now`. Empty-safe: with `!hasPersonalContent` prints "personal notes coming soon" (`commands.ts:555-584`, empty branch `:560-566`) | plain `out` lines | none |
| **`personal`** *(hidden)* | — | Alias: `{ ...secret, name: "personal" }` — inherits `hidden: true` and `secret`'s description (`commands.ts:586`) | same as `secret` | none |
| **`uses`** *(hidden)* | — | **Easter egg.** `personal.uses` groups as `group: items…`; empty-safe fallback points at `stack` (`commands.ts:588-607`, empty branch `:593-599`) | plain `out` lines | none |
| **`now`** *(hidden)* | — | **Easter egg.** `now.focus` bullets + an honest staleness footer computed from `Date.parse(now.updated)` at call time: `> 90` days → "(last updated N days ago — may be stale)", else "(updated …)" (`commands.ts:624-638`). Dark when `!hasNow` (`commands.ts:614-619`) | plain `out` lines | none |

Dispatch contract (`commands.ts:725-741`): `runCommand(raw)` trims, splits on `/\s+/`, lowercases the first token, always prepends the echo line `{kind:"in", text:"$ <trimmed>"}`, and returns `command not found: <name>  (try 'help')` as an `err` for unknown tokens. Empty input returns `{ lines: [] }` with no echo.

## Detail

### `src/components/game/terminal/commands.ts`
- **Role:** The single, pure, React-free command registry + dispatcher for the developer terminal.
- **Exports:** `COMMANDS` (const, `Record<string, Command>`) — ordered registry; `runCommand` (fn) — echo + dispatch; `COMMAND_NAMES` (const `string[]`) — **visible-only** names for Tab autocomplete; `commandEventName` (fn) — PII-safe analytics label.
- **Reads / depends on:** `@/lib/content` (`allWork`, `allProjects`, `getWork`, `getProject`), `@/lib/game-model` (`questNodes`, `dossierFor`, `questGroups`), `@/lib/corpus` (`buildCorpus`), `@/lib/profile` (`profile`, `skills`, `achievements`, `resumeVariants`), `@/lib/personal` (`personal`, `now`, `hasPersonalContent`, `hasNow`), `@/lib/integrity-chain` (`integrityChain`), `./boot-banner`, `./fmt`, `./types`. Env: `NEXT_PUBLIC_RESUME_VARIANTS`.
- **Consumed by:** `terminal/use-terminal.ts:8` (`runCommand`, `COMMAND_NAMES`, `commandEventName`), `terminal/terminal.tsx:9` (`COMMANDS` → suggestion list), plus `commands.test.ts` / `commands-empty-safe.test.ts`. The file is 758 lines (over the 500-line convention).
- **Behaviour notes:** Two magic caps live here: `GREP_LIMIT = 30` (`:171`) and `TOP_LIMIT = 12` (`:461`); both surface the hidden remainder rather than truncating silently (`:189-194`, `:498-503`). `techFrequency()` (`:446-459`) keys on lowercased tech but preserves the first-seen label casing. `commandEventName` returns the registered name or the literal `"unknown"` — never raw input or args (`:755-758`). `integrity` slices the head hash to 19 chars by hand (`:255`) so the row fits `fmt.box`'s 56-char budget.
- **Gotchas / invariants:**
  - `cat` resolves through the **graph** (`:132`), `open` through **content** (`:115`). A work/project item that `ls` lists but has no entry in `NODE_CONTENT` (`src/lib/game-model.ts:28`) is `open`-able but **not** `cat`-able.
  - `COMMAND_NAMES` must stay `!hidden`-filtered (`:745-747`) or Tab will broadcast the egg commands; `terminal.tsx:17-19` applies the same filter independently for the fuzzy dropdown — two places to keep in sync.
  - The `NEXT_PUBLIC_RESUME_VARIANTS` read is deliberately inside `run()` (`:295-299`); hoisting it to module scope breaks `vi.stubEnv` in tests.
  - `resume`'s listing key is `label.toLowerCase().split(" ")[0]` (`:307`); for `resumeVariants[0]` (`"Sairam Resume"`) that word is **`sairam`**, not `master` (`src/lib/profile.ts:138`). Matching is `label.toLowerCase().includes(arg)` (`:312-314`), so an ambiguous substring picks the first hit.
  - `theme`'s registry `run()` is intentionally *not* a success message — see `:675-686`.

### `src/components/game/terminal/use-terminal.ts`
- **Role:** The stateful shell around the pure registry: scrollback, input, ↑/↓ history, prefix completion, theme state, NavAction execution, analytics + discovery unlock.
- **Exports:** `useTerminal(initialLines?: Line[])` (hook) → `{ lines, input, setInput, run, recall, complete, theme }`.
- **Reads / depends on:** `next/navigation` `useRouter`, `@/components/view-context` `useView`, `@vercel/analytics` `track`, `@/lib/discovery-store` `unlock`, and the four sibling pure helpers.
- **Consumed by:** `terminal/terminal.tsx:46` (the `useTerminal(initialLines)` call).
- **Behaviour notes:** `const greeting: Line[] = bootBanner()` is evaluated **once at module import** (`:15`); `initialLines` (the 404 kernel panic) replaces it only for the first `useState` initializer (`:29`). Analytics + `unlock("terminal-command")` fire for *any* non-empty input **before** the `theme` branch, so cosmetic and cleared commands are still counted (`:41-45`). `theme` is intercepted at `:47` and appends its own `$ theme` / `theme → <next>` pair. NavAction execution: `clear` wipes and returns early (`:58-61`), then `view` → `setView`, `route` → `router.push`, `external` → `window.open(href, "_blank", "noopener,noreferrer")` guarded by `typeof window !== "undefined"` (`:63-67`).
- **Gotchas / invariants:** History lives in refs (`history`, `histIndex` at `:32-33`), so it is **per-`<Terminal>`-instance** and is lost when the fullscreen overlay mounts its own Terminal. The `theme` interception matches only the exact trimmed lowercase string `"theme"` — `theme green` falls through to the registry's explanation line. `run` closes over `theme`, so its identity changes on every theme cycle (`:69`).

### `src/components/game/terminal/terminal.tsx`
- **Role:** The presentational terminal card — output live region, quick-run chips, and the combobox input with a fuzzy suggestion listbox + ghost completion.
- **Exports:** `Terminal` (component) — props `maxHeightClass = "max-h-72"`, `fill = false`, `onMaximize?`, `maximizeRef?`, `initialLines?`.
- **Reads / depends on:** `./use-terminal`, `./completion` `getSuggestions`, `./commands` `COMMANDS`, `@/lib/scroll/use-auto-scroll`, `@/lib/utils` `cn`, `@vercel/analytics` `track`, `lucide-react` (`TerminalSquare`, `Maximize2`).
- **Consumed by:** `game/developer-view.tsx:6`, `game/terminal/terminal-overlay.tsx:5`, `src/app/not-found.tsx:24`.
- **Behaviour notes:** `CHIPS = ["whoami", "ls work", "stack", "tree", "resume"]` (`:14`) run through the same `run()` path as typing. `COMMAND_SUGGESTIONS` is built once at module scope from `Object.values(COMMANDS).filter(c => !c.hidden)` (`:17-19`). Suggestions recompute in an effect on every `input` change (`:64-69`), with one `set-state-in-effect` eslint disable on the `setSuggestions` line (`:66`). `useAutoScroll({ threshold: 32, surface: "terminal", mode: "bottom-pin" })` (`:57-61`); `scrollToBottom()` is also called on any single-character keypress (`:92`). Key handling (`:91-141`): ↑/↓ move the suggestion cursor when the listbox is open, otherwise walk history; `Tab` accepts the highlighted/top suggestion or falls back to `complete()`; `ArrowRight` accepts the ghost hint; `Escape` closes the listbox; `Enter` with a highlighted suggestion accepts instead of running. `onBlur` defers `setShowSugg(false)` by 150 ms so a mouse click can land (`:300`). Analytics: `terminal_maximize` (`:162`) and `terminal_chip` with the chip label (`:223`). The chip rail is a single-line horizontally scrolling `role="group"` (`aria-label="Quick commands"`, `tabIndex={0}`, `scrollbar-hide`) with a decorative right-edge fade, not a wrapping flex row, so it keeps a fixed height inside the height-bounded lg layout (`:206-236`). The submit path runs the highlighted suggestion's name when one is highlighted (`:281-283`); the keydown `Enter` branch accepts it instead (`:137-140`), and that branch wins.
- **Gotchas / invariants:**
  - The suggestion `<ul id="terminal-cmd-listbox">` is **always in the DOM**, hidden via the `hidden` attribute, so `aria-controls` is never a dangling reference (`:240-248`). Options select on `onMouseDown` + `preventDefault` (`:260-263`), which is what lets a click beat the 150 ms blur.
  - `aria-hidden={l.kind === "art" || undefined}` (`:188`) is what keeps decorative figlet lines out of the `role="log"` announcement — changing `Line.kind` semantics breaks WCAG 1.1.1 here.
  - `aria-label="Terminal command input"` (`:302`) is a **contract**: `terminal-overlay.tsx:40-42` queries that exact selector to place initial focus.
  - The ghost hint is suppressed once the input contains a space (`:73`).

### `src/components/game/terminal/terminal-overlay.tsx`
- **Role:** Radix Dialog fullscreen ("beast mode") wrapper for the terminal.
- **Exports:** `TerminalOverlay` (component) — props `open`, `onOpenChange`, `triggerRef?`.
- **Reads / depends on:** `@radix-ui/react-dialog`, `lucide-react` `X`, `@/components/ui/tooltip` `Tooltip` (wraps the close button, `:62-69`), `./terminal`.
- **Consumed by:** `game/developer-view.tsx:7`.
- **Behaviour notes:** `onOpenAutoFocus` overrides Radix's default and focuses the command input by attribute query (`:37-47`). `onCloseAutoFocus` restores focus to `triggerRef.current` because this is a *controlled* dialog with no `<Dialog.Trigger>` — Radix would otherwise drop focus to `<body>` (`:48-54`, WCAG 2.4.3). `sr-only` `Dialog.Title` ("Developer mode terminal") + `Dialog.Description` satisfy Radix's a11y contract (`:57-60`). Overlay/content are `z-50` (`:35,:55`).
- **Gotchas / invariants:** The overlay mounts a **brand-new `<Terminal maxHeightClass="max-h-[70vh]">`** (`:70`) — a fresh session with its own scrollback, history refs and theme; the inline terminal's state is not lifted (documented at `:19-20`).

### `src/components/game/terminal/boot-banner.ts`
- **Role:** The two canned scrollback openings.
- **Exports:** `bootBanner404()` — fake kernel-panic sequence; `bootBanner()` — the `whoami`/`neofetch` identity block.
- **Reads / depends on:** `@/lib/profile` (`profile`, `impactMetrics`), `@/lib/personal` `hasPersonalContent`.
- **Consumed by:** `terminal/commands.ts:7` (`whoami`), `terminal/use-terminal.ts:9` (default greeting), `src/app/not-found.tsx:25` (`bootBanner404`).
- **Behaviour notes:** `bootBanner404` emits four fake `[    0.xxxxxx]` kernel/module-load `art` lines (the last, `route-resolver`, has no `OK`) then `KERNEL PANIC: route not found (0x404)` and `shell survived — try: ls, help, cd /` as `err` lines (`:10-21`). `bootBanner` renders a 5-line ASCII "Anvilry" figlet as `art`, then identity/headline/metrics/location as `out`, and appends the `try 'secret'` breadcrumb only when `hasPersonalContent` (`:34-66`, breadcrumb `:62-64`).
- **Gotchas / invariants:** `metricsShort` string-replaces `"daily users" → "users"` and `"open-source repos" → "OSS repos"` (`:38-40`) to keep the line under ~60 chars — renaming those labels in `src/lib/profile.ts:46-70` silently un-shortens the banner and wraps it.

### `src/components/game/terminal/fmt.ts`
- **Role:** Box-drawing/table/row formatters that all return `Line[]`.
- **Exports:** `divider`, `blank`, `section`, `row`, `bullet`, `box`, `table`, `grouped`, `statsBox`.
- **Consumed by:** `terminal/commands.ts:8` (`import * as fmt`).
- **Behaviour notes:** `W = 56` is the content width inside a box (`:13`). `section` upper-cases its label and prefixes `// `. `row` pads the key to 14 chars (`:37`). `box` computes the top border fill from the title length and pads/truncates each content line to exactly `W` (`:67`). `table` auto-pads column 1 to the longest value with a default 2-space indent (`:81-88`).
- **Gotchas / invariants:** `box` **silently slices** any content line longer than 56 chars (`:67`) — long URLs or tech lists inside `cat`/`contact`/`statsBox` get cut, not wrapped. `box` also rewrites each line's text but preserves its `kind`, so an `err` line inside a box keeps its amber styling.

### `src/components/game/terminal/completion.ts`
- **Role:** The completion engine — conservative Tab prefix completion plus fuzzy scoring for the dropdown.
- **Exports:** `completeCommand(value, names)`, `fuzzyScore(query, candidate)`, `getSuggestions(input, commands, limit = 5)`, `Suggestion` (interface).
- **Consumed by:** `terminal/use-terminal.ts:11` (`completeCommand`), `terminal/terminal.tsx:8` (`getSuggestions`), `completion.test.ts`.
- **Behaviour notes:** `completeCommand` returns `null` unless the input is exactly one non-empty token **and** exactly one name matches the prefix; on success it appends a trailing space (`:13-18`). `fuzzyScore` short-circuits a prefix match to `1000 - candidate.length` (so shorter prefix matches rank higher, `:32`), otherwise runs an in-order subsequence walk scoring `+10` for a contiguous run and `+1` otherwise (`:38-47`), returning `null` if not every query char matched. An empty query scores `0`. `getSuggestions` returns `[]` as soon as the trimmed input contains whitespace — no argument-position suggestions (`:65-66`).
- **Gotchas / invariants:** Ambiguous or zero-match prefixes deliberately leave the input untouched rather than guessing.

### `src/components/game/terminal/history.ts`
- **Role:** The history model — pure index arithmetic for ↑/↓ recall.
- **Exports:** `nextHistoryIndex(history, idx, dir)` → `{ idx, value }`.
- **Consumed by:** `terminal/use-terminal.ts:10`, `history.test.ts`.
- **Behaviour notes / invariants:** Index convention: `-1` = "not browsing" (live input). Up from `-1` jumps to `history.length - 1` (newest) and further Ups walk toward `0` and clamp there (`:21`). Down from `-1` is ignored (`value: null`, `:26`). Down past the newest resets to `{ idx: -1, value: "" }` — i.e. it **clears** the input (`:28`). Empty history returns `value: null` with the index unchanged (`:18`). Never mutates; the caller owns the refs.

### `src/components/game/terminal/theme.ts`
- **Role:** The theme model — the cosmetic prompt-color cycle.
- **Exports:** `THEMES = ["cyan", "green", "amber"]` (`:4`), `nextTheme(current)` — wrap-safe modulo step (`:7-9`).
- **Consumed by:** `terminal/use-terminal.ts:12`, `theme.test.ts`. Mapped to classes in `terminal.tsx:26-30` (`cyan → text-accent`, `green → text-green`, `amber → text-amber`, with `text-accent` as the fallback at `:47`).

### `src/components/game/terminal/types.ts`
- **Role:** Type-only contract shared by every terminal module (no runtime code).
- **Exports:** `Line` (4-variant union: `in` | `out` | `err` | `art`), `NavAction` (`view` | `route` | `external` | `clear`), `CommandResult`, `CommandContext`, `Command`, `Theme`.
- **Gotchas / invariants:** `art` is documented as aria-hidden decorative (`:8`) and `terminal.tsx:188` implements that. `NavAction` exists so commands never import the router or view-context (`:11-13`), which is what keeps `commands.ts` node-testable. `hidden` means "absent from `help` + Tab but still dispatchable and still analytics-tracked" (`:32-38`).

### `src/components/game/game-view.tsx`
- **Role:** The gamified ("Build Graph") view shell and composition order.
- **Exports:** `GameView` (component).
- **Reads / depends on:** `@/components/view-escape-hatch`, `game/graph-index`, `game/build-graph`, `game/glass-box-demo`, and a `next/dynamic` `{ ssr: false }` import of `game/skill-tree` (`:10-13`). Env: `NEXT_PUBLIC_SKILL_TREE`.
- **Consumed by:** `src/components/view-router.tsx:29` (itself a lazy `dynamic` import).
- **Behaviour notes:** `<ViewEscapeHatch />` is the first focusable element (`:32`). Child order is `BuildGraph` → `GraphIndex` → `GlassBoxDemo` → optional `SkillTree` (`:47-62`). The skill tree renders only when `process.env.NEXT_PUBLIC_SKILL_TREE === "true"` (`:57`) — a build-time inlined check, default off.
- **Gotchas / invariants:** Unmounting this subtree on view exit is what disposes the WebGL context (`:25-26`) — that behaviour lives in `view-router.tsx`, not here.

### `src/components/game/developer-view.tsx`
- **Role:** The developer view shell — full-page terminal, recruiter rail, fullscreen overlay.
- **Exports:** `DeveloperView` (component).
- **Reads / depends on:** `game/terminal/terminal`, `game/terminal/terminal-overlay`, `game/developer-rail`, `@/components/view-escape-hatch`, `@/lib/personal` `hasPersonalContent`, `@/lib/writing-flags` `OPEN_TO_WORK`, `@/lib/utils` `cn`.
- **Consumed by:** `src/components/view-router.tsx:34` (lazy `dynamic`).
- **Behaviour notes:** State is just `termMax` + `maximizeRef` (`:25-26`), threaded into `<Terminal fill onMaximize … maximizeRef>` (`:108-112`) and `<TerminalOverlay open={termMax} … triggerRef={maximizeRef}>` (`:124-128`). `<main>` is **height-bounded** on lg+ (`lg:min-h-0` plus a fixed `lg:h-[…]`, `:36-42`) so the terminal can scroll internally instead of pushing the document; the height is `calc(100dvh-3.5rem)` normally and `calc(100dvh-3.5rem-2.3125rem)` when `OPEN_TO_WORK` is on, to subtract the open-to-work banner (both are literal class strings, `:39-41`). The rail sits **after** the terminal in DOM order on purpose (`:115-119`).
- **Gotchas / invariants:** `lg:grid-rows-[minmax(0,1fr)]` on `:102` is load-bearing — the inline comment (`:96-101`) records that an implicit `auto` row refuses to shrink and lets the terminal overflow onto the footer. The `min-h-[24rem]` floor is intentionally dropped at `lg` (`:107`). The Konami/`secret` "psst" hint renders only when `hasPersonalContent` (`:80-90`) and pairs an `aria-hidden` arrow glyph run with an `sr-only` spelled-out version (`:84-87`).

### `src/components/game/developer-rail.tsx`
- **Role:** The lg+ recruiter sidebar beside the terminal.
- **Exports:** `DeveloperRail` (component).
- **Reads / depends on:** `@/lib/profile` (`profile`, `impactMetrics`, `resumeVariants`), `@/components/icons` (`Github`, `Linkedin`, `Npm`, `Pypi`, `Devto`, `Substack`), `@/components/ui/tooltip` `Tooltip`, `lucide-react` (`Download`, `Mail`).
- **Consumed by:** `game/developer-view.tsx:8`.
- **Behaviour notes:** Renders a `<dl>` of `impactMetrics` keyed by `m.sub` (`:28-39`), then **all** `resumeVariants` as `<a download>` links (`:44-64`), then a mailto link plus tooltip-wrapped GitHub, LinkedIn, npm, PyPI, Dev.to and Substack links (`:67-147`). It is a plain `<aside aria-label="Profile & contact">` — deliberately not a second landmark competing with the terminal (`:25`).
- **Gotchas / invariants:** Unlike the `resume` **command**, this rail is **not** gated by `NEXT_PUBLIC_RESUME_VARIANTS` — it maps every `resumeVariants` entry, which is one PDF today (`src/lib/profile.ts:136-142`), so it renders a single download link. The LinkedIn label is built as `linkedin.com/in/{profile.githubUser}` (`:98-99`), i.e. it reuses the GitHub username for the visible text (the `href` is `profile.links.linkedin`). The npm/PyPI/Dev.to/Substack links show a short static label, not the URL.

### `src/components/game/build-graph.tsx`
- **Role:** The gate deciding whether the 3D graph mounts at all, plus the inline dossier panel.
- **Exports:** `BuildGraph` (component).
- **Reads / depends on:** `motion/react` `useReducedMotion`, `@/lib/use-media-query` (`useMediaQuery`, `useWebGLSupported`), `@/lib/game-model` `questNodes`, `game/dossier-card`, `game/webgl-boundary`, and three voice stores: `chat/talk-overlay-store` `useTalkModeOpen`, `chat/anvil-inline-store` `useInlineVoiceOpen`, `chat/anvil-core-store` `useCoreVoiceOpen`. Lazily imports `./build-graph-scene` with `{ ssr: false }` (`:16`).
- **Consumed by:** `game/game-view.tsx:7`.
- **Behaviour notes:** The whole component returns `null` unless every condition passes: `isDesktop && !reduced && webglOk && !webglFailed && !talkOpen` (`:50`). `webglOk` comes from a **proactive** canvas probe because R3F's context failure is an async rejection an error boundary cannot catch (`:46-48`). `webglFailed` is set by `WebGLBoundary`'s `onFail` (`:43`). `talkOpen` ORs all three voice stores (`:38`) so only one live WebGL context exists at a time. Media query is `(min-width: 768px)` (`:28`); the canvas wrapper is `h-[26rem]` inside an `absolute inset-0` child so R3F's ResizeObserver measures a definite box (`:57-59`).
- **Gotchas / invariants:** Selecting a node stores only the id; `selected` is re-derived via `questNodes.find(n => n.id === selectedId)` (`:44`) — the ids are **graph node ids**, which are not always content slugs (`aava`, `grpc`, `nhl`; see `NODE_CONTENT` in `src/lib/game-model.ts:28-45` and the Testing Notes section of `CLAUDE.md`). The outer wrapper is also `hidden sm:block` (`:53`) on top of the JS media-query gate.

### `src/components/game/build-graph-scene.tsx`
- **Role:** The actual React Three Fiber canvas for the interactive graph.
- **Exports:** `default` → `BuildGraphScene({ onSelect })`; internal `Edges`, `Node`, `Graph` are module-private.
- **Reads / depends on:** `@/lib/r3f` barrel (`Canvas`, `useThree`, `useFrame`, `OrbitControls`, `THREE`, `ThreeEvent`), `@/lib/graph-data` `resolveKindColor`, `@/lib/use-theme-colors` `useThemeColors`, `@/lib/game-model` (`questNodes`, `graphEdgesResolved`).
- **Consumed by:** `game/build-graph.tsx:16` (dynamic, client-only).
- **Behaviour notes:** `SCALE = 1.6` multiplies every node/edge position (`:11`, applied at `:30-31` and `:138`). `Edges` builds one `BufferGeometry` in a `useMemo` with `[]` deps and draws a single `<lineSegments>` at `opacity 0.7`; the line color is `useThemeColors().graphEdge` (dark default `#3a4258`, re-resolved on a theme flip), not a hard-coded hex (`:25-44`). Node colors are `resolveKindColor(useThemeColors())[n.visualKind]` (`:127-128,137`). Each node is its **own** mesh (`sphereGeometry args={[0.16, 24, 24]}`, `meshBasicMaterial toneMapped={false}`) so it can be hovered/clicked (`:97-98`). Hover animation lerps scale toward `1.5` at factor `0.2` inside `useFrame` and calls `invalidate()` while the delta exceeds `0.005` (`:69-77`). `Canvas` config: `frameloop="demand"`, `resize={{ offsetSize: true }}`, `camera={{ position:[0,0,7], fov:45 }}`, `dpr={[1,1.75]}`, `gl={{ antialias:true, alpha:true, powerPreference:"high-performance" }}` (`:154-162`). `OrbitControls` disables pan/zoom, `rotateSpeed 0.6`, polar angle clamped to `[π/3, 2π/3]` (`:165-171`). Root group has a fixed `rotation={[0.12, -0.3, 0]}` (`:130`).
- **Gotchas / invariants:** The hover **label is commented out** (`:100-120`) — the recorded reason is that drei/troika `<Text>` without a local `font` prop fetches font metadata from `cdn.jsdelivr.net` and surfaces an uncatchable unhandled rejection offline. `Node` still declares and receives a `label` prop it never reads (`:49-59`, passed at `:136`); the `Billboard`/`Text` imports are already gone, and only the `:5` comment records that they are unused. `resize={{ offsetSize: true }}` (`:158`) is the documented fix for the "canvas stuck at 300×150" race in a freshly-mounted lazy container.

### `src/components/game/graph-index.tsx`
- **Role:** The accessible DOM-first index of every system — the default gamified layer.
- **Exports:** `GraphIndex` (component).
- **Reads / depends on:** `game/dossier-card`, `@/lib/game-model` (`questGroups`, `TOTAL_SYSTEMS`).
- **Consumed by:** `game/game-view.tsx:6`.
- **Behaviour notes:** No `"use client"` directive and no hooks — pure markup rendered inside the client `GameView` tree. Calls `questGroups()` once per render (`:12`) and emits a `<section aria-label="Explore every system">` with an `<h2 class="mono-label">` per group and a 1→2-column `<ul>` (`:24`).
- **Gotchas / invariants:** When a group has an odd node count, the **last** card is promoted to `sm:col-span-2` (`:26`) — a layout rule keyed off `g.nodes.length % 2`. `TOTAL_SYSTEMS` is printed verbatim in the intro copy (`:17`), so it tracks `questNodes.length` automatically.

### `src/components/game/dossier-card.tsx`
- **Role:** One system card, used both in the DOM index and in the 3D graph's inline panel.
- **Exports:** `DossierCard({ node }: { node: QuestNode })` (component).
- **Reads / depends on:** `@/lib/game-model` (`dossierFor`, `QuestNode`), `@/lib/graph-data` `resolveKindColor`, `@/lib/use-theme-colors` `useThemeColors`, `@/lib/discovery-store` `unlock`, `next/link`, `@/components/icons` `Github`.
- **Consumed by:** `game/graph-index.tsx:1`, `game/build-graph.tsx:9`.
- **Behaviour notes:** Every displayed value comes from `dossierFor(node)` (`:19`) — real metrics for work, `commits`/`technologies` counts for projects. The left accent rail is inline-styled from `resolveKindColor(useThemeColors())[node.visualKind]` (`:20-21`, `:26-30`), tying the card to its 3D node color. The theme tokens `--accent/--violet/--green/--amber` resolve to the dark defaults `work #38e1ff`, `agent #a78bfa`, `engine #4ade80`, `tool #fbbf24` (`src/lib/use-theme-colors.ts:25-31`; the static `kindColor` map at `src/lib/graph-data.ts:112-117` is the SSR-safe fallback and no longer read here). Tech chips are capped at 5 (`:70`). A GitHub icon link renders when `d.repo` is set (`:39-49`).
- **Gotchas / invariants:** There are **two** links to the same `d.href` (title at `:33-38` and "Open dossier" at `:80-86`) but only the second calls `unlock("dossier-open")` (`:82`) — clicking the title does not record that discovery.

### `src/components/game/webgl-boundary.tsx`
- **Role:** The single WebGL error boundary used by every 3D surface in the app.
- **Exports:** `WebGLBoundary` (class component) — props `{ children, onFail? }`, state `{ failed: boolean }`.
- **Consumed by:** `game/build-graph.tsx:10`, `src/components/chat/voice-orb.tsx:7`, `src/components/hero-avatar/index.tsx:8`, `src/components/hero-graph/index.tsx:8` (used at `:79`), `src/app/not-found.tsx:26`.
- **Behaviour notes / fallback:** `getDerivedStateFromError()` flips `failed` (`:19-21`); `componentDidCatch` logs `console.warn("[build-graph] WebGL scene unavailable — falling back to the index.", error)` and invokes `onFail?.()` (`:23-27`); `render()` returns **`null`** once failed — a silent fallback, no error UI (`:30`). The comment at `:10-11` records why this must be a class: only class boundaries catch descendant render errors.
- **Gotchas / invariants:** It **only** catches synchronous render/lifecycle throws — `build-graph.tsx:46-48` documents that async WebGL context rejection is why `useWebGLSupported()` probes proactively as well, and `hero-graph/index.tsx:38-47` records the same limitation as a known gap (an async context-creation failure during the Classic↔Gamified handoff never reaches `componentDidCatch`, so `onFail` does not run and the canvas stays mounted broken). The `console.warn` prefix is hard-coded to `[build-graph]` even though three non-graph callers reuse this boundary (`:25`).

### `src/components/game/easter-eggs.tsx`
- **Role:** The two global easter eggs, mounted once for every view.
- **Exports:** `EasterEggs` (component).
- **Reads / depends on:** `@/lib/profile` `profile`, `@/lib/personal` (`personal`, `hasPersonalContent`), `@/lib/discovery-store` `unlock`, `lucide-react` (`X`, `Sparkles`).
- **Consumed by:** `src/app/layout.tsx:14` (root layout — hence "works in every view").
- **Behaviour notes:**
  - **Egg 1 — console greeting** (`:73-84`): guarded by the *module-level* `let consoleGreeted = false` (`:38`), prints a two-style `console.log` with name, role, email, GitHub, npm, PyPI, Dev.to and Substack, and appends `"(psst — type \`secret\` in Developer mode, or try the Konami code)"` when `hasPersonalContent`, else just the Konami hint (`:76-80`).
  - **Egg 2 — Konami code** (`:87-111`): the sequence is exactly `ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight, ArrowLeft, ArrowRight, b, a` (`:25-36`) — matching `developer-view.tsx:84`'s advertised `↑↑↓↓←→←→ B A`. Comparison is case-insensitive on both sides (`:94`) and ignores modifier keys, so Shift+B counts. A wrong key resets progress to `1` if it was itself the first key, else `0` (`:105-106`). On completion it records `document.activeElement`, calls `unlock("konami")` and opens the card (`:96-102`).
  - The card is a **non-modal disclosure**: `role="dialog"`, `aria-modal="false"`, `aria-labelledby` a `useId()` heading, `tabIndex={-1}` (`:146-149`), focused on open (`:114-116`), Esc-closable (`:126-133`), no focus trap, no backdrop, `z-40` (`:153`). `close()` restores `prevFocus` (`:118-123`).
  - Content: `konamiReveal()` returns `personal.funFacts[0] ?? personal.hobbies[0] ?? personal.currentlyLearning[0]` or `null` (`:53-61`); with no personal content the card degrades to "Thanks for exploring — now go read a dossier." (`:183-185`) rather than fabricating a fact.
- **Gotchas / invariants:** `isTypingTarget()` (`:41-50`) checks `INPUT`/`TEXTAREA`/`isContentEditable` and **zeroes progress** — this is what stops the arrow keys from fighting the terminal's ↑/↓ history. `consoleGreeted` is module state, so the greeting is once per loaded JS module instance (a full page reload re-prints it), despite the "once per session" wording. The dismiss button is explicitly sized `h-7 w-7` because Tailwind preflight zeroes button padding and it would otherwise collapse to ~15 px (`:159-161`, WCAG 2.5.8). `.hero-rise` is reused because Tailwind v4 here has no `tailwindcss-animate`, so `animate-in` utilities silently no-op (`:150-152`).

### `src/components/game/discovery-badge.tsx`
- **Role:** The floating discovery-progress pill.
- **Exports:** `DiscoveryBadge` (component).
- **Reads / depends on:** `@/lib/discovery-store` (`useDiscoveries`, `DISCOVERY_TOTAL`).
- **Consumed by:** `src/components/providers.tsx:21-24` as a `dynamic(..., { ssr: false })` import, mounted only when the `discoveryBadgesEnabled` prop is true (`providers.tsx:60`).
- **Behaviour notes:** Returns `null` while `count === 0` (`:37`) — no badge on a first visit. Renders `role="status" aria-live="polite"` with an `aria-label` of `"<n> of <total> site areas discovered"` and the visible text `★ n/DISCOVERY_TOTAL discovered` (`:40-47`). Fixed `right-5 z-30`, stacked 46 px **above** the command-palette trigger: `bottom-[calc(5rem+46px)]` below `sm` and `sm:bottom-[calc(1.25rem+46px)]` from `sm` up (`:44`), tracking the trigger's own responsive offset (rationale at `:14-23`).
- **Discovery-badge system (the 5 keys):** `DISCOVERY_TOTAL = 5` derives from `ALL_KEYS` in `src/lib/discovery-store.ts:20-26`. The store is a module-level `useSyncExternalStore` store persisted to `localStorage` under `"anvilry:discoveries"` (`discovery-store.ts:19`), with a `getServerSnapshot` of an empty Set (`:63`) and try/catch degradation on both read and write (`:31-48`). `unlock()` is idempotent and replaces the Set immutably (`:66-71`); `unlockAll()` exists as a Cmd+K escape hatch (`:74-78`). Call sites, per the comment block at `discovery-badge.tsx:26-31`: `view-switch` → `view-context.tsx:213`, `chat-question` → `chat-messages.tsx:335`, `terminal-command` → `use-terminal.ts:44`, `konami` → `easter-eggs.tsx:100`, `dossier-open` → `dossier-card.tsx:82`.
- **Gotchas / invariants:** The component itself does **not** read `NEXT_PUBLIC_DISCOVERY_BADGES`. The flag is resolved server-side by `getDiscoveryBadgesEnabled()` (`src/lib/flags.ts:41`) and threaded through `layout.tsx` → `providers.tsx` — so the badge is also the one flag routed through the Vercel Flags SDK path (`src/lib/flags.ts:5-18`). Nothing is ever gated by discovery count.

### `src/components/game/glass-box-demo.tsx`
- **Role:** The glass-box multi-agent trace UI (zero-LLM-cost, deterministic replay).
- **Exports:** `GlassBoxDemo` (component).
- **Reads / depends on:** `@/lib/agent-trace` (`AGENTS`, `scenarios`, `traceApproved`, `linkForSlug`), `game/use-trace-runner`, `@/lib/use-mounted` `useMounted`, `motion/react` `useReducedMotion`, `lucide-react` (`Play`, `RotateCcw`).
- **Consumed by:** `game/game-view.tsx:8`.
- **Behaviour notes:** `useTraceRunner(scenario, !!reduced || !mounted)` — reduced-motion **or** pre-hydration means instant full reveal (`:27`). Esc resets, with the listener attached only while `status !== "idle"` (`:29-37`). Scenario selection is a native `<select>` whose `onChange` calls `reset()` before switching index (`:58-60`). A `sr-only` `aria-live="polite" aria-atomic="true"` div carries `liveMessage` (`:91-93`). Steps render as an `<ol>` sliced to `revealedCount` (`:96`), each with the agent's `label`/`role`/`color` from `AGENTS` and the step's `ms` (`:100-109`). `step.refs` slugs render as links only when `linkForSlug(slug)` is non-null (`:114-124`) — the zero-fabrication guard.
- **PLACEHOLDER_SENTINEL gate:** `if (!traceApproved) return null;` at `:40` — placed **after** all hooks so hook order stays stable. `traceApproved` is computed in `src/lib/agent-trace.ts:120-122` as "no step's `action` or `output` contains `PLACEHOLDER_SENTINEL`", where `PLACEHOLDER_SENTINEL = "[DRAFT — owner to approve]"` (`agent-trace.ts:22`). **At v3.8.0 every scripted step still carries the sentinel** (`agent-trace.ts:59-101`), so `traceApproved === false` and this component renders nothing in production. **Correction (this index previously called `agent-trace.test.ts` a "deploy-blocking guard" — that was never true and the source now says so outright):** the test is a *consistency* check, not a ship gate. Its single assertion is `expect(traceApproved).toBe(!hasSentinel)` (`src/lib/agent-trace.test.ts:51-57`), which passes in **both** states, so it can never fail the build; the docblock over `traceApproved` says "NOT a hard build failure" (`agent-trace.ts:114-119`) and the file's header banner now agrees ("NOT block the build" — `agent-trace.ts:3-18`). See the Testing Notes section of `CLAUDE.md`. The real protection is that `traceApproved === false` makes this component render nothing, so un-reviewed prose ships dark rather than being blocked.
- **Gotchas / invariants:** Removing/renaming the sentinel in `agent-trace.ts` immediately ships the demo — that string is the shipping switch, not a lint marker.

### `src/components/game/use-trace-runner.ts`
- **Role:** The trace-runner — a deterministic timer state machine over owner-authored trace data.
- **Exports:** `useTraceRunner(scenario, reduced)` → `{ status, revealedCount, liveMessage, run, reset }`; `RunnerStatus = "idle" | "running" | "done"`.
- **Reads / depends on:** `@/lib/agent-trace` `Scenario` (type only).
- **Consumed by:** `game/glass-box-demo.tsx:9`, `use-trace-runner.dom.test.tsx`.
- **Behaviour notes:** All `setTimeout` handles are collected in a ref and cleared by `clearTimers()` (`:20-25`). `run()` clears, sets `running`, resets the count, then either (a) `reduced` → reveal `scenario.steps.length` instantly, `status = "done"`, `liveMessage = "Trace complete."`, no timers (`:39-45`), or (b) schedules one timeout per step at a **cumulative** `elapsed += step.ms` offset (`:47-66`). On the final step it sets `status = "done"` and folds the settle into a **single** message `"<agent>: <action>. Trace complete."` (`:58-61`) — the comment records that two `setLiveMessage` calls in one tick collapse to one commit, so a separate "Trace complete." would overwrite and silence the last agent.
- **Gotchas / invariants:** `useEffect(() => reset, [reset])` (`:70`) registers `reset` as the **cleanup** function. `reset` depends only on `clearTimers`, which has `[]` deps, so its identity is stable — meaning this effect's cleanup effectively fires on **unmount only**, not when `scenario` changes (the header comment says "Reset when the scenario changes"). Scenario changes are reset explicitly by the `<select>`'s `onChange` in `glass-box-demo.tsx:59`. `step.ms` values are treated as **inter-step delays**, not absolute timestamps.

### `src/components/game/skill-tree.tsx`
- **Role:** A self-contained SVG "RPG skill tree" of `profile.skills`, laid out as 2 rows × 3 hex categories with bezier trunks to staggered skill pills.
- **Exports:** `SkillTree` (component). All geometry/filter helpers are module-private.
- **Reads / depends on:** `@/lib/profile` `skills`, `@/lib/use-theme-colors` `useThemeColors`, `motion/react` `useReducedMotion`. No content-layer or network deps.
- **Consumed by:** `game/game-view.tsx:10-13` — `dynamic(..., { ssr: false })`, rendered only when `NEXT_PUBLIC_SKILL_TREE === "true"` (`game-view.tsx:57`). No other importer.
- **Behaviour notes:**
  - Row assignment is **hard-coded by group name**: `ROW1_GROUPS = ["Languages", "GenAI", "Backend & Distributed"]`, `ROW2_GROUPS = ["Data & Messaging", "Cloud & Ops", "Frontend"]` (`:61-62`); colors are built per render from `useThemeColors()` (`:408-415`): `Languages → accent`, `GenAI → violet`, `Backend & Distributed → green`, `Data & Messaging → amber` follow the live theme, while `Cloud & Ops` (`#f87171`) and `Frontend` (`#38bdf8`) are the hard-coded `STATIC_GROUP_COLORS` (`:32-35`); `DEFAULT_COLOR = "#94a3b8"` (`:36`) covers unknown groups. `catAbbrev`'s map (`:133-140`) is keyed by the same six strings, with a `slice(0,5).toUpperCase()` fallback (`:141`).
  - Layout constants (`:39-56`): `FONT_SIZE 10`, `MONO_CW 6.2` (estimated mono char width), `PILL_PADDING 16`, `PILL_H 28`, `MIN_PILL_W 72`, `CAT_W 60`, `CAT_H 38`, `ROW_GAP 16`, `TRUNK_GAP 60`, `STAGGER_X 12`, `COL_PAD 12`, `GAP_BETWEEN 14`, `ROW_VERT_GAP 48`, `SVG_W 976`, `CAT_Y_ROW1 20`. Pill widths are **estimated** from `label.length * MONO_CW`, never measured (`:65-68`).
  - `buildRowColumns` is two-pass: pass 1 computes per-column widths/heights in relative coords, then the row is centred in `SVG_W` and pass 2 assigns absolute X (`:162-218`). `buildColumns` stacks row 2 at `row1Bottom + ROW_VERT_GAP` and sets `svgHeight = row2Bottom + 32` (`:220-244`).
  - `connectionPath` uses diagonal control points at `0.25` horizontal / `0.40` vertical factors so the bezier arrives from directly above a staggered pill (`:99-117`); pills alternate `±STAGGER_X` by index parity (`:175`).
  - Per-node animation timing is **deterministic**: `hashStr` (Math.imul-31 hash) seeds `stableRandom` (LCG) to pick a `1.4–2.2s` dash duration and a `0–1.2s` delay, with the delay seed XORed by `0x5f3759df` (`:120-129`, `:445-447`).
  - Render order is three explicit layers — connections, pills, hexagons last so they sit on top (`:432`, `:498`, `:517`) — plus a dashed row separator computed inline (`:631`) and inline `@keyframes skillDash` (`:659-667`).
  - Interaction: clicking/Enter/Space on a hexagon toggles `active` (`:418-419`, `:526-536`); non-active groups drop to `opacity 0.25` (hex, `:539`), `0.15` (pills, `:341`), `0.08` (connections, `:453`). Every `filter`/dash animation is suppressed when `reducedMotion` is true.
  - A11y: the `<svg role="img">` carries a summary `aria-label` (`:427-429`) inside a `role="region"` wrapper (`:422`); each hexagon `<g>` is `role="button" tabIndex={0} aria-pressed` with an `aria-label` of `"<group>: <items joined>"` (`:527-530`); **every pill group is `aria-hidden="true"`** (`:349`); and an `aria-live="polite"` strip below the SVG announces the active group and its items (`:673-679`).
- **Gotchas / invariants:**
  - `skills.find((s) => s.group === groupName)!` (`:169`) is a **non-null assertion**. Renaming or removing any of the six group names in `src/lib/profile.ts:72-121` makes this throw at render time (and the color map and `catAbbrev` silently fall back). The current `profile.skills` groups match exactly.
  - The inline `<style>` at `:659-667` contains an **unscoped** `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }` — a global `*` selector injected from inside the SVG.
  - Filter ids are derived by `col.group.replace(/[^a-z0-9]/gi, "-")` in **five** places (`:258`, `:285`, `:435`, `:501`, `:521`) — the same expression must stay consistent across `<defs>` and every consumer.
  - `buildColumns(groupColors)` runs on **every render** (`:416`), unmemoized; the `<filter>` color matrices parse `col.color` as `#rrggbb` (`colorToMatrix`, `:247-252`), so theme tokens must keep resolving to 6-digit hex.

## Coverage

- `src/components/game/build-graph-scene.tsx`
- `src/components/game/build-graph.tsx`
- `src/components/game/developer-rail.tsx`
- `src/components/game/developer-view.tsx`
- `src/components/game/discovery-badge.tsx`
- `src/components/game/dossier-card.tsx`
- `src/components/game/easter-eggs.tsx`
- `src/components/game/game-view.tsx`
- `src/components/game/glass-box-demo.tsx`
- `src/components/game/graph-index.tsx`
- `src/components/game/skill-tree.tsx`
- `src/components/game/use-trace-runner.ts`
- `src/components/game/webgl-boundary.tsx`
- `src/components/game/terminal/boot-banner.ts`
- `src/components/game/terminal/commands.ts`
- `src/components/game/terminal/completion.ts`
- `src/components/game/terminal/fmt.ts`
- `src/components/game/terminal/history.ts`
- `src/components/game/terminal/terminal-overlay.tsx`
- `src/components/game/terminal/terminal.tsx`
- `src/components/game/terminal/theme.ts`
- `src/components/game/terminal/types.ts`
- `src/components/game/terminal/use-terminal.ts`

**Excluded (tests, out of scope):** `easter-eggs.dom.test.tsx`, `use-trace-runner.dom.test.tsx`, `terminal/commands.test.ts`, `terminal/commands-empty-safe.test.ts`, `terminal/completion.test.ts`, `terminal/history.test.ts`, `terminal/terminal.dom.test.tsx`, `terminal/terminal-overlay.dom.test.tsx`, `terminal/theme.test.ts`, `terminal/use-terminal.dom.test.tsx`.

## UNVERIFIED

- The command count is quoted as prose in `CLAUDE.md` (View System table), `ARCHITECTURE.md` (game/terminal tree entry) and `README.md` (Developer view bullet), and `commands.test.ts` does not pin the total, so adding or removing a command drifts all three silently. The registry holds **32** (28 visible + 4 hidden, since the visible `integrity` command was added); `commands.ts:689-722` is authoritative.
- `easter-eggs.tsx:14` and `:72` describe the console greeting as "once per session", but the guard is a module-level `let` (`:38`) with no storage — I could not find any session-persistence mechanism, so the effective scope is per module instance.
- Whether `NEXT_PUBLIC_SKILL_TREE` / `NEXT_PUBLIC_RESUME_VARIANTS` are set in any deployed Vercel environment — only the local `.env.example` (commented out) and `Makefile` defaults (`false`) were inspected.
