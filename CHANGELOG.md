# Changelog

All notable changes to Anvilry are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Branch model: `develop` (working) → `main` (release; auto-deploys to
[anvilry.vercel.app](https://anvilry.vercel.app)).

## [3.0.0] — 2026-06-24

**Self-maintaining portfolio** — 5 PRs (#86–#90) transforming Anvilry from a portfolio
you manage into one that monitors and verifies itself. Anchored in a 107-agent deep
research run (5.5M tokens, 25 primary sources) and a 26-agent E2E quality gate
(1.7M tokens, 640 tool calls) that caught 14 issues before any code reached production.

### Major: Vercel Cron Automation Suite (PR #86)

Four scheduled jobs now run automatically every week:

- **`/api/cron/eval`** (Mon 9am) — fires 12 golden-pair questions at the live chatbot,
  grades answers by category (factual / rag / injection), writes pass-rate + breakdown
  to Redis. Weekly proof that the AI is still telling the truth.
- **`/api/cron/github-sync`** (hourly) — warms `anvilry:github:stats:latest` via ISR
  cache-bust; idempotent (skips if key is still fresh). Homepage strip always has
  real data with zero cold-start latency.
- **`/api/cron/seo-audit`** (Mon 6am) — HTTP health check on sitemap.xml, llms.txt,
  robots.txt, feed.xml; counts content items missing summaries. Zero LLM calls.
- **`/api/cron/content-audit`** (Mon 7am) — flags articles and notes older than 18
  months. Writes stale slug lists to Redis for the dashboard.
- **`vercel.json`** — registers all four crons plus the pre-existing eval job.

**Security hardening applied across all cron routes:**
- Auth guards changed from fail-open (`if (secret &&)`) to fail-closed
  (`if (!secret ||)`) — a missing `CRON_SECRET` now always returns 401.
- `eval` route: added GET handler (Vercel Cron sends GET; POST-only caused silent 405
  every Monday). Added 8-day TTL on Redis write so stale data self-expires.
- `github-sync`: explicit upstream-error return when GitHub API returns non-2xx.
- `seo-audit`: fixed Project summary field (`excerpt`, not `summary` per Velite schema).
- `.env.example`: added `CRON_SECRET` with `openssl rand -hex 32` generation hint.

### Major: Observability Dashboard Expansion (PR #90)

Four new cron-health tiles in `/admin/telemetry` (Server Component, Redis reads only):

- **GitHub Stats** — totalStars, totalForks, repoCount from last hourly sync.
- **SEO Health** — pass/fail per route, content missing-summary count.
- **Content Freshness** — stale articles + notes counts; green if zero stale.
- **Corpus Age** — hours/days since last production deploy; flags stale after 7 days.

`/api/error` route now writes a fire-and-forget Redis list (`anvilry:errors:recent`,
max 50) for future error-feed tile. Fixed blocking bug: `error_name` and `error_message`
were never written to `emit()` attrs — every client.error row in the dashboard Details
column was permanently blank. `componentStack` now runs through `redact()`.

### Added: AI-Era SEO (PR #88)

- **`/llms-full.txt`** — full chatbot corpus (~6KB) as `text/plain` with
  `force-dynamic`. Recruiter AI assistants can fetch the entire portfolio in one call.
- **`ArticleJsonLd`** — reusable `Article` schema component in `json-ld.tsx`.
- **`safeJsonLd()`** — replaces `JSON.stringify` in all 8 JSON-LD components; escapes
  `</script>` → `<\/` to prevent script-tag injection. Applied to all existing
  components (PersonJsonLd, BreadcrumbJsonLd, etc.) as defence in depth.
- **Open-redirect guard** in `articles/[slug]/page.tsx`: `externalUrl` redirects now
  require `http://` or `https://` prefix (blocks `javascript:` / `data:` protocol).

### Added: AI/LLM Feature Expansion (PR #89)

- **12 golden pairs** (was 5) — 7 new pairs covering MindForge, AAVA Code user count,
  Agent-Forge, languages, email, open-source projects, and a second injection variant.
- **Per-category pass rates** — `by_category: { factual, rag, injection }` in Redis
  summary. Dashboard can now surface category-level regressions.
- **`forbidden` field per injection pair** — `checkPass()` now checks each injection
  pair's own payload (was hardcoded to `HELLO_INJECTED` regardless of which pair was
  being tested — the second injection test was vacuous and always passed).
- **Corpus timestamp** — `instrumentation.ts` writes `anvilry:corpus:built_at` on
  production cold starts. Uses `VERCEL_ENV=production` (not `NODE_ENV`) to exclude
  preview deployments.
- **2 new MCP tools** — `list_all_content` (all work/project/article/note items) and
  `get_content_item` (fetch by type + slug). MCP server grows from 7 → 9 tools.

### Added: Performance Optimization (PR #87)

- **`optimizePackageImports`** for `lucide-react` and `motion` — tree-shakes icon and
  animation imports at module level. R3F packages excluded (C-3 investigation, commit
  `6246ed9`, proved the flag doesn't collapse twin-chunks in Turbopack).
- **`revalidate = 3600`** on `work/page.tsx` and `notes/page.tsx` (server components).
  Removed from `stats/page.tsx` (Velite static data; ISR produces byte-identical HTML).

### Infrastructure

- All 5 PRs passed a 26-agent E2E quality gate (code review + TypeScript + 477 tests +
  contract validation + security audit) before merge. 14 issues found and fixed in the
  gate — none shipped to production.
- 477 vitest tests pass on all branches; `tsc --noEmit` clean across all 5.

## [1.9.0] — 2026-06-17

**Beast Mode upgrade** — 6 commits closing 3 critical production gaps and shipping 11
new features across every layer of the stack. Anchored in adversarial deep-research
(35 agents, 12 URLs fetched, 11 ideas survived 3-skeptic review).

### Critical gaps closed
- **No 404 page** → Corrupted-Signal Terminal 404 page (`app/not-found.tsx`) — the
  error IS the terminal; visitors get the full gamified shell on broken URLs.
- **AI chat couldn't mutate the page** → `[[cmd:view:X]]` and `[[cmd:highlight:slug]]`
  token protocol on top of the existing card-token infrastructure; the AI can now
  switch views and glow-highlight project cards mid-response.
- **3D orb had no post-processing** → Bloom + Vignette + Noise + ChromaticAberration
  via `@react-three/postprocessing` in one merged EffectPass; gated behind device-tier
  check (≥4 GB RAM + ≥4 cores).

### Added
- **Corrupted-Signal Terminal 404** — `app/not-found.tsx` (no new deps); `bootBanner404()`
  fake kernel-panic boot sequence in `boot-banner.ts`; `initialLines` prop on `Terminal`;
  `cd` command in the command registry; CSS `@keyframes glitch-text`.
- **Orb post-processing pipeline** — Bloom (luminanceThreshold=1.0 so only HDR crests
  bloom), Vignette, Noise, ChromaticAberration. Adaptive DPR + antialias on device tier.
- **Orb error mode** — `uErrorMode` GLSL uniform shifts palette to red/orange + erratic
  double-sin breathing. Used by `not-found.tsx` orb hero variant.
- **Persona-aware AI responses** — VISITOR PERSONA DETECTION block in system prompt;
  recruiter → crisp metrics, engineer → architectural depth, collaborator → enthusiasm.
- **Agent cmd tokens** — `[[cmd:view:<view>]]` and `[[cmd:highlight:<slug>]]` parsed by
  `parse-cards.ts` (fail-closed); dispatched as side-effects from `chat-messages.tsx`.
  `highlight-store.ts` — module-level external store, auto-clears after 3s.
- **Live GitHub stats** — `GET /api/github/stats` (ISR 1h) aggregates `getRepoFeed()`;
  injected into chat system prompt as LIVE GITHUB STATS block (fail-open).
- **`?view=resume`** — sixth view, always enabled, single-column print-optimized CV from
  `profile.ts`; PDF download buttons for all 5 resume variants; `@media print` CSS.
- **SVG RPG Skill Tree** — interactive SVG in the Gamified view; 6 category nodes with
  bezier connections; click to filter; palette mirrors BuildGraph `kindColor`; zero new
  deps; `useReducedMotion()` gate.
- **WebSite JSON-LD SearchAction** — `WebSiteJsonLd()` component with `potentialAction`
  SearchAction; mounted in `layout.tsx`; Google sitelinks search box eligibility.
- **Telemetry: Costs breakdown table** — per-model cost from `cost_usd` fields already in
  `llm.attempt` spans; no new schema changes.
- **Telemetry: Voice P50/P95 tiles** — from `tts.request` + `transcribe.request` latency
  sorted sets already in Redis.
- **Telemetry: Eval tile + `/api/cron/eval`** — 5 golden pairs (factual × 3, RAG × 1,
  injection resistance × 1); keyword-based pass/fail; writes to `anvilry:eval:latest`;
  weekly Vercel cron target `0 9 * * 1`.
- **web-vitals RUM** — `onLCP/onINP/onCLS → console.info("[vitals]", ...)` in
  `instrumentation-client.ts`; greppable in Vercel Logs; no Redis or new route.
- **`next/after()` telemetry** — `afterSafeEmit()` in `with-trace.ts` moves telemetry
  emit AFTER the response finishes streaming; falls back to synchronous outside
  request scope (test safety).
- **`experimental.viewTransition: true`** in `next.config.ts` — enables React 19
  ViewTransition component and directional slide on project card Links.

### Dependencies added
- `@react-three/postprocessing ^3.0.4` + `postprocessing ^6.39.1` (peer)
- `web-vitals ^5.3.0` (devDep)

## [1.8.0] — 2026-06-17

**Structured telemetry + AI request tracing + prompt-cache verification** — a dual-sink
observability pipeline (Vercel Logs + Upstash Redis) that, for the first time, actually
reads the `cache_read_input_tokens` / `cache_creation_input_tokens` fields from the Bedrock
streaming response. Prompt caching was wired in v1.6 but the streaming consumer silently
dropped the usage events — nobody knew if caching was saving 90% of token cost or 0%. Now
every Bedrock attempt emits a structured `llm.attempt` span with the full usage block,
frontend errors send to a same-origin `/api/error` route, and an owner-only
`/admin/telemetry` dashboard makes all of it queryable. Zero new vendors; zero CSP changes.

### Added
- **`src/lib/telemetry/` module** — Zod-validated event schema (7 span kinds), PII redactor,
  SHA-256 ip-hasher, dual-sink emitter (`console.log` + Upstash ZADD), `withTrace` route
  wrapper, browser `sendBeacon` helper. See `TELEMETRY.md` for the full reference.
- **Prompt-cache verification** — `streamWithFallback` now consumes `message_start` +
  `message_delta` events, extracting `input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, and `cache_read_input_tokens` per Bedrock attempt.
  These flow through the new `onAttempt` callback and land in the `llm.attempt` span.
  The cache-hit rate tile on `/admin/telemetry` makes this visible.
- **AI request tracing** — every `/api/chat` call emits one `http.request` span + one
  `llm.attempt` span per Bedrock attempt in the fallback chain. Every `/api/tts`,
  `/api/tts-google`, `/api/transcribe` call emits an `http.request` + a route-specific
  span (with `cache_hit`, `voiceId`, `aws_request_id`, `char_count`, etc.).
- **Extended trace frame** — the U+001E delimiter frame appended to `/api/chat` streaming
  responses extends from `{model, fellBack}` to `{model, fellBack, traceId, usage,
  ttftMs, latencyMs}` (additive; v1.7 clients unaffected).
- **`x-anvilry-trace-id` response header** on every `/api/*` response — visitors can
  hand you the header value from their browser's Network tab; `node scripts/replay-trace.mjs <id>`
  prints the full event chain.
- **Frontend error capture** — `app/error.tsx`, `app/global-error.tsx` (Next 16 framework
  boundaries), and `src/instrumentation-client.ts` (window.error + unhandledrejection
  listeners). All POST via `sendBeacon` to the new `/api/error` same-origin sink.
- **`/api/error` route** — 5-stage gate (telemetry-on guard, rate-limit, 8KB cap, JSON
  parse, Zod validate), redacts message + stack before emitting `client.error` event.
- **`/admin/telemetry` dashboard** — password-gated (`ADMIN_PASSWORD` env) server component.
  Six tiles (events today, cache hit rate, fallback rate, error rate, client errors, server
  errors) + route breakdown bar chart + recent-events table.
- **`scripts/replay-trace.mjs`** — CLI for incident investigation: reads all spans for a
  traceId from Upstash and prints chronological output with delta timestamps.
- **`NEXT_PUBLIC_LLM_SDK` flag** — `anthropic-bedrock` (default, current path) |
  `aws-sdk-bedrock` (stub for v1.8.x OTel auto-instrumentation migration).
- **`src/lib/redis.ts`** — shared Upstash Redis singleton (extracted from rate-limit.ts so
  the emitter, budget counter, and dashboard reader can share one client).
- **`TELEMETRY.md`** — canonical reference for the telemetry layer.

### Fixed
- `streamWithFallback` docblock claimed "Opus 4.6 primary" while the `BEDROCK_CHAIN` array
  had shipped Sonnet-first since v1.6 — fixed the docblock so log/dashboard analysis isn't
  ambiguous about the expected primary model.

### Configuration (new env vars)
- `TELEMETRY_ENABLED` — `"false"` disables event emission; default on.
- `TELEMETRY_IP_SALT` — salt for SHA-256 IP hashing; without it, IPs are stored as `"anonymous"`.
- `ADMIN_PASSWORD` — HTTP Basic Auth password for `/admin/telemetry`.
- `NEXT_PUBLIC_LLM_SDK` — build-time SDK selector (see above).

## [1.7.0] — 2026-06-16

**Voice quality upgrade** — a curated voice picker, two new TTS engines (Polly Generative
gated to user-pick, Google Cloud TTS Chirp 3 HD as a permanent-free hedge), and 16 platform
pitfalls hardened. The default cost is unchanged ($0 — Polly Neural-Joanna), but the
ceiling is much higher: visitors who pick Stephen-Generative get audiobook-grade audio
without a vendor change, and visitors on year-2 traffic past the Polly free-tier cliff
have Google Cloud TTS waiting (1M chars/mo permanent free).

### Added

- **Voice catalog** — a typed source of truth for every voice the picker exposes (6 curated
  + 12 extended) across all three engines. Each entry stamps its native engine identifier
  (`pollyVoiceId`, `googleVoiceName`, `browserVoiceURIPrefix`); browser entries match by
  `voiceURI` prefix so macOS-localized + Linux speech-dispatcher-modified URIs resolve
  correctly.
- **`VoicePicker` component** — shared picker UI mounted in three surfaces (talk-mode header
  label, Cmd+K palette, settings dialog). Two layout modes via the new
  `NEXT_PUBLIC_VOICE_PICKER_MODE` flag: `descriptor` (default — modern named cards with
  2-word descriptors, the ChatGPT/Siri pattern) or `gender` (explicit Male / Female columns).
  Tap-to-preview with cancel-on-tap (one preview at a time); aria-live announces start/stop;
  "More voices…" overflow exposes the extended catalog.
- **`VoiceSettingsDialog`** — canonical full-config surface (Voice / Engine / Character /
  Toggles / Reset). Opened from a new "Voice settings…" Cmd+K command. The character
  section auto-disables with an "engine ignores these knobs" hint when Polly Generative or
  Google Chirp 3 HD is active.
- **Polly Generative tier** — user-pickable via the catalog (`Stephen-M-US`, `Ruth-F-US`).
  Default stays Polly Neural-Joanna so cost is unchanged at $0; only the user-pick path
  triggers the $30/M Generative tier (with a 100k chars/mo free allotment for year 1).
- **Google Cloud TTS engine** — new `/api/tts-google` route (server-proxied, identical
  pattern to `/api/tts`). Permanent free tier of 1M chars/mo Chirp 3 HD voices (Aoede,
  Charon curated; Puck, Kore, Fenrir extended). `GOOGLE_TTS_API_KEY` env enables it; when
  unset, the engine option is hidden from settings and the route returns 503 (client falls
  back to Polly → browser).
- **Voice character knobs** — `voiceCharacter: { speed, tone, pause }` settings field
  mapped to safe-range browser `rate` / `pitch` (clamped 0.85–1.15 / 0.95–1.10) + Polly
  Neural `<prosody>` SSML. Dropped on Generative + Google (engines reject most prosody
  tags); the hook silently strips them rather than 5xx-ing.
- **Cmd+K voice commands** — "Pick voice…" opens the dialog; six "Voice: <Name>" quick-swap
  commands set `voiceId` directly. Searchable on name + descriptor + accent + gender + tier
  ("stephen", "warm", "generative", "polly" all surface Stephen).
- **Talk-mode header voice label** — compact "Voice: Stephen ▾" pill below the controls.
  Click opens the picker dialog; mid-session voice swaps don't interrupt in-flight audio.
- **First-run primer card** — a one-time, dismissible hint ("Anvil reads answers in
  Joanna by default. Press ⌘K → 'Pick voice'…") that surfaces the picker affordance to
  first-time visitors. Persisted via `localStorage["anvilry:voice:first-run-seen-v1"]`.
- **Platform advisories** — Linux eSpeak detection disables the browser engine in settings
  with a "pick Polly or Google" reason; Android Chrome shows a soft "voices vary" hint;
  Apple Premium voices not on disk show a "Download in macOS Settings → Accessibility →
  Spoken Content → Voices" hint per card.
- **`voice-pitfalls.ts` module** — 16 small isolated utilities for the documented platform
  landmines (SR detection, iOS gesture lock, Linux eSpeak, voiceURI-to-gender allow-list,
  locale fallback chain, Apple Premium download check, race-hardened `getVoices`,
  voiceURI normalization, Android/Firefox UA detection, first-run primer storage).

### Fixed

- **CRITICAL: voice-keyed `/api/tts` cache** — the v1.6 cache keyed only on raw text,
  which was correct only because there was a single hardcoded VoiceId (Joanna). Without
  this fix, two visitors picking different voices for the same text would collide on the
  same key — the second visitor would hear the first's audio under a different voice.
  Cache key is now `${voiceId}|${tier}|${text}`; `cache.ts` lifted to a sibling module so
  it can be unit-tested directly (Next 16 App Router route files only permit HTTP method
  exports + the fixed segment-config exports).
- **`/api/tts` allowlist validation** — body's `voiceId` is now validated against the
  catalog before forwarding to Polly. Unknown ids return 400 instead of silently falling
  back to Joanna; cross-engine attacks (a Google catalog id sent to `/api/tts`) are
  rejected. Tier mismatches (Joanna+generative would 5xx at AWS) are impossible by
  construction — the catalog is the source of truth on which voices support which tier.
- **Caption aria-hidden during speech** — the live caption track now sets `aria-hidden`
  while speaking so screen readers don't double-announce text the page is currently
  reading aloud (the SR + read-aloud double-speak regression).

### Configuration

- New `NEXT_PUBLIC_VOICE_PICKER_MODE` (build-time) — `descriptor` (default) or `gender`.
  Switching requires a redeploy (NEXT_PUBLIC_ inlining), same constraint as every other
  Anvilry env flag.
- New `GOOGLE_TTS_API_KEY` (server-side, optional) — enables the Google Cloud TTS engine.
  Get a key at https://console.cloud.google.com/apis/credentials with the Cloud
  Text-to-Speech API enabled. When unset, Google voices are hidden from the picker.
- New `VoiceSettings.voiceId` (localStorage, optional) — catalog id of the user-picked
  voice. Undefined → catalog default (Joanna), preserving v1.6 behavior for legacy
  payloads.
- New `VoiceSettings.voiceCharacter` (localStorage) — `{ speed, tone, pause }` enums.
  Defaults to `{ natural, neutral, normal }` which the TTS hook maps to v1.6's hardcoded
  `rate=1, pitch=1, no padding`.
- `VoiceSettings.ttsEngine` widened to include `"google"`.

## [1.6.0] — 2026-06-16

**Anvil** — the voice surface, brought up from underground. The two-way talk mode is now
a first-class part of the site, sharing one grounded engine with the existing modal.

### Added
- **Anvil voice view** — a fifth view alongside Classic · Play · Chat · Dev (always shown
  in the desktop switcher; `?view=voice` deep-links). A lean voice landing — "Talk to
  Anvil — the voice of Sairam's work", example-prompt chips, an open-to-roles hook —
  wrapping the shared talk mode. Chips ask **by voice** through the session's own seam
  (one transcript, one mic); the answer streams and is spoken like a spoken turn.
- **Anvil header orb — an in-place Siri orb.** A "beast" multi-hued animated orb in the
  global header (every route, every viewport, **on by default**). Like macOS Siri, tapping
  it doesn't open a centered modal — it **expands in place** into a non-modal panel
  anchored under the orb (desktop) and **starts listening immediately** (the page stays
  visible behind it). Mobile falls back to the centered modal (iOS Siri is a full-screen
  takeover on phones). Build-time mode `NEXT_PUBLIC_ANVIL_ORB_MODE = inplace | modal | off`
  (default `inplace`). The idle orb is pure CSS (layered hue-drifting gradient + drifting
  blurred lobes — no WebGL/rAF/main-thread work in the header); ≥44px hit area; STT-gated;
  hand-rolled non-modal a11y (aria-expanded, focus in/out, Esc + outside-click fully end
  the session, panel-scoped Space).
- **Fluid Siri idle orb** — the header orb is now a genuinely swirling, color-shifting
  metaball (layered animated conic-gradients fused by `blur()+contrast()+hue-rotate()`,
  driven by two `@property <angle>` swirl/hue drifts). Pure CSS, no JS/rAF/WebGL;
  reduced-motion → a static but still rich fused orb. Pre-Baseline degrades to a solid
  accent disc.
- **"Core" minimal Siri voice mode** (flag-selectable, `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE
  =core`; default **classic** = the full panel, unchanged) — on orb click, shows ONLY the
  enlarged reactive orb + a tiny listening dot + a frosted answer-only result card; no
  panel chrome / caption track / controls / chips. Auto-listens immediately. Close fully
  ends the session (Esc / outside-click / tap-orb). The classic full panel is KEPT under
  the flag.
- **One-mic mutex** — the modal, the in-place panel, the core surface, and the Voice view
  each own a session/mic, so a small arbiter guarantees exactly one is open at a time;
  the gamified WebGL canvas unmounts while any voice overlay is open (one live GL context).
- **"Beast while speaking"** — the 3D orb surges (more turbulence, HDR heat, rim glow,
  spin) while the answer is spoken, eased in/out. Desktop + WebGL + motion only;
  reduced-motion keeps the calm orb.

### Changed
- The command-palette voice-surface toggle is relabeled "Show / Hide voice modal
  shortcuts" — it now governs only the modal doors (the Talk pill + ⌘K), since the Voice
  view is always available. The existing modal talk mode is otherwise unchanged.
- The wake word is scoped to the Chat view only (no longer the voice view), so it can't
  open a second voice session over the always-live Anvil view.

### Internal
- A single live WebGL context is guaranteed: the gamified BuildGraph canvas unmounts
  while the voice overlay is open (it can layer over `?view=gamified`).
- The voice view is server-safe: the SSR/first-client snapshot stays `classic` (the
  switcher upgrades to five entries post-hydration) — no hydration mismatch.

## [1.5.0] — 2026-06-15

The streaming voice release — talk mode now speaks the answer **as it streams**, with a
clean caption and an audio-reactive 3D orb. All free, browser-native, opt-in.

### Fixed
- **Talk mode was silent** — the session's unmount-teardown effect listed the (freshly
  re-created every render) `recognition`/`tts` objects in its dependency array, so its
  cleanup ran on *every* render during streaming and called `tts.cancel()`, clearing the
  speech queue as fast as it filled. The teardown now runs only on true unmount (empty
  deps, latest hooks reached via a ref). Verified headless: spurious `speechSynthesis`
  cancels during a turn went from ~67 to **0**, and each sentence enqueues exactly once.
- **Per-answer speech counter** (`speakChunk`'s dedup) only reset on `cancel()`, so every
  answer after the first was dropped once the loop ran. A new `resetTurn()` restarts it on
  each turn's streaming rising edge (without re-speaking). Both fixes are pinned by
  regression tests that exercise the **real** synth across turns (the prior tests mocked
  it, hiding the bug).
- **User's spoken words** now persist in a dedicated "You said" caption line above the
  answer (was a transient shared slot, wiped the instant the final transcript landed).
- **Talk-mode caption** rendered the assistant answer raw, leaking `**markdown**` and
  `[[card:…]]` tokens to screen while the spoken path was already clean. Both paths now
  share one `toCaptionText` helper (strips card tokens + display markdown), so the
  caption shows exactly what is spoken. Live interim (user STT) stays verbatim.

### Added
- **Speak-as-it-streams** — talk mode wires the existing per-sentence `tts.speakChunk()`
  into the streaming loop, so the first audio starts ~one sentence after the first token
  instead of after the whole answer settles. Honest framing: *speaks as it streams with
  instant interrupt* — not gapless (inter-sentence timing is browser-controlled). Always
  on. Barge-in (tap/Space) now also **aborts the in-flight `/api/chat` stream**, not just
  the speech.
- **Audio-reactive voice orb** — a desktop R3F GLSL "Siri orb": a fractal-noise
  (domain-warped fBm) displaced icosahedron with a 3-stop deep-blue→cyan→violet gradient,
  a fresnel rim, an additive halo back-sphere for a volumetric bloom (HDR output through
  ACES tone-mapping — no postprocessing dependency), and organic breathing motion. Behind
  the existing WebGL + min-width + reduced-motion gates, lazy-loaded so three stays off
  the talk-mode critical path, with a universal 2D-canvas orb fallback. Reduced-motion → a
  calm static ring. (The speaking envelope is synthetic — browser `speechSynthesis`
  exposes no audio node to tap; the orb reacts to state, not raw output.)
- **Captions toggle** (cc) in talk mode, on by default (a11y), persisted in voice
  settings; a turn-affordance footer ("Tap the orb or press Space to take your turn").

## [1.4.1] — 2026-06-15

### Security
- **Content-Security-Policy is now enforced** (promoted from `Report-Only`, which
  shipped in 1.4.0 to observe safely). The policy string is unchanged — only the header
  key flips — so the exact policy that logged zero violations in the live 1.4.0
  production sweep (all four views incl. the WebGL Play view) is now actually blocking.
  Backed by a per-directive audit against every real resource load (scripts, styles,
  fonts, images, media, network, workers), including the optional AWS Polly-audio
  `blob:` path the click-through sweep didn't exercise. `next/font` self-hosting,
  same-origin `/api/*`, and server-side AWS calls were all confirmed covered;
  `upgrade-insecure-requests` is retained (it becomes meaningful once enforced).

## [1.4.0] — 2026-06-15

The voice release — speak to the portfolio, hear it answer back — plus a
production-readiness hardening pass. Everything is **opt-in, free-first, and
backward-compatible**: the text chat and all four views are unchanged, voice is
strictly additive, and any unsupported browser or runtime error degrades to text.

### Added — Voice layer (opt-in, browser-native, free-first)
- **Mic input (push-to-talk)** — a mic button in the chat composer (full view + the
  floating widget); speak a question, the transcript fills the input for review. First
  use shows a one-line cloud-audio disclosure; the mic opens only on an explicit
  gesture and is released on stop.
- **Read-aloud** — a per-answer "Listen" button speaks the reply via the browser
  `speechSynthesis` engine (per-sentence, starts before the full answer arrives), with
  an `aria-live` reconciliation so screen-reader users never hear the answer twice.
- **Two-way talk mode** — a hands-free, turn-based conversation (listen → think →
  speak) as a focus-trapped modal overlay (default) or an optional full-page 5th
  "voice" view, selectable from the command palette.
- **Wake word ("Hey portfolio")** — opt-in, **off by default**, behind a cloud-audio
  disclosure gate, with a persistent "Listening" banner + one-tap kill, scoped to the
  voice views.
- **Optional AWS engines (feature-flagged, no new vendor)** — AWS Polly Neural TTS
  (`/api/tts`) and AWS Transcribe streaming STT (`/api/transcribe`), reusing the
  existing Bedrock credentials. Both fail closed to the free browser path.
- **`VOICE.md`** — full feature reference (architecture, settings/flags table,
  env/IAM/cost, privacy & a11y, developer notes), linked from the README; plus voice
  notes in `README.md`, `DEPLOY.md`, and `.env.example`.

### Added — Production hardening
- **HTTP security headers** via `next.config.ts` `headers()`: `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, a mic-scoped `Permissions-Policy`, and a
  `Content-Security-Policy-Report-Only` scoped to the site's real surfaces (to be
  promoted to enforced after a live zero-violation check). HSTS continues to come from
  Vercel's platform default.
- **Notes SEO parity** — `BreadcrumbList` JSON-LD + a per-note Open Graph image
  (empty-safe; renders once a note exists).

### Changed
- The floating "Ask my portfolio" widget now streams through the shared `useChat`
  transport (deduplicated logic; it also inherits 429 + abort handling it lacked).

### Security
- **Loud rate-limit-misconfiguration guard** — failing open on a *transient* Upstash
  error is intentional, but a fully unconfigured limiter in production now emits a
  clear warning at startup (the cost-bearing `/api/chat`, `/api/tts`, `/api/transcribe`
  routes would otherwise be silently unprotected against per-IP AWS cost abuse).
- **Payload prechecks** — reject oversized request bodies by declared `Content-Length`
  before buffering, on `/api/chat` (64 KB), `/api/tts` (8 KB), and `/api/transcribe`
  (5 MiB).
- **Polly timeout** — the Polly audio read races a 10 s cap so a stalled stream fails
  fast to the browser-TTS fallback instead of holding the function open.

### Verification
- Backed by a 20-agent voice deep-research pass, a 17-agent WCAG 2.2 AA + privacy
  audit, and a 24-agent production-readiness audit — each with adversarial verification
  of findings against the source.
- Build green: 35 test files, 199 tests (chained into `pnpm build`).

## [1.3.1] — 2026-06-14
- Responsive console fixes (developer/chat footer + composer overlap) and a full
  editorial spelling/grammar audit across user-facing copy.

## [1.3.0] — 2026-06-14
- The engineering-visible release: command palette upgrades, notes scaffolding,
  view-transition polish, first-party GitHub project feed, MCP endpoint fixes.

## [1.2.0] — 2026-06-14
- Developer Mode layout upgrade + the subtle-delight easter-egg system.

## [1.1.0] — 2026-06-14
- Developer Mode view (full-page keyboard-native terminal) + autoscroll engine fix.

## [1.0.0] — 2026-06-13
- Initial public portfolio: four switchable views (Classic · Play · Chat · Developer)
  over one canonical content source, with the AWS Bedrock "Ask my portfolio" chat.

[1.6.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.6.0
[1.5.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.5.0
[1.4.1]: https://github.com/sairam0424/anvilry/releases/tag/v1.4.1
[1.4.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.4.0
[1.3.1]: https://github.com/sairam0424/anvilry/releases/tag/v1.3.1
[1.3.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.3.0
[1.2.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.2.0
[1.1.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.1.0
[1.0.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.0.0
