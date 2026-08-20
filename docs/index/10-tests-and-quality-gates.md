---
kind: doc
title: Tests, E2E & Quality Gates
domain: [content]
status: current
version: v3.4.2
---

# Tests, E2E & Quality Gates

> Part of the Anvilry v3.4.2 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `src/**/*.test.{ts,tsx}`, `src/**/*.dom.test.{ts,tsx}`, `e2e/resume.spec.ts`, `e2e/views.spec.ts`, `vitest.config.ts`, `playwright.config.ts`
**Files indexed:** 67 (65 test/spec files + 2 configs)

## Runner topology (facts first)

- `pnpm build` = `velite --clean && vitest run && next build` (`package.json:8`). **A failing Vitest assertion aborts the build before `next build` runs — so every test in this file is a deploy blocker on the Vercel build path.**
- `pnpm test` = `vitest run`; `pnpm test:watch` = `vitest` (`package.json:11-12`).
- `pnpm e2e` = `playwright test`; `pnpm e2e:ui` = `playwright test --ui` (`package.json:15-16`).
- **Two Vitest projects** (`vitest.config.ts:27-45`):
  - `node` — `environment: "node"`; include `["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"]`; exclude `["**/*.dom.test.{ts,tsx}", "**/node_modules/**"]` (`vitest.config.ts:30-35`). The exclude is load-bearing: `src/x.dom.test.ts` also matches `src/**/*.test.ts`, so without it every DOM suite would run twice — once without happy-dom globals.
  - `dom` — `environment: "happy-dom"`; include `["src/**/*.dom.test.{ts,tsx}", "tests/**/*.dom.test.{ts,tsx}"]` (`vitest.config.ts:38-43`). No explicit `exclude` — it relies on Vitest's default node_modules exclusion.
  - `tests/` does not exist in the repo; both include globs carry a `tests/**` arm that currently matches nothing.
  - `resolve: { tsconfigPaths: true }` (`vitest.config.ts:17`) is what lets tests import the real `@/*` modules and the generated `.velite` output rather than re-implementations.
- **`env: { NODE_ENV: "test" }`** (`vitest.config.ts:26`). Reason recorded in the config comment (`vitest.config.ts:19-25`): Vitest only defaults `NODE_ENV=test` when it is *unset*, but the Vercel build shell sets `NODE_ENV=production`; React would then load its production bundle, which strips `act`, and every `renderHook`/`render` DOM test would die with "React.act is not a function" and fail the deploy. Setting it in config is deterministic and scoped to the Vitest worker only — the separate `next build` process still runs in production mode.
- **`.velite/` is gitignored but required.** Many node-project tests import `@/lib/content` (which reads `.velite`), so CI generates it first: `pnpm content` runs before lint/typecheck/test (`.github/workflows/ci.yml:43-53`).
- **Playwright** (`playwright.config.ts`): `testDir: "./e2e"`, `fullyParallel: true`, `forbidOnly: !!CI`, `retries: CI ? 2 : 0`, `workers: CI ? 1 : undefined`, `reporter: "html"`, `use.baseURL: "http://localhost:3000"`, `trace`/`video`: `"on-first-retry"`. One project only: `chromium` / `devices["Desktop Chrome"]` (`playwright.config.ts:15-20`). `webServer: { command: "pnpm start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 120_000, stdout: "ignore", stderr: "pipe" }` (`playwright.config.ts:33-40`) — the comment at `playwright.config.ts:23-32` records why it was added: a stale server on :3000 silently made Playwright test an older build, producing 5 phantom "failures" during a release audit.
- **CI jobs** (`.github/workflows/ci.yml`): job `ci` = install → `pnpm content` → `pnpm lint` → `npx tsc --noEmit` → `pnpm test`; job `e2e` = install → `playwright install --with-deps chromium` → `pnpm build` → `pnpm e2e`, uploading `playwright-report/` on failure; job `security-alerts` is `continue-on-error: true` (`ci.yml:126`) and always exits 0 by design (`ci.yml:102-178` — the last job in the file).

## At a glance

Terse index of all 67 files in scope, in the same order as [Coverage](#coverage). The Guard matrix below carries the full assertion detail.

| File | Role | Key exports/assertions |
|---|---|---|
| `vitest.config.ts` | Vitest config: two named projects (`node`, `dom`) + forced test `NODE_ENV` | `default` config object |
| `playwright.config.ts` | Playwright config for `e2e/`: single `chromium` project, `webServer: pnpm start` | `default` config object |
| `e2e/resume.spec.ts` | `/resume` behaviour under both `NEXT_PUBLIC_RESUME_VARIANTS` states | Flag-OFF: master pill only, no `<details>`; flag-ON describe skipped in CI |
| `e2e/views.spec.ts` | Live-app smoke: all 4 views + SEO routes + 2 API endpoints | Per-view selectors, `/llms.txt` `/sitemap.xml` `/robots.txt` 200, `/api/resume.json` `basics` |
| `src/app/api/error/route.test.ts` | Validation + redaction contract for the browser error sink | 204 + one `client.error`; Zod 400s; 413 at >8KB before `req.json()`; 429 + `Retry-After` |
| `src/app/api/tts-google/cache.test.ts` | Google TTS audio cache keying | Per-voice key distinctness, round-trip, eviction ≤100 |
| `src/app/api/tts-google/route.test.ts` | Google TTS route contract | 503 without key; 400/413 rejections; base64 → `audio/mpeg`; 502 on bad upstream |
| `src/app/api/tts/cache.test.ts` | Polly TTS audio cache keying + tier gate | Key varies by voice AND tier; LRU bump; `CACHE_MAX = 100`; `ALLOWED_TIERS` |
| `src/app/layout.hydration-proof.dom.test.tsx` | Documentation lock for `suppressHydrationWarning` (not a product test) | With prop React is silent; without it, mismatch logged |
| `src/components/ask-portfolio.dom.test.tsx` | Phase 0 unification contract for the ask widget | Streams via shared `useChat` transport → `/api/chat`; surfaces the 503 copy |
| `src/components/chat/anvil-inline-panel.dom.test.tsx` | Non-modal inline disclosure a11y | `role="region"`; `aria-expanded`/`aria-controls`; outside pointerdown closes + restores focus |
| `src/components/chat/markdown-message.test.ts` | Streaming markdown delimiter balancer | `closeOpenMarkdown` never mangles complete markdown; idempotent; explicitly not an XSS test |
| `src/components/chat/mic-button.dom.test.tsx` | Mic consent gate | Nothing when unsupported; first click shows privacy dialog and does not start the engine |
| `src/components/chat/parse-cards.test.ts` | Prompt-injection / XSS fail-closed gate for the card layer | Slugs resolve only against the Velite allowlist; hostile paths/schemes dropped; raw HTML inert |
| `src/components/chat/talk-mode.dom.test.tsx` | Talk-mode UI surface | Unsupported → type-instead fallback; captions stripped of `**` and `[[card:`; Esc/End close |
| `src/components/chat/use-chat-a11y.dom.test.tsx` | Single `aria-live` announcement string | Streaming → `"Answering…"`; TTS on → status line, never the answer text |
| `src/components/chat/use-chat-stream.dom.test.tsx` | Drives the real `useChat` read loop | rAF coalescing; trailing chunk never dropped; background-tab safety timer; abort keeps partial |
| `src/components/chat/use-chat.test.ts` | Tests a local replica of `splitTrace`, not the shipping module | Sentinel-stripping + trace parsing on the copy (weak) |
| `src/components/chat/use-speech-recognition.dom.test.tsx` | Browser STT wrapper | Honest `supported`; no `getUserMedia` before `start()`; `NotAllowedError` → calm error |
| `src/components/chat/use-speech-synthesis.dom.test.tsx` | Browser + remote TTS queueing | `splitSentences` ≤200-char cap; `resetTurn()` required or turn ≥2 goes silent; failure cascade |
| `src/components/chat/use-stt.dom.test.tsx` | STT engine selection | `browser` → browser; `transcribe` → Transcribe if supported; falls back on unsupported or runtime error |
| `src/components/chat/use-voice-session.dom.test.tsx` | Talk-mode state machine over mocked hooks | `resetTurn` once per turn rising edge; `cancel()` never on same-turn re-render; `interrupt()` cancels TTS + fetch |
| `src/components/chat/voice-picker.dom.test.tsx` | Curated voice picker | One card per voice; `aria-pressed` on current; preview toggles; sr-only `aria-live` region |
| `src/components/chat/voice-pitfalls.dom.test.ts` | Browser/UA voice pitfalls (DOM half) | `isIOS`/`isAndroid`/`isFirefox`; `getVoicesRaceHardened` paths; `detectScreenReader` never flips TTS on |
| `src/components/chat/voice-pitfalls.test.ts` | Browser/UA voice pitfalls (pure half) | `voiceURIToGender`; `isLinuxESpeak`; `localeFallbackChain`; `normalizeVoiceURI` |
| `src/components/chat/voice-surface-mutex.test.ts` | Single-live-mic arbitration | Claiming closes every OTHER surface and never itself; 3-surface arbitration; `unregister` |
| `src/components/chat/wake-word-controller.dom.test.tsx` | Wake-word consent gate | Off → never arms; enabled → disclosure dialog first; never arms on a non-voice view |
| `src/components/game/easter-eggs.dom.test.tsx` | Konami egg + anti-fabrication | Labelled `role="dialog"` with a REAL owner fact; Esc restores focus; suppressed in text inputs |
| `src/components/game/terminal/commands-empty-safe.test.ts` | Terminal registry with mocked empty `personal.ts` | `secret`/`uses`/`now` degrade to copy, never error; breadcrumb suppressed |
| `src/components/game/terminal/commands.test.ts` | Coverage + anti-fabrication gate for the terminal registry | Hidden eggs dispatch but stay out of help; `career` invents no year; `commandEventName` strips args |
| `src/components/game/terminal/completion.test.ts` | Tab completion | Unique prefix completes + trailing space; ambiguous/no-match → `null`; args never completed |
| `src/components/game/terminal/history.test.ts` | `nextHistoryIndex` boundaries | `-1` = live input; clamp at 0; down past newest resets; round-trip |
| `src/components/game/terminal/terminal-overlay.dom.test.tsx` | Fullscreen terminal dialog focus return | Controlled Radix dialog restores focus to the external trigger (WCAG 2.4.3) |
| `src/components/game/terminal/terminal.dom.test.tsx` | Terminal combobox a11y | Input `role="combobox"`; `aria-controls` resolves to a real listbox always in the DOM |
| `src/components/game/terminal/theme.test.ts` | Theme cycling | cyan→green→amber→cyan; full cycle returns to `THEMES[0]` |
| `src/components/game/terminal/use-terminal.dom.test.tsx` | Terminal command effects | `clear` empties scrollback; view vs route uses `setView` vs `router.push`; `resume` opens with `noopener` |
| `src/components/game/use-trace-runner.dom.test.tsx` | Sequential trace reveal + a11y announcement | Final `liveMessage` in ONE string; `reduced=true` reveals instantly; `reset()` kills orphan timers |
| `src/components/hero-avatar/index.dom.test.tsx` | Avatar mount gate | `null` unless `NEXT_PUBLIC_HERO_MODE=avatar`; CSS glow fallback; position classes |
| `src/components/hero-avatar/rig.test.ts` | Bone resolution | Head/neck/chest/spine incl. `!includes("spine1")`; empty scene returns all-null |
| `src/components/hero-avatar/use-avatar-gaze.test.ts` | `computeGaze` clamping | `eyeLX` ±0.15, `eyeLY` ±0.1 across 1000 ticks; yaw sign; L/R symmetry |
| `src/components/hero-avatar/use-avatar-idle.test.ts` | `computeIdle` breathing | `chestY` within ±0.003; `spineY === chestY * 0.5`; changes over time |
| `src/components/site-footer.dom.test.tsx` | VisitorBadge cache fallback | Renders API count; falls back to cache on `total: 0`/throw; never overwrites cache with 0 |
| `src/components/view-context.test.ts` | 4-view store contract | `VIEWS` includes voice; `isView` rejects non-views; `DEFAULT_VIEW` and `getServerSnapshot()` are `"classic"` |
| `src/lib/admin-auth.test.ts` | `requireAdmin` deny paths | 401 when unset/wrong/non-Basic/bad base64; `WWW-Authenticate` + `Cache-Control: no-store` |
| `src/lib/agent-trace.test.ts` | Glass-box demo scaffolding | Refs resolve; ≥2 scenarios; known agents; <8000ms/scenario; `traceApproved === !hasSentinel` (consistency, not ship block) |
| `src/lib/avatar-glb.test.ts` | Binary-asset invariant guard for `public/avatar/sairam.glb` | glTF 2.0; <1.5 MB; meshopt/quantization/WebP extensions; bones present; zero morph targets |
| `src/lib/case-study-depth.test.ts` | Work optional-field depth gate | `diagram` ⇒ non-empty `diagramAlt` + asset on disk; constraints/tradeoffs >20 chars, not TODO |
| `src/lib/corpus.test.ts` | Chat grounding corpus shape | Always carries profile name + `## Production Work` + `## Skills`; `## Personal` present IFF populated |
| `src/lib/game-model.test.ts` | Graph↔content bijection (the headline deploy gate) | Forward/reverse coverage, count identity, href shape, once-only grouping, dossier facts are real metrics |
| `src/lib/github.test.ts` | GitHub feed fail-open | `REPO_ALLOWLIST` unique + 2 named extras; failure → `[]`; newest-push sort; `Bearer` only with token |
| `src/lib/llm-sdk-mode.test.ts` | SDK-mode flag default (one-shot smoke) | Default `"anthropic-bedrock"`; read-once stability |
| `src/lib/llm-trace.test.ts` | Trace wire-protocol constants | `TRACE_DELIMITER` U+001E; `THINKING_SENTINEL`/`THINKING_END`; `TraceFrame` has no `reasoning` |
| `src/lib/llm.test.ts` | Largest suite (563 lines): `streamWithFallback` telemetry, fallback invariant, thinking protocol | snake_case usage keys pinned; `emittedAny` invariant; model IDs pinned; no `reasoning` in trace frame |
| `src/lib/mcp-tools.test.ts` | MCP tool surface | No `personal.ts` leak; counts equal content counts; fail-closed `notFound` + `valid[]`; every RESUME PDF exists |
| `src/lib/notes.test.ts` | Notes access layer | `hasNotes` mirrors count; no drafts; newest-first; parseable dates |
| `src/lib/personal.test.ts` | Personal content shape | Arrays + `now`; `hasPersonalContent`/`hasNow` are exact IFFs |
| `src/lib/scroll/resolve-flag.test.ts` | Scroll-flag precedence | param > stored > fallback; never returns outside the allowed set |
| `src/lib/scroll/use-stick-to-bottom-custom.dom.test.tsx` | Custom auto-scroll state machine under happy-dom | Pinned growth snaps; user scroll-up de-pins; 150 ms programmatic guard; `message-top` parks at `offsetTop - 12` |
| `src/lib/scroll/use-stick-to-bottom-library.dom.test.tsx` | Library adapter smoke test | Mounts, exposes the `UseAutoScroll` shape, no-ops when disabled |
| `src/lib/telemetry/beacon.dom.test.ts` | Unload-safe error beacon | `sendBeacon` with JSON Blob; fetch fallback `keepalive: true`; never throws |
| `src/lib/telemetry/emit.test.ts` | Fire-and-forget event sink | `console.log("[trace]", …)` always fires; Redis key + `ts` score; 7d trim; all failures swallowed |
| `src/lib/telemetry/schema.test.ts` | Event schema + PII redaction | All `KIND_LITERALS` parse; exact 7-kind union order; `redact()` thresholds; `hashIp` + salt isolation |
| `src/lib/telemetry/with-trace.test.ts` | `/api/*` observability wrapper contract | v4 UUID trace id; one `http.request`; `server.error` re-throws; **last** XFF segment; streaming survives |
| `src/lib/testimonials.test.ts` | Testimonial verifiability | `hasTestimonials` mirrors array; every entry has an `https?://` `sourceUrl` |
| `src/lib/voice-catalog.test.ts` | Authoritative voice catalog | 6 curated voices; unique ids; per-engine required fields; cross-engine + tier rejection |
| `src/lib/voice-picker-mode.test.ts` | Picker-mode flag default (one-shot smoke) | Default `"descriptor"`; getter and constant agree |
| `src/lib/voice-settings-context.test.ts` | Persisted voice prefs | Every capability defaults OFF except `captions`; `parse()` never throws; v1.6→v1.7 with no migration |

## Guard matrix

| Test file | Module under test | What it asserts | Breaking it means | Project |
|---|---|---|---|---|
| `src/lib/game-model.test.ts` | `game-model.ts`, `graph-data.ts`, `content.ts` | Node↔content bijection, slug existence in Velite, href shape, quest grouping, dossier facts trace to real metrics | **Deploy blocker.** A graph node points at nonexistent content, or content is unreachable in Play view | node |
| `src/lib/agent-trace.test.ts` | `agent-trace.ts` | Ref slugs resolve; ≥2 scenarios; known agents; per-scenario total <8000ms; `traceApproved === !hasSentinel` | Deploy blocker only if the gate flag and sentinel state disagree — **not** if the sentinel is present (see below) | node |
| `src/lib/llm.test.ts` | `llm.ts` `streamWithFallback` | snake_case usage keys pinned; `emittedAny` fallback invariant; onAttempt safety; traceId threading; extended-thinking byte protocol | Deploy blocker. Token/cache telemetry silently zeroes, or fallback emits a wrong-model trace frame | node |
| `src/components/chat/parse-cards.test.ts` | `parse-cards.ts` | Card tokens resolve only against the Velite slug allowlist; hostile paths/schemes/uppercase dropped; raw HTML stays inert text | Deploy blocker. This is the real prompt-injection / XSS fail-closed gate | node |
| `src/components/chat/markdown-message.test.ts` | `markdown-message.tsx` `closeOpenMarkdown` | Streaming delimiter balancer; never mangles complete markdown; idempotent | Deploy blocker. Half-streamed markers flash literally. Explicitly **not** an XSS test (see `markdown-message.test.ts:9-11`) | node |
| `src/components/ask-portfolio.dom.test.tsx` | `ask-portfolio.tsx` | Widget streams through the shared `useChat` transport, POSTs to `/api/chat`; surfaces the 503 message | Deploy blocker. The widget regresses to a private fetch loop | dom |
| `src/lib/corpus.test.ts` | `corpus.ts`, `personal.ts`, `profile.ts` | Corpus always carries profile name + `## Production Work` + `## Skills`; `## Personal` present IFF personal.ts populated | Deploy blocker. Chat grounding loses the professional record or leaks an empty Personal section | node |
| `src/lib/mcp-tools.test.ts` | `mcp-tools.ts` | No personal.ts leak; list counts equal content counts; fail-closed `notFound` + `valid[]`; every `RESUME_ROLES` PDF exists on disk | Deploy blocker. MCP fabricates or leaks personal data | node |
| `src/lib/content`-backed: `notes.test.ts` | `content.ts` notes | `hasNotes` mirrors count; no drafts; newest-first; parseable dates | Deploy blocker. Dead nav link or unsorted feed | node |
| `src/lib/case-study-depth.test.ts` | `content.ts` Work optional fields | `diagram` ⇒ non-empty `diagramAlt`; diagram asset exists under `public/`; constraints/tradeoffs >20 chars and not TODO/TBD/lorem | Deploy blocker on new content. Broken image or a11y gap | node |
| `src/lib/personal.test.ts` | `personal.ts` | Shape (arrays + `now`); `hasPersonalContent`/`hasNow` are exact IFFs | Deploy blocker. Reveal surfaces could show placeholders | node |
| `src/lib/testimonials.test.ts` | `testimonials.ts` | `hasTestimonials` mirrors array; every entry has `https?://` `sourceUrl` | Deploy blocker. Unverifiable testimonial ships | node |
| `src/lib/github.test.ts` | `github.ts` | `REPO_ALLOWLIST` unique + contains 2 named extras; feed fails open to `[]`; newest-push sort; `Authorization: Bearer` only when `GITHUB_TOKEN` set | Deploy blocker. Recruiter sees an error instead of fewer cards | node |
| `src/lib/admin-auth.test.ts` | `admin-auth.ts` `requireAdmin` | 401 when `ADMIN_PASSWORD` unset / wrong / non-Basic / bad base64; `WWW-Authenticate` + `Cache-Control: no-store` on deny | Deploy blocker. `/admin/*` auth regression | node |
| `src/lib/llm-trace.test.ts` | `llm-trace.ts` | `TRACE_DELIMITER` is exactly U+001E; `THINKING_SENTINEL` = U+001E U+0001; `THINKING_END` = U+001E U+0002; `TraceFrame` has no `reasoning` | Deploy blocker. Model badge / thinking UI silently dies | node |
| `src/lib/llm-sdk-mode.test.ts` | `llm-sdk-mode.ts` | Default is `"anthropic-bedrock"`; read-once stability | Deploy blocker. An accidental flip to the unwired `aws-sdk-bedrock` default | node |
| `src/lib/avatar-glb.test.ts` | `public/avatar/sairam.glb` | glTF 2.0 container; <1.5 MB; `EXT_meshopt_compression` + `KHR_mesh_quantization` + `EXT_texture_webp`; all images WebP/RIFF; head/neck/chest/spine bones; skins present; **zero** morph targets | Deploy blocker. Silent binary-asset regression (payload bloat or dead animation rig) | node |
| `src/lib/voice-catalog.test.ts` | `voice-catalog.ts` | 6 curated voices; unique ids; per-engine required fields; `validateVoiceForEngine` cross-engine + tier rejection; browser voiceURI prefix match | Deploy blocker. Cross-engine voice attack, or a 5xx at AWS from a tier mismatch | node |
| `src/lib/voice-picker-mode.test.ts` | `voice-picker-mode.ts` | Default `"descriptor"`; getter and constant agree | Deploy blocker (minor). Picker layout flips unintentionally | node |
| `src/lib/voice-settings-context.test.ts` | `voice-settings-context.tsx` | Every capability defaults OFF except `captions: true`; `parse()` never throws; per-field enum validation; v1.6→v1.7 upgrade with no migration | Deploy blocker. A corrupt localStorage payload would break chat on load, or voice would default ON | node |
| `src/lib/scroll/resolve-flag.test.ts` | `resolve-flag.ts` | Precedence param > stored > fallback; never returns outside the allowed set | Deploy blocker (minor) | node |
| `src/lib/telemetry/schema.test.ts` | `telemetry/schema.ts` | Every `KIND_LITERALS` kind parses; required-field + enum + negative-ts rejection; exact 7-kind union order; `redact()` email/token/digit branches with 32-char & 12-digit thresholds; `hashIp` 16-hex + `"anonymous"` fallbacks + salt isolation | Deploy blocker. PII reaches the trace log, or every downstream emitter breaks | node |
| `src/lib/telemetry/emit.test.ts` | `telemetry/emit.ts` | `console.log("[trace]", json)` always fires; Redis key `anvilry:trace:<kind>` with `ts` score; `zremrangebyscore(key, 0, ts-7d)`; every Redis/console failure swallowed via `console.warn`; `emit()` returns `undefined` | Deploy blocker. Telemetry failure becomes request failure, or retention stops trimming | node |
| `src/lib/telemetry/with-trace.test.ts` | `telemetry/with-trace.ts` | `x-anvilry-trace-id` is a v4 UUID; status/statusText preserved; one `http.request` event; `level: "error"` on 5xx; `ctx.attrs()` merges; `server.error` re-throws with `err.name/message/stack` + `awsRequestId`; **last** XFF segment used; streaming body survives wrapping; a throwing `emit()` never reaches the response | Deploy blocker. Rate-limit bypass via spoofed XFF, or streaming chat buffered | node |
| `src/lib/telemetry/beacon.dom.test.ts` | `telemetry/beacon.ts` | `navigator.sendBeacon("/api/error", Blob{type:"application/json"})`; fetch fallback with `keepalive: true`; never throws on rejection or SecurityError | Deploy blocker. `/api/error`'s `req.json()` breaks, or unload-time errors are lost | dom |
| `src/app/api/error/route.test.ts` | `app/api/error/route.ts` | 204 + one `client.error` event; Zod 400s; 413 at >8KB declared content-length before `req.json()`; 204 + no emit when `TELEMETRY_ENABLED=false`; 429 + `Retry-After`; `redact()` runs before `emit()` | Deploy blocker. Secrets land in the trace log, or an unbounded body is read | node |
| `src/app/api/tts/cache.test.ts` | `app/api/tts/cache.ts` + `voice-catalog.ts` | Key varies by voice AND tier; text encoded last so a piped text can't forge a voice; LRU bump; eviction at `CACHE_MAX = 100`; `ALLOWED_TIERS` = `["generative","neural"]`; cross-engine rejection | Deploy blocker. Visitor B hears visitor A's audio | node |
| `src/app/api/tts-google/cache.test.ts` | `app/api/tts-google/cache.ts` | Per-voice key distinctness, round-trip, eviction ≤100 | Deploy blocker. Cross-voice audio bleed | node |
| `src/app/api/tts-google/route.test.ts` | `app/api/tts-google/route.ts` | 503 when `GOOGLE_TTS_API_KEY` unset/empty; 400 on bad JSON / missing text / whitespace text / missing-unknown-Polly voiceId; 413 >8KB; happy path decodes base64 to `audio/mpeg` with `X-TTS-Cache: miss` then `hit`; 502 on non-2xx or missing `audioContent`; exact Google request body shape | Deploy blocker. Fail-open TTS or cross-engine voice acceptance | node |
| `src/app/layout.hydration-proof.dom.test.tsx` | React 19 hydration + `suppressHydrationWarning` | Without the prop React logs the extension-injected-attribute mismatch; with it React is silent | Deploy blocker (documentation lock). Not a product test — it pins the mitigation | dom |
| `src/components/view-context.test.ts` | `view-context.tsx` | `VIEWS` contains classic/gamified/chat/developer/**voice**; `isView` rejects non-views/null/undefined/""; `DEFAULT_VIEW` and `getServerSnapshot()` are both `"classic"` | Deploy blocker. SSR would emit a non-Classic view and break SSG + hydration | node |
| `src/components/site-footer.dom.test.tsx` | `site-footer.tsx` VisitorBadge | Renders API count; writes `anvilry:visits:total`; falls back to cache on `total: 0` or fetch throw; never overwrites cache with 0; renders nothing with 0 + no cache | Deploy blocker. Visitor counter shows 0 when Redis is down | dom |
| `src/components/chat/use-chat.test.ts` | `use-chat.ts` (replicated `splitTrace`) | Sentinel-stripping + trace parsing on a **replica** of the shipping function | Deploy blocker (weak — tests a copy, not the module) | node |
| `src/components/chat/use-chat-stream.dom.test.tsx` | `use-chat.ts` real read loop | rAF coalescing (≤ half the chunk count in commits); trailing chunk never dropped; progress with rAF stubbed to no-op (background tab); trace frame stripped; THINKING state machine; abort preserves partial + `[stopped]`; 503/429 messages | Deploy blocker. Dropped tail token, frozen background tab, or leaked reasoning in the answer | dom |
| `src/components/chat/use-chat-a11y.dom.test.tsx` | `use-chat-a11y.ts` | Streaming → `"Answering…"`; settled + TTS off → full answer; settled + TTS on → `"Speaking answer aloud."` and never the answer text | Deploy blocker. Screen-reader double-speak | dom |
| `src/components/chat/anvil-inline-panel.dom.test.tsx` | `anvil-inline-panel.tsx`, `anvil-inline-store.ts` | Renders nothing until opened; `role="region"` id `anvil-inline-panel`; orb gets `aria-expanded`/`aria-controls`; outside pointerdown closes + restores focus (WCAG 2.4.3); pointerdown on the orb does not close | Deploy blocker. Focus-trap/a11y regression on the non-modal disclosure | dom |
| `src/components/chat/mic-button.dom.test.tsx` | `mic-button.tsx` | Renders nothing when unsupported; first click shows the privacy dialog and does **not** start the engine; accept → `start()` + `aria-pressed="true"`; "Not now" dismisses without opening the mic | Deploy blocker. Mic opens without consent | dom |
| `src/components/chat/talk-mode.dom.test.tsx` | `talk-mode.tsx` | Unsupported → "type instead" fallback; primary-control label tracks state (Start/Stop speaking/Mute microphone); interim caption verbatim; assistant caption stripped of `**` and `[[card:` tokens; Esc closes; End stops + closes | Deploy blocker. Voice becomes the only channel, or raw tokens show in captions | dom |
| `src/components/chat/use-speech-recognition.dom.test.tsx` | `use-speech-recognition.ts` | Honest `supported`; `getUserMedia` never called before `start()`; interim vs final result handling; `track.stop()` on `stop()`; `NotAllowedError` → calm `error`, not a hang | Deploy blocker. Hot mic or a hang on permission denial | dom |
| `src/components/chat/use-speech-synthesis.dom.test.tsx` | `use-speech-synthesis.ts` | `splitSentences` boundaries + ≤200-char cap + trailing partial; per-sentence enqueue; `speakChunk` dedup; **`resetTurn()` is required or turn ≥2 goes silent** (documents the v1.5.0 mute bug); character→rate/pitch mapping (fast=1.15, warm=0.95); `/api/tts-google` and `/api/tts` bodies; remote failure cascades to browser | Deploy blocker. Silent second answer, or remote TTS failure kills audio | dom |
| `src/components/chat/use-stt.dom.test.tsx` | `use-stt.ts` | `browser` → browser engine; `transcribe` → Transcribe if supported; falls back to browser when unsupported **or** when Transcribe errored at runtime | Deploy blocker. Visitor stuck on a broken STT engine | dom |
| `src/components/chat/use-voice-session.dom.test.tsx` | `use-voice-session.ts` | start→listening; `ask()` opens session + stops mic + sends; empty prompt ignored; final transcript → `send()` → derived `thinking`; `speakChunk` during stream (card tokens stripped); `resetTurn` exactly once per turn rising edge; **`cancel()` never fires on same-turn re-renders** (teardown deps must be `[]`); settle finalizer uses `speakChunk` not `speak`; speech end → re-listen; idle mic → `paused`; `interrupt()` cancels TTS **and** aborts the fetch; `stop()` → idle | Deploy blocker. Total voice silence (the cancel-every-render bug) or self-hearing | dom |
| `src/components/chat/voice-picker.dom.test.tsx` | `voice-picker.tsx` | One card per curated voice; `aria-pressed` on current; `onPick` gets the catalog id; preview speaks `sampleText`; switching cancels prior; same preview toggles off; "More voices…" trigger; sr-only `aria-live` + `aria-atomic` region | Deploy blocker. Picker a11y / preview regression | dom |
| `src/components/chat/voice-pitfalls.test.ts` | `voice-pitfalls.ts` (pure) | `voiceURIToGender` per vendor; `isLinuxESpeak` (false on empty list); `localeFallbackChain` exact chains; `applePremiumIsMissing`; `normalizeVoiceURI` strips `+m1`/`+f3` | Deploy blocker. Wrong voice picked on non-en-US / Linux | node |
| `src/components/chat/voice-pitfalls.dom.test.ts` | `voice-pitfalls.ts` (DOM) | `isIOS`/`isAndroid`/`isFirefox`; first-run primer localStorage flag swallows quota errors; `getVoicesRaceHardened` sync / `voiceschanged` / timeout paths; `detectScreenReader` never auto-flips `DEFAULTS.ttsEnabled` | Deploy blocker. SR + read-aloud double-speak, or a hang waiting for voices | dom |
| `src/components/chat/voice-surface-mutex.test.ts` | `voice-surface-mutex.ts` | Claiming closes every OTHER registered surface and never itself; 3-surface (modal/inline/core) arbitration; `unregister` removes from arbitration | Deploy blocker. Two live mics at once | node |
| `src/components/chat/wake-word-controller.dom.test.tsx` | `wake-word-controller.tsx` | Off → renders nothing, never arms; enabled → disclosure dialog, still not armed; Cancel sets `{ wakeWord: false }`; accept arms + shows Listening banner; never arms on a non-voice view | Deploy blocker. Hot mic without consent | dom |
| `src/components/game/easter-eggs.dom.test.tsx` | `easter-eggs.tsx` | Konami reveals a labelled `role="dialog"` with a REAL owner fact + `secret` pointer; Esc dismisses + restores focus; suppressed while a text input is focused; labelled dismiss button; empty personal.ts → "thanks for exploring" with no `secret` pointer | Deploy blocker. Fabricated fact, or the egg fights terminal ↑/↓ history | dom |
| `src/components/game/use-trace-runner.dom.test.tsx` | `use-trace-runner.ts` | Sequential reveal per `step.ms`; final `liveMessage` is `"Presenter: a3. Trace complete."` in ONE string (two same-tick calls would collapse and lose the last agent); `reduced=true` reveals all instantly + still announces; `reset()` kills orphan timers | Deploy blocker. Screen reader never hears the last step | dom |
| `src/components/game/terminal/commands.test.ts` | `terminal/commands.ts` | 25+ assertions: help lists all `COMMAND_NAMES`; hidden eggs dispatch but stay out of help/autocomplete; `about` always visible; personal reveals print real owner content; `now` staleness math under fake timers; unknown fails closed; input normalization; every `ls` slug is `cat`-able; `career` invents no year outside `profile.tenure`; `whoami` contains every `impactMetric` value; `commandEventName` strips args (PII-safe) | Deploy blocker. Fabricated content, PII in analytics, or an orphan registry entry | node |
| `src/components/game/terminal/commands-empty-safe.test.ts` | `terminal/commands.ts` with mocked empty `personal.ts` | `secret`/`uses` → "coming soon", `now` → "nothing pinned", none error; whoami/about breadcrumb suppressed | Deploy blocker. Placeholder/fabricated output when personal.ts is empty | node |
| `src/components/game/terminal/completion.test.ts` | `terminal/completion.ts` | Unique prefix completes + trailing space; case-insensitive; ambiguous (`c`, `t`) → `null`; no match → `null`; args never completed; empty/whitespace → `null` | Deploy blocker (minor). Tab guesses wrong | node |
| `src/components/game/terminal/history.test.ts` | `terminal/history.ts` | `nextHistoryIndex` boundaries: `-1` = live input, clamp at 0, down past newest resets to `-1` + `""`, single-entry, round-trip | Deploy blocker (minor). Off-by-one in ↑/↓ | node |
| `src/components/game/terminal/theme.test.ts` | `terminal/theme.ts` | cyan→green→amber→cyan; full cycle returns to `THEMES[0]` | Deploy blocker (minor) | node |
| `src/components/game/terminal/terminal.dom.test.tsx` | `terminal/terminal.tsx` | Input is `role="combobox"`; `aria-controls` resolves to a real `role="listbox"` (`terminal-cmd-listbox`); listbox always in the DOM; `aria-expanded="false"` with no suggestions | Deploy blocker. WCAG 4.1.2 violation | dom |
| `src/components/game/terminal/terminal-overlay.dom.test.tsx` | `terminal/terminal-overlay.tsx` | Controlled Radix dialog restores focus to the external trigger on close (WCAG 2.4.3) | Deploy blocker. Focus lost to `<body>` after closing fullscreen terminal | dom |
| `src/components/game/terminal/use-terminal.dom.test.tsx` | `terminal/use-terminal.ts` | `clear` empties scrollback; view command calls `setView` not `router.push`; route command calls `router.push`; `resume <variant>` calls `window.open(..., "_blank", "noopener,noreferrer")`; theme cycles and echoes | Deploy blocker. Wrong navigation primitive, or a missing `noopener` | dom |
| `src/components/hero-avatar/index.dom.test.tsx` | `hero-avatar/index.tsx` | `null` unless `NEXT_PUBLIC_HERO_MODE=avatar`; CSS glow fallback on mobile / non-classic view / reduced motion; position classes for `hero-side`/`hero-split`/`hero-top` | Deploy blocker. WebGL loads outside its gate | dom |
| `src/components/hero-avatar/rig.test.ts` | `hero-avatar/rig.ts` | Head/neck/chest/spine resolution incl. the `!includes("spine1")` exclusion; case-insensitive; only head mesh with morphs wins; empty scene returns all-null instead of throwing | Deploy blocker. Avatar loads but never moves | node |
| `src/components/hero-avatar/use-avatar-gaze.test.ts` | `use-avatar-gaze.ts` `computeGaze` | `eyeLX` clamped to ±0.15 and `eyeLY` to ±0.1 across 1000 ticks; yaw sign tracking; L/R symmetry | Deploy blocker (minor). Eyes roll out of range | node |
| `src/components/hero-avatar/use-avatar-idle.test.ts` | `use-avatar-idle.ts` `computeIdle` | `chestY` within ±0.003; `spineY === chestY * 0.5`; changes over time | Deploy blocker (minor) | node |
| `src/lib/scroll/use-stick-to-bottom-custom.dom.test.tsx` | `use-stick-to-bottom-custom.ts` | Pinned growth snaps to true bottom; user scroll-up de-pins and growth does not yank; re-pin near bottom; the 150 ms programmatic-scroll guard does not self-de-pin; `scrollToBottom` re-pins; `message-top` mode parks at `anchor.offsetTop - 12`; `enabled: false` never scrolls | Deploy blocker. Chat yanks the reader mid-scroll | dom |
| `src/lib/scroll/use-stick-to-bottom-library.dom.test.tsx` | `use-stick-to-bottom-library.ts` | Adapter mounts, exposes the `UseAutoScroll` shape, accepts nodes and `scrollToBottom` without throwing, no-ops when disabled | Deploy blocker (smoke only) | dom |
| `e2e/views.spec.ts` | Live app, all 4 views + SEO + API | Classic title/`main`/switcher; `/articles` `/projects` `/work`; chat composer by `getByLabel("Ask a question about Sairam")` + `aria-live` region; developer `role="log"` + `help`; gamified `#main-content canvas`; 200 on `/llms.txt` `/sitemap.xml` `/robots.txt`; `/api/resume.json` has `basics`; `/mcp` renders | Blocks the CI `e2e` job (a separate job from `ci`; does not block `pnpm build`) | Playwright |
| `e2e/resume.spec.ts` | `/resume` page | Flag OFF: h1 "Sairam Resume", PDF tab `aria-pressed="true"`, no `<details>`, Web tab shows "Sairam Ugge" + only the master pill, iframe unmounts/remounts. Flag ON (skipped unless `NEXT_PUBLIC_RESUME_VARIANTS === "true"`): collapsed `<details>`, 4 variant links, 5 pills | Blocks the CI `e2e` job; the flag-ON describe is skipped in CI | Playwright |

## The four load-bearing gates — verified against source

CLAUDE.md's "Testing Notes" section (`CLAUDE.md:353-362`) names four gates. Verified one by one:

### 1. `game-model.test.ts` bijection — **CLAUDE.md is correct**
`CLAUDE.md:355`: "asserts a bijection between graph nodes and content items — it **blocks deploys** if orphaned."

Confirmed. Seven forward/reverse coverage assertions plus an explicit count identity:
- forward: every `graphNodes` id is a key of `NODE_CONTENT` (`game-model.test.ts:22-25`), resolves via `resolveNode` (`:27-32`), and points at a slug present in `allWork`/`allProjects` (`:34-40`);
- reverse: no work or project slug is unmapped (`:42-53`);
- bijection: `CONTENT_COUNTS.nodes === CONTENT_COUNTS.quests` and `work + projects === nodes` (`:55-58`);
- plus href shape `^/(work|projects)/[a-z0-9-]+$` (`:62`) and exactly-once grouping (`:66-69`).
- An additional anti-fabrication block asserts every dossier fact is a verbatim real metric, `register` and `blurb` pass through unchanged, and project facts are derived counts (`:72-101`).

The three intentional node-id≠slug exceptions CLAUDE.md lists are real, but they live in the source, not the test: `aava → aava-code` (`src/lib/game-model.ts:31`), `grpc → grpc-microservices` (`:42`), `nhl → not-humans-lab` (`:45`), documented at `src/lib/game-model.ts:20`.

### 2. Injection/XSS guard location — **CLAUDE.md was wrong on both counts; now corrected**
CLAUDE.md used to say "`ask-portfolio.dom.test.ts` covers prompt injection and XSS guards on streamed markdown — do not weaken or skip these." Both halves of that were wrong, and both are now fixed: `CLAUDE.md:356` names `src/components/chat/parse-cards.test.ts` as the prompt-injection / XSS guard, and `CLAUDE.md:357` records that `src/components/ask-portfolio.dom.test.tsx` "has exactly two tests" and "contains zero injection or XSS assertions."

The two errors, for the record:
1. **Wrong filename.** There is no `ask-portfolio.dom.test.ts`. The file is `src/components/ask-portfolio.dom.test.tsx`.
2. **Wrong contents.** That file contains exactly two tests and neither is an injection or XSS test: "streams an assistant answer through the shared transport" (`ask-portfolio.dom.test.tsx:46-68`) and "surfaces the 503 not-configured message gracefully" (`:70-86`). Its own header comment describes it as the "Phase 0 unification contract" proving the widget rides the shared `useChat` transport (`:12-19`). A `grep -rl "injection\|XSS"` over the test suite returns only `parse-cards.test.ts` and `markdown-message.test.ts`.

Where the guards actually live:
- **`src/components/chat/parse-cards.test.ts`** is the prompt-injection / XSS fail-closed gate. Header: "Prompt-injection / XSS guard for the chat card layer" (`parse-cards.test.ts:5-11`). It drops hallucinated slugs without echoing the raw token (`:41-48`), ignores non-`project|work` kinds (`:50-53`), rejects `../../etc/passwd`, `javascript:alert(1)`, `https://evil.example.com` and uppercase/underscore slugs because the charset is locked to `[a-z0-9-]` (`:55-65`), and keeps `<img src=x onerror=...>` / `<script>` as inert text segments (`:67-75`).
- **`src/components/chat/markdown-message.test.ts`** explicitly *disclaims* XSS coverage: "The XSS posture itself lives in react-markdown's skipHtml + defaultUrlTransform — verified via a real-browser render, not here. This file pins OUR logic only." (`markdown-message.test.ts:9-11`). The runtime posture is `rehypePlugins={[rehypeSanitize]}` + `skipHtml` in `src/components/chat/markdown-message.tsx:90-91`.

Net: the guard exists and is a deploy blocker; CLAUDE.md now points at the right file.

### 3. `llm.test.ts` snake_case usage-field pin — **CLAUDE.md is correct**
`CLAUDE.md:358`: "pins the snake_case usage field names from the Anthropic SDK (`input_tokens`, not `inputTokens`)."

Confirmed, and it is a dedicated test, not incidental: "uses snake_case keys verbatim (regression guard against a silent SDK swap)" (`llm.test.ts:220-250`). It asserts `Object.keys(usage)` contains `["input_tokens", "cache_read_input_tokens", "output_tokens"]` (`:244-246`) and then explicitly forbids the camelCase forms: `expect(usage).not.toHaveProperty("inputTokens")` and `not.toHaveProperty("cacheReadInputTokens")` (`:248-249`). The file header records the reason: Bedrock Converse uses camelCase but `@anthropic-ai/bedrock-sdk` uses snake_case, so an SDK swap would silently zero the dashboard's cache-hit tile (`llm.test.ts:14-18`).

Two adjacent tests pin the full usage capture: `message_start` + `message_delta` extraction of `{input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens}` (`:114-181`) and a warm-cache turn where `cache_read_input_tokens === 4096` / `cache_creation_input_tokens === 0` (`:183-218`).

### 4. `agent-trace.test.ts` `PLACEHOLDER_SENTINEL` gate — **not a ship block, and CLAUDE.md now says so**
CLAUDE.md used to claim the test "**blocks shipping**" the glass-box multi-agent demo while any step in `src/lib/agent-trace.ts` still contained `PLACEHOLDER_SENTINEL` (`"[DRAFT — owner to approve]"`). That claim has been corrected: `CLAUDE.md:359` now reads "`agent-trace.test.ts` does **not** block shipping — it is a *consistency* check."

What the test actually does (`agent-trace.test.ts:51-57`):

```ts
const hasSentinel = scenarios.some((s) => s.steps.some((step) =>
  step.action.includes(PLACEHOLDER_SENTINEL) || step.output.includes(PLACEHOLDER_SENTINEL)));
// The gate must agree with reality: sentinel present <=> not approved.
expect(traceApproved).toBe(!hasSentinel);
```

This is a **consistency assertion, not a ship block.** It passes when the sentinel is present *and* `traceApproved === false`, and equally when the sentinel is gone *and* `traceApproved === true`. It only fails if the flag and the prose disagree.

The source says so in as many words: the `traceApproved` docblock at `src/lib/agent-trace.ts:114-119` — "Until then the glass-box demo renders DARK (empty-safe…) — so the scaffolding can ship without exposing un-reviewed prose… **NOT a hard build failure.**" (`:118` carries that last clause.)

The file's top banner used to contradict that docblock by claiming the test "BLOCKS shipping". **That contradiction is fixed** — the banner at `src/lib/agent-trace.ts:13-16` now states that "agent-trace.test.ts asserts the gate AGREES WITH REALITY (sentinel present <=> not approved)" and that "It does NOT block the build: while the sentinel remains, traceApproved is false and glass-box-demo.tsx renders NOTHING". Banner, docblock and test now all say the same thing; there is no longer a contradictory comment in this file.

Current state: the string literal `"[DRAFT — owner to approve]"` occurs exactly once in that file — the `PLACEHOLDER_SENTINEL` declaration (`src/lib/agent-trace.ts:22`). The identifier itself occurs 16 times: that declaration, one header-comment mention (`:11`), 12 template interpolations (`:59-60`, `:66-67`, `:73-74`, `:86-87`, `:93-94`, `:100-101`) covering all 6 scenario steps — 2 scenarios × 3 steps, each step carrying it in both `action` and `output` — and 2 in the `traceApproved` predicate (`:121`). Every step therefore carries the sentinel, so `traceApproved` (`:120-122`) is `false` and `src/components/game/glass-box-demo.tsx:40` short-circuits with `if (!traceApproved) return null;`. The demo is dark; nothing is blocked.

The other three assertions in that file *are* real deploy blockers: every `refs` slug must resolve via `getWork`/`getProject` and produce a link (`:20-28`), ≥2 scenarios each with ≥1 ref-bearing step (`:30-36`), and every step must use a known `AGENTS` key with finite positive `ms` summing to <8000 per scenario (`:38-49`).

## Detail

### `vitest.config.ts`
- **Role:** Defines the single Vitest config with two named projects and the forced test `NODE_ENV`.
- **Exports:** `default` (config object from `defineConfig`).
- **Reads / depends on:** `vitest/config`; implicitly `tsconfig.json` paths via `resolve.tsconfigPaths` (`:17`).
- **Consumed by:** `pnpm test`, `pnpm test:watch`, and the `vitest run` step inside `pnpm build` (`package.json:8,11,12`); CI `Test` step (`.github/workflows/ci.yml:52-53`).
- **Behaviour notes:** `env: { NODE_ENV: "test" }` (`:26`) is scoped to the Vitest worker; the sibling `next build` process is unaffected. Projects use `extends: true` so both inherit the root `resolve`/`env`.
- **Gotchas / invariants:** (a) removing `exclude: ["**/*.dom.test.{ts,tsx}", ...]` from the `node` project (`:34`) makes every DOM suite run twice, once without happy-dom; (b) removing `env.NODE_ENV` breaks the whole `dom` project on Vercel (React prod bundle has no `act`) — the failure surfaces as "React.act is not a function", documented at `:19-25`; (c) the `tests/**` include arms match nothing today.

### `playwright.config.ts`
- **Role:** Playwright config for the `e2e/` suite.
- **Exports:** `default` (config object).
- **Reads / depends on:** `@playwright/test`; env `CI`; a listening server at `http://localhost:3000`.
- **Consumed by:** `pnpm e2e` / `pnpm e2e:ui` (`package.json:15-16`); CI `e2e` job (`.github/workflows/ci.yml:91-92`).
- **Behaviour notes:** Single `chromium` project (`:16-19`). `webServer.command` is `pnpm start` — **a production build must already exist**, which is why CI runs `pnpm build` first (`ci.yml:88-89`). `reuseExistingServer: !process.env.CI` keeps a local `pnpm dev`/`pnpm start` usable; CI always starts fresh.
- **Gotchas / invariants:** the long comment at `:23-32` records the failure mode being guarded: with no `webServer`, a stale process on :3000 made Playwright test an older build and produce phantom failures. `retries: 2` in CI means flaky specs can pass on retry with trace/video captured only `on-first-retry`.

### `src/lib/llm.test.ts` (563 lines — largest suite)
- **Role:** Fixture-driven coverage of `streamWithFallback`'s telemetry capture, fallback invariant, and extended-thinking wire protocol.
- **Reads / depends on:** real `./llm` (dynamic `await import("./llm")` per test); `./llm-trace` constants; mocked `@anthropic-ai/bedrock-sdk` and `@anthropic-ai/sdk` (`:55-84`); env `LLM_PROVIDER`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION` set in `beforeEach` (`:86-94`).
- **Behaviour notes:** `vi.hoisted` supplies a shared `STATE { events, throwsOn, callCount }` plus a `fakeStream()` generator so each attempt in the model chain gets its own scripted event list (`:28-51`). Mocks are real classes because `vi.fn().mockImplementation` discards its return under `new` (`:53-54`). `drain()` reads the whole `ReadableStream` to a string (`:100-111`).
- **Model IDs pinned in assertions:** primary `us.anthropic.claude-sonnet-4-6` (`:156, :170, :425`), second-in-chain `us.anthropic.claude-opus-4-6-v1` (`:282`).
- **`emittedAny` invariant (`:253-309`):** when attempt 0 throws before any `content_block_delta`, the trace frame must name the *second* model with `fellBack: true` (`:282-283`) — proving no bytes were attributed to the failed attempt. When all three attempts throw pre-byte, the body contains `"Sorry"` and **no** `TRACE_DELIMITER` (`:304-305`), and `onAttempt` fires 3 times (`:307`).
- **Extended thinking (`:380-563`):** stream must start with `THINKING_SENTINEL`, reasoning streams live between sentinel and `THINKING_END`, and the trace frame must **not** carry a `reasoning` field (`:404-426`). `THINKING_END` is only emitted on the first `text_delta`, so a thinking-only stream emits neither `THINKING_END` nor a trace frame (`:470-494`).
- **Gotchas / invariants:** `THINKING_SENTINEL` starts with the same U+001E byte as `TRACE_DELIMITER`, so a bare `.not.toContain(TRACE_DELIMITER)` is wrong — the test uses `not.toContain(TRACE_DELIMITER + "{")` instead (`:491-493`). The last test (`:523-562`) is named for a Haiku guard but exercises the Sonnet path with conditional (`if (endIdx !== -1)`) assertions, so it asserts little unconditionally.

### `src/lib/telemetry/with-trace.test.ts`
- **Role:** Pins the `/api/*` observability wrapper's contract.
- **Behaviour notes:** Mocks both `@/lib/telemetry/emit` and `@/lib/telemetry/schema` via `vi.hoisted` (`:17-41`) so it tests only the wrapper. Trace id must match the RFC 4122 v4 shape (`:75-77`). Handler `statusText` survives response reconstruction (`:90`). 5xx upgrades `level` to `"error"` (`:117-126`). `server.error` events carry `err.name/message/stack` and the error is **re-thrown**, not swallowed (`:153-170`), plus `awsRequestId` from `err.$metadata.requestId` (`:172-191`).
- **Gotchas / invariants:** the client-IP test at `:220-230` pins the **last** `x-forwarded-for` segment (`"10.0.0.2"` from `"203.0.113.42, 10.0.0.1, 10.0.0.2"`) — the comment explains that the *first* segment is attacker-controlled and using it allows rate-limit bypass via a rotating spoofed header. Changing this to `[0]` reintroduces the bypass. The streaming test (`:241-278`) drains the body after wrapping to prove the response was not buffered.

### `src/app/api/error/route.test.ts`
- **Role:** Validation + redaction contract for the browser error sink.
- **Behaviour notes:** mocks `emit`, `checkRateLimit` (ok-by-default with an overridable flag), and `withTrace` (passthrough injecting a synthetic ctx with `traceId: "test-trace-id"` / `spanId: "test-span-id"`) via `vi.hoisted` (`:18-68`). Each test re-imports the route through `vi.resetModules()` (`:72-76`).
- **Gotchas / invariants:** the 413 test sets `Content-Length: 9000` with a small real body specifically to prove the header check short-circuits **before** `req.json()` (`:188-195`). The emitted `spanId` must be a fresh UUID, not the parent (`:126-128`). The redaction test builds its fixtures via `.repeat()` because a hand-typed long literal trips the repo's secret-scan hook and a JWT-shaped fixture splits on `.` into sub-32-char segments the redactor correctly ignores (`:222-231`).

### `src/components/chat/use-chat-stream.dom.test.tsx`
- **Role:** Drives the real `for(;;) { reader.read() }` loop in `useChat` (the older `use-chat.test.ts` only tests a replica of `splitTrace`).
- **Behaviour notes:** two measured environment facts shape the file (`:18-27`): chunks must arrive on separate macrotasks (60 synchronous writes → 1 flush; 60 spaced writes → 60 flushes), and happy-dom's `requestAnimationFrame` fires at ~0.2 ms, not ~16 ms — so `stubRealisticRaf()` installs a `FRAME_MS = 16` clock (`:30-54`). `abortableStreamOf` wires the fetch `AbortSignal` into `controller.error(new DOMException("Aborted","AbortError"))` because a plain `ReadableStream` is not signal-aware (`:80-113`).
- **Gotchas / invariants:** the coalescing assertion is `nonEmpty.length <= words.length / 2` with 24 chunks (`:175`); the background-tab test stubs `requestAnimationFrame` to `() => 0` so only the `BACKGROUND_FLUSH_MS` safety timer can make progress (`:196-212`) — removing that timer hangs streaming in hidden tabs.

### `src/components/game/terminal/commands.test.ts`
- **Role:** Coverage + anti-fabrication gate for the terminal command registry.
- **Reads / depends on:** real `./commands`, `@/lib/content`, `@/lib/profile`, `@/lib/personal`.
- **Behaviour notes:** asserts hidden egg commands (`secret`, `personal`, `uses`, `now`) dispatch without "command not found" yet never appear as a navigable help entry, matched with `new RegExp("^\\s+[◇→]\\s+" + hidden + "\\b", "m")` after filtering out the `tip:` line (`:26-27`). `now` staleness math is driven with `vi.useFakeTimers()` at `updated + 12h` ("updated today") and `updated + 91 days` ("may be stale") (`:65-82`). `resume f` first-wins matching is tested with `vi.stubEnv("NEXT_PUBLIC_RESUME_VARIANTS", "true")` (`:181-192`) and the flag-OFF path asserts `resume backend` errors (`:194-197`).
- **Gotchas / invariants:** `career` may print **only** the 4-digit years already present in `profile.tenure` — any per-item chronology is fabrication (`:235-244`). `commandEventName` must return the command word only; `grep someone@example.com` → `"grep"`, unrecognized → `"unknown"` (`:276-289`) — this is the analytics PII boundary. The "every `ls` slug is `cat`-able" test (`:139-145`) pins that two different resolution chains (content vs graph) stay in sync.

### `src/lib/avatar-glb.test.ts`
- **Role:** Binary-asset invariant guard for `public/avatar/sairam.glb`, parsed directly from the GLB container (no three.js, no WebGL) so it runs in the node project.
- **Behaviour notes:** `readGlb()` validates the `glTF` magic and version 2, then slices the JSON chunk and computes `binOffset = 20 + jsonLen + pad + 8` (`:37-47`). Size budget `MAX_BYTES = 1.5 * 1024 * 1024`; comment records the asset at ~1.055 MB after WebP compression, down from 2.549 MB (`:18-21`).
- **Gotchas / invariants:** the last describe block (`:132-158`) deliberately asserts **zero** morph targets and no mesh whose name contains "head" — documenting that the eye-gaze code path in `avatar-mesh.tsx` is currently inert because the asset is an AVATURN export with no blendshapes, not the ReadyPlayerMe `Wolf3D_Head` the code comments describe. Exporting a blendshape-enabled avatar requires flipping this expectation to `toBeGreaterThan(0)` (`:142-143`) — otherwise the "improvement" fails the build.

### `src/components/chat/use-voice-session.dom.test.tsx`
- **Role:** Drives the talk-mode state machine over mocked `useChat` / `useSpeechRecognition` / `useSpeechSynthesis`.
- **Behaviour notes:** the mocks return a **fresh object literal each render** (`{ ...chat }`, `:47-49`) on purpose — a stable mock object hid the "cancel-every-render" audio bug, because the real hooks churn identity every render.
- **Gotchas / invariants:** `synth.cancel` must not be called across a whole streaming turn (`:159-181`) — the comment states the teardown effect's deps must be `[]`, not `[recognition, tts]`. The settle finalizer must use `speakChunk`, never `speak`, or the whole answer re-speaks (`:183-200`). `resetTurn()` fires exactly once per turn rising edge (`:127-157`). `interrupt()` must call both `synth.cancel` and `chat.stop` because a tap can land mid-stream (`:227-236`).

### `src/lib/scroll/use-stick-to-bottom-custom.dom.test.tsx`
- **Role:** State-machine coverage for the custom auto-scroll hook under happy-dom's no-layout environment.
- **Behaviour notes:** geometry is hand-driven via a `makeScroller()` whose `scrollHeight`/`clientHeight`/`scrollTop` are defined properties with real clamping (`:26-44`); the `ResizeObserver` callback is captured and fired manually (`:13-21`); `performance.now` is spied to a manual `clock` so the programmatic-scroll guard is deterministic (`:47-64`).
- **Gotchas / invariants:** the 150 ms guard test (`:144-167`) fires the synthetic scroll in the **same tick** as `scrollToBottom()` with no clock advance — if the guard is removed, a programmatic snap de-pins itself and streaming stops following. `message-top` mode parks at `anchor.offsetTop - 12` = 1488, deliberately not the absolute bottom of 1700 (`:216`).

### `e2e/views.spec.ts`
- **Role:** Live-app smoke coverage of all four views plus SEO routes and two API endpoints.
- **Behaviour notes:** each selector carries a comment recording the wrong selector it replaced — `[data-view]` never existed (only `data-view-dir`) (`:10-13`); `input[type="text"]` could never match the composer, which has no `type` attribute (`:37-41`); `[data-role="assistant"]` does not exist in the chat markup (`:50-54`); a bare `locator("canvas")` matched two canvases and failed Playwright strict mode, reading as "the 3D view is broken" (`:88-91`).
- **Gotchas / invariants:** SSR is always Classic, so every non-Classic view assertion carries a `{ timeout: 15000 }` (or 20000 for WebGL) to allow the post-hydration switch. The chat test is credential-tolerant: it accepts either a real answer or the un-configured 503 copy via `/Sairam|Ascendion|projects|isn't switched on yet|went wrong/i` (`:63`) — so it does **not** prove the LLM works in CI.

### `e2e/resume.spec.ts`
- **Role:** `/resume` page behaviour under both states of `NEXT_PUBLIC_RESUME_VARIANTS`.
- **Behaviour notes:** the flag-ON describe is gated by `test.skip(process.env.NEXT_PUBLIC_RESUME_VARIANTS !== "true", ...)` (`:99-102`), read from the **Playwright process's** env; CI never sets it, so those 3 tests are always skipped there.
- **Gotchas / invariants:** the flag-OFF assertions use `not.toBeAttached()` rather than `not.toBeVisible()` (`:38, :70-71, :57`) — the contract is that variant markup is *never rendered*, not merely hidden. The PDF iframe title `"Sairam Resume résumé preview"` is asserted verbatim (`:30, :87`).

### Trivial / thin suites (table-only above, noted here for accuracy)
- `src/components/chat/use-chat.test.ts` re-implements `splitTrace` locally (`:11-25`) and tests the copy, not `use-chat.ts`. Its last two tests assert plain arithmetic on strings (`wordCount === 9`, `:53-57`) rather than any shipping module.
- `src/lib/llm-sdk-mode.test.ts` and `src/lib/voice-picker-mode.test.ts` are one-shot smoke tests: both flags are read once at module load via `NEXT_PUBLIC_*` inlining, so only the unset-default branch is reachable in Vitest (`llm-sdk-mode.test.ts:4-11`, `voice-picker-mode.test.ts:4-9`).
- `src/lib/scroll/use-stick-to-bottom-library.dom.test.tsx` is explicitly a smoke test of the adapter shape and does not re-test the `use-stick-to-bottom` library's internals (`:5-10`).
- `src/app/layout.hydration-proof.dom.test.tsx` is self-described as documentation, not a product test (`:16-17`): it renders a stand-in `<div data-role="head">`, not the real `src/app/layout.tsx`.

## Coverage

- `vitest.config.ts`
- `playwright.config.ts`
- `e2e/resume.spec.ts`
- `e2e/views.spec.ts`
- `src/app/api/error/route.test.ts`
- `src/app/api/tts-google/cache.test.ts`
- `src/app/api/tts-google/route.test.ts`
- `src/app/api/tts/cache.test.ts`
- `src/app/layout.hydration-proof.dom.test.tsx`
- `src/components/ask-portfolio.dom.test.tsx`
- `src/components/chat/anvil-inline-panel.dom.test.tsx`
- `src/components/chat/markdown-message.test.ts`
- `src/components/chat/mic-button.dom.test.tsx`
- `src/components/chat/parse-cards.test.ts`
- `src/components/chat/talk-mode.dom.test.tsx`
- `src/components/chat/use-chat-a11y.dom.test.tsx`
- `src/components/chat/use-chat-stream.dom.test.tsx`
- `src/components/chat/use-chat.test.ts`
- `src/components/chat/use-speech-recognition.dom.test.tsx`
- `src/components/chat/use-speech-synthesis.dom.test.tsx`
- `src/components/chat/use-stt.dom.test.tsx`
- `src/components/chat/use-voice-session.dom.test.tsx`
- `src/components/chat/voice-picker.dom.test.tsx`
- `src/components/chat/voice-pitfalls.dom.test.ts`
- `src/components/chat/voice-pitfalls.test.ts`
- `src/components/chat/voice-surface-mutex.test.ts`
- `src/components/chat/wake-word-controller.dom.test.tsx`
- `src/components/game/easter-eggs.dom.test.tsx`
- `src/components/game/terminal/commands-empty-safe.test.ts`
- `src/components/game/terminal/commands.test.ts`
- `src/components/game/terminal/completion.test.ts`
- `src/components/game/terminal/history.test.ts`
- `src/components/game/terminal/terminal-overlay.dom.test.tsx`
- `src/components/game/terminal/terminal.dom.test.tsx`
- `src/components/game/terminal/theme.test.ts`
- `src/components/game/terminal/use-terminal.dom.test.tsx`
- `src/components/game/use-trace-runner.dom.test.tsx`
- `src/components/hero-avatar/index.dom.test.tsx`
- `src/components/hero-avatar/rig.test.ts`
- `src/components/hero-avatar/use-avatar-gaze.test.ts`
- `src/components/hero-avatar/use-avatar-idle.test.ts`
- `src/components/site-footer.dom.test.tsx`
- `src/components/view-context.test.ts`
- `src/lib/admin-auth.test.ts`
- `src/lib/agent-trace.test.ts`
- `src/lib/avatar-glb.test.ts`
- `src/lib/case-study-depth.test.ts`
- `src/lib/corpus.test.ts`
- `src/lib/game-model.test.ts`
- `src/lib/github.test.ts`
- `src/lib/llm-sdk-mode.test.ts`
- `src/lib/llm-trace.test.ts`
- `src/lib/llm.test.ts`
- `src/lib/mcp-tools.test.ts`
- `src/lib/notes.test.ts`
- `src/lib/personal.test.ts`
- `src/lib/scroll/resolve-flag.test.ts`
- `src/lib/scroll/use-stick-to-bottom-custom.dom.test.tsx`
- `src/lib/scroll/use-stick-to-bottom-library.dom.test.tsx`
- `src/lib/telemetry/beacon.dom.test.ts`
- `src/lib/telemetry/emit.test.ts`
- `src/lib/telemetry/schema.test.ts`
- `src/lib/telemetry/with-trace.test.ts`
- `src/lib/testimonials.test.ts`
- `src/lib/voice-catalog.test.ts`
- `src/lib/voice-picker-mode.test.ts`
- `src/lib/voice-settings-context.test.ts`

## UNVERIFIED

- I did not execute `pnpm test`, `pnpm build`, or `pnpm e2e`. Every claim above is read from source. Actual pass/fail state, real coverage percentages, and runtime durations are unconfirmed.
- The `dom` Vitest project declares no `exclude` (`vitest.config.ts:38-43`); I assume it relies on Vitest 4's default `node_modules` exclusion but did not confirm that default empirically.
- `e2e/views.spec.ts` and `e2e/resume.spec.ts` are the only two spec files. I did not confirm the total Playwright test count claimed in the CI comment ("5 of 19 tests were failing", `ci.yml:60`) against the current specs.
- Whether the Vercel production build actually sets `NODE_ENV=production` in the build shell (the stated reason for `env.NODE_ENV` in `vitest.config.ts:19-25`) is taken from that comment, not independently verified.
