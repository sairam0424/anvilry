---
kind: doc
title: Next Upgrade Plan — 2026-09
domain: []
status: draft
links: []
---

# Next Upgrade Plan — 2026-09

## Scope & Method

This plan synthesizes **10 parallel, independent primary-source research streams** run
2026-09-18 against the live Anvilry repo (`sairam-dev`) and live external sources (AWS Bedrock
docs, Anthropic docs, npm/GitHub registries, official framework release notes/changelogs, GitHub
Security Advisories, and — where noted — direct unauthenticated `curl` calls run outside any
sandboxed doc-fetch proxy to rule out mocked/stale tool output). The streams:

1. `claude-model-chain-currency` — is the Bedrock model chain current?
2. `bedrock-prompt-caching-best-practices` — chat route caching correctness
3. `nextjs-react-upgrade-path` — Next.js 16 / React 19 currency
4. `r3f-three-upgrade-path` — React Three Fiber / three.js currency
5. `zod-v4-and-eslint-10-migration` — long-deferred major-version bumps
6. `vercel-platform-feature-adoption` — BotID, AI Gateway, `vercel.ts`
7. `redis-rate-limit-resilience-patterns` — Upstash rate-limit fail-open behavior
8. `mcp-server-spec-and-security-currency` — MCP protocol/security currency
9. `core-web-vitals-and-bundle-optimization` — bundle budget & CWV
10. `testing-ci-tooling-currency` — Playwright/Vitest/a11y-gate currency

Every recommendation below is carried through **as found** — none have been softened, and none
have been invented. Where a stream's conclusion was "no action needed," that is stated
explicitly rather than replaced with padding. Effort tags follow each stream's own convention:
**S** = small (hours, single-file/config change), **M** = medium (a day or more, multi-file or
requires a build/verify pass), **L** = large (multi-day, architectural) — no stream produced an
L-effort item this round.

Two of the ten streams (`research-kv-caching`, `research-prompt-caching` per this session's
active-agent list) map onto `bedrock-prompt-caching-best-practices` above; their findings are
folded in under that stream name throughout.

---

## P0 — Do Now

These are either live production issues (one confirmed actively occurring today) or defaults
already shipped to real users with a confirmed, sourced failure mode.

- **[P0 / S] Move the Upstash Redis DB off the Free tier's hard quota ceiling** — *(stream:
  redis-rate-limit-resilience-patterns)*
  This is the only action that stops an **ongoing incident**: this session's live production
  audit found the account's Redis command quota already exhausted, which means every
  `checkRateLimit()` call throws, and the unconditional `catch (err) { return { ok: true } }`
  in `src/lib/rate-limit.ts` is swallowing every one of those errors — `/api/chat` (real Bedrock
  spend), `/api/tts*`, and `/api/transcribe` are effectively unthrottled right now. Adding a
  payment method (or moving to Pay-as-you-go) auto-upgrades the database and removes the 500K
  commands/month hard stop; every code-level fix below only changes how gracefully the app
  degrades the *next* time this happens, not whether today's incident is resolved.
  *Sources:* live account audit this session; https://upstash.com/docs/redis/troubleshooting/max_daily_request_limit; https://upstash.com/docs/redis/overall/pricing.
  *Risk:* None architecturally (billing action, not code) — confirm the new usage-based cost
  estimate against actual combined command volume (rate-limit + FAQ cache + telemetry all share
  this budget) before enabling.

- **[P0 / S] Migrate the extended-thinking request shape off the deprecated
  `thinking.enabled`+`budget_tokens`/beta-header pattern to `thinking.adaptive`+
  `output_config.effort`** — *(stream: claude-model-chain-currency)*
  This is Anvilry's **live, default-on production code path today** (`EXTENDED_THINKING`
  defaults to `true` in `src/app/api/chat/route.ts:385`). AWS's Bedrock docs already flag the
  exact shape Anvilry sends (`{type:"enabled", budget_tokens:1024}` + `betas:
  ["interleaved-thinking-2025-05-14"]` via `client.beta.messages.stream()`) as deprecated on the
  exact models in the current chain (Sonnet 4.6 / Opus 4.6), "to be removed in a future model
  release," and it is rejected outright (`ValidationException`) on Claude Sonnet 5 / Opus 5. It
  is a hard prerequisite for the P1 model-chain bump below. Pick a conservative
  `output_config.effort` (e.g. "low"/"medium," not the "high" default) to approximate today's
  small 1024-token budget's intent, and update `llm.test.ts`'s assertions on this branch
  (~lines 640-830) in the same change.
  *Sources:* https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html
  ("thinking.type: 'enabled' and budget_tokens are deprecated on Claude Opus 4.6 and Claude
  Sonnet 4.6... will be removed in a future model release"); direct read of `src/lib/llm.ts` and
  `src/app/api/chat/route.ts:385`.
  *Risk if skipped:* Any future bump to Sonnet 5/Opus 5 without this fix breaks extended thinking
  outright with a deterministic `ValidationException` (400) — `isFallbackEligible()` correctly
  treats a plain 400 outside `MODEL_UNAVAILABLE_MARKERS` as **not** fallback-eligible, so real
  users would see the apology-tail error, not a silent degrade.

- **[P0 / S] Gate the `thinking_delta` content-block handler behind `useThinking`** — *(stream:
  claude-model-chain-currency)*
  The non-extended-thinking branch in `llm.ts`'s `streamWithFallback` streams any
  `thinking_delta` bytes straight to the client with **no** `THINKING_SENTINEL`/`THINKING_END`
  framing today, because that framing is only wired up when `useThinking` is already `true`.
  AWS's own migration warning states plainly that Claude Sonnet 5/Opus 5 run **adaptive thinking
  on by default** — a request that omits the `thinking` field still produces (and bills for)
  thinking output, unlike Sonnet 4.6, where the same omission produces none. Fixing this now
  makes the code robust independent of which model is configured on a given day, and is a
  prerequisite for a safe P1 model bump.
  *Sources:* direct read of `src/lib/llm.ts` (`content_block_delta`/`thinking_delta` branch,
  `useThinking` gating logic); https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html
  ("Important: Adaptive thinking is on by default on Claude Sonnet 5 and Claude Opus 5...").
  *Risk if skipped:* Raw chain-of-thought reasoning could leak into the visible chat UI
  unframed on every default request, mixed into what looks like a normal answer, the moment any
  future model swap or Anthropic-side default change enables thinking without an explicit opt-in.

- **[P0 / S] Stop shipping the full Velite content JSON (every MDX body) to every route via
  `SiteNav`** — *(stream: core-web-vitals-and-bundle-optimization)*
  `src/components/site-nav.tsx` — a `"use client"` component mounted unconditionally in root
  layout, i.e. on every route — only needs two booleans (`hasNotes`/`hasArticles`), but because
  `src/lib/content.ts` computes those booleans from the **full**
  `.velite/{projects,work,notes,articles}.json` collections at module scope, no bundler can
  tree-shake the underlying JSON away — including every entry's compiled MDX body. Verified two
  independent ways this session: `next experimental-analyze` attributes 295,493 B of the four
  `.velite/*.json` files into one shared client chunk present on all 17 routes'
  first-load sets; and the real production build's largest shared chunk
  (`32m7_h7rvuxtg.js`, 297,381 B) contains verbatim rendered prose from two unrelated projects'
  MDX bodies. Root layout is already `async function RootLayout` — compute `hasNotes`/
  `hasArticles` server-side and pass as props, removing the `@/lib/content` import from the
  client graph entirely. This one change likely resolves the current bundle-budget headroom
  crisis (see P1 re-measure item below) outright.
  *Sources:* `src/components/site-nav.tsx:8,25,28`; `src/lib/content.ts:5-21,48-56,66-68`; live
  `next experimental-analyze -o` run + `.next/diagnostics/analyze/data/analyze.data`; live
  `.next/diagnostics/route-bundle-stats.json`, all captured this session.
  *Risk:* Low — pure refactor of a build-time-constant boolean; no runtime behavior change,
  verifiable with existing e2e nav tests.

- **[P0 / S] Defer `AnvilCoreSurface`'s `MarkdownMessage` import behind
  `next/dynamic(ssr:false)`** — *(stream: core-web-vitals-and-bundle-optimization)*
  `anvil-core-surface.tsx` — also statically mounted unconditionally in root layout — eagerly
  imports `MarkdownMessage` (the full `react-markdown`/`remark-gfm`/`rehype-sanitize`/
  `unified`/`hast`/`mdast` chain, 126,485 B uncompressed per `next experimental-analyze`) into
  every route's first load, for a voice surface (`ORB_EXPERIENCE=core`) that is **off by
  default**. `ask-portfolio.tsx` already proves the exact fix in production for the identical
  component: `dynamic(() => import(...).then(m => m.MarkdownMessage), { ssr: false, loading: ()
  => <SkeletonMarkdownLine /> })`. Apply the same pattern to `anvil-core-surface.tsx`.
  *Sources:* `src/app/layout.tsx` (mount site); `src/components/chat/anvil-core-surface.tsx:1-10,29`;
  `src/components/chat/ask-portfolio.tsx:16-24`; `src/components/chat/header-orb-trigger.tsx:44-45`;
  live analyzer run this session.
  *Risk:* Low — copies an already-shipped, already-tested pattern for the same component; the
  loading skeleton already exists.

- **[P0 / S] Add a regression test pinning the aria-live single-announcement invariant for the
  chat surface** — *(stream: testing-ci-tooling-currency)*
  This session found **two real, live aria-live double-announce bugs** that the full existing
  CI (lint/typecheck/vitest/E2E) missed — a distinct second generation of a bug class the
  codebase already fixed once before (`CHANGELOG.md:657-658,797`, the "NO DOUBLE-SPEAK" logic in
  `use-chat-a11y.ts`). The repo already has the right pattern for this kind of fail-closed
  regression pin (`use-chat-a11y.dom.test.tsx`, `parse-cards.test.ts`, both build-blocking via
  `pnpm build`). Once the two live bugs are fixed, add/extend a DOM test asserting exactly one
  live-region update fires per settled streaming answer across the **whole** chat surface (not
  just `useChatA11y` in isolation) — this is a more reliable regression guard for this exact
  defect class than any generic scanner (see the P1 axe-core item below, which would **not** have
  caught this).
  *Sources:* `docs/index/05-components-chat-voice.md:236` ("Two live regions coexist..."); direct
  read of `src/components/chat/use-chat-a11y.ts`; `CHANGELOG.md:657-658,797`.
  *Risk:* None — additive test only. Must be written against the **fixed** behavior, or it will
  codify the bug rather than prevent it.

---

## P1 — Next

- **[P1 / S] Bump `BEDROCK_CHAIN`'s primary to `us.anthropic.claude-sonnet-5` (and mirror
  `ANTHROPIC_CHAIN`'s primary to `claude-sonnet-5`) — only after the two P0 thinking-shape
  fixes above land** — *(stream: claude-model-chain-currency)*
  Claude Sonnet 5 (launched on Bedrock 2026-06-30, "Active" lifecycle) is Anthropic's current
  mid-tier model — described by Anthropic as bringing near-Opus intelligence at the same
  Sonnet cost/speed tier Anvilry already budgets for — closing a two-generation currency gap
  (4.6 → 5). No SDK bump is required (`@anthropic-ai/sdk` ^0.125.0 and
  `@anthropic-ai/bedrock-sdk` ^0.33.5 already support the new request shapes) and no
  endpoint/plumbing change is needed (the new model ID is a bare, dateless, region-prefixed
  inference-profile ID in the exact style the code already uses, served on the same
  `bedrock-runtime` endpoint). Anvilry's current pins (Sonnet 4.6, Opus 4.6) are still "Active"
  with no forced-deprecation deadline before Feb 2027 — this is a capability gap, not an
  imminent breakage, which is why it's sequenced *after* the P0 fixes rather than alongside them.
  *Sources:* https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html;
  https://www.anthropic.com/news/claude-sonnet-5; live npm registry checks on both SDKs.
  *Risk if sequenced wrong:* Doing this before the P0 fixes immediately sends the now-invalid
  `thinking.enabled+budget_tokens` shape to Sonnet 5 on every extended-thinking request (hard
  400), and exposes the non-extended-thinking path to unsolicited, unframed adaptive-thinking
  output with a `max_tokens` budget sized for a no-thinking response.

- **[P1 / S] Fix `BEDROCK_PRICE`'s cache-write multiplier for Sonnet 4.6 to reflect the 1-hour
  TTL actually used** — *(stream: bedrock-prompt-caching-best-practices)*
  `route.ts`'s own inline comment already asserts a "2x write premium" for its 1-hour-TTL cache
  block, and its stated break-even math ("breaks even after just 2 reads") is only internally
  consistent with a 2x multiplier — yet `BEDROCK_PRICE.cacheWrite` for Sonnet 4.6 is set to
  `3.75` = `input(3.0) × 1.25`, the **5-minute** multiplier, even though the only `cache_control`
  block Anvilry ever sends carries `ttl: "1h"`. This is a self-contained, verifiable
  inconsistency inside Anvilry's own repo (comment vs. constant), independent of any external
  doc-fetch reliability concern, and it understates every cache-write event's true cost in the
  `/admin/telemetry` dashboard and the FAQ-cache `saved_usd` field.
  *Sources:* `src/app/api/chat/route.ts` inline comment (~lines 390-398) and `BEDROCK_PRICE`
  table, both read directly; https://platform.claude.com/docs (prompt-caching pricing: 1h write
  = 2x, cross-checked against the local amazon-bedrock skill reference).
  *Risk:* None — cost-accounting-only change; does not touch the request/response path.

- **[P1 / S] Adopt `next experimental-analyze` as the real bundle-attribution tool, replacing
  the webpack-only `pnpm analyze` workflow** — *(streams: nextjs-react-upgrade-path,
  core-web-vitals-and-bundle-optimization — independently recommended by both)*
  It is a Turbopack-native CLI command already present in the installed `next@16.3.5` (no
  upgrade required) that directly fixes the gap Anvilry's own `CLAUDE.md` documents:
  `@next/bundle-analyzer` refuses to run under Turbopack builds, which is exactly why
  `bundle-analysis.yml` was deleted as permanently green-and-empty (222 runs, 211 green, zero
  real artifacts). `next experimental-analyze [--output]` gives real per-route treemaps and
  import-chain tracing under the actual build tool Anvilry uses — it is what surfaced both P0
  bundle findings above with byte-level precision this session. Wire it as a `make
  bundle-attribution` target (or a pre-release manual step) — it is an ~40s interactive-report
  tool, not a CI assertion; `scripts/bundle-budget.mjs` remains the correct CI gate and should
  not be replaced by it. In the still-unreleased Next 16.4 canary line it is also gaining
  historical-snapshot + before/after diff support (4 merged PRs, 2026-09-09/10), worth revisiting
  once that line stabilizes.
  *Sources:* `node_modules/next/dist/build/analyze/index.js` (present in installed 16.3.5);
  `node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`; live analyzer run this
  session; GitHub API PRs vercel/next.js #93520-#93523 (merged, 2026-09-09/10).
  *Risk:* Labeled experimental (`experimental-` prefix) — treat as a local investigative tool,
  not a hard CI gate.

- **[P1 / S] After the two P0 bundle fixes land, re-measure and lower `MAX_FIRST_LOAD_BYTES`** —
  *(stream: core-web-vitals-and-bundle-optimization)*
  Real current headroom is **5,236 B (~0.39%)** on `/` (1,330,764 B against a 1,336,000 B
  ceiling) — not the ~5% a stale briefing assumed; the ceiling has been raised multiple times
  since. Reclaiming the ~295 KB + ~126 KB (~421 KB uncompressed) freed by the two P0 fixes will
  otherwise leave a large, unmonitored slack that future features can silently re-consume.
  `scripts/bundle-budget.mjs`'s own comment history already documents the discipline of raising
  the ceiling with measured before/after bytes — apply the same discipline in reverse, after the
  fixes are shipped and measured (not speculatively).
  *Sources:* live run of `node scripts/bundle-budget.mjs` this session; `scripts/bundle-budget.mjs:43-72`;
  `CHANGELOG.md` bundle-budget entries.
  *Risk:* None — bookkeeping only, making the existing gate meaningful again.

- **[P1 / S] Add BotID as a Redis-independent second layer on `/api/chat` (and the other
  rate-limited AI routes)** — *(stream: vercel-platform-feature-adoption)*
  This directly closes the gap the redis-resilience stream found: the Upstash limiter fails
  open by design whenever Redis is unreachable or quota-exhausted, and that is happening in
  production right now (see P0 above). `checkBotId()`/`initBotId()` has **zero** dependency on
  Redis/Upstash — a platform-native check that keeps blocking scripted abuse of the
  Bedrock-backed `/api/chat` even while the Upstash outage is unresolved. Integration is
  low-friction: `src/instrumentation-client.ts` already exists (the exact file `initBotId()`
  belongs in for Next 15.3+/16), and `next.config.ts` already uses a compose-wrapper pattern
  (`withBundleAnalyzer`) that `withBotId()` fits into cleanly with no CSP `connect-src` changes
  (same-origin rewrite proxy). Apply `checkBotId()` alongside (not instead of)
  `checkRateLimit()` in `src/app/api/chat/route.ts`, and extend the `protect` array to
  `/api/tts`, `/api/tts-google`, `/api/transcribe` too.
  *Sources:* https://vercel.com/docs/botid/get-started; https://vercel.com/docs/botid/advanced-configuration;
  direct read of `src/lib/rate-limit.ts`, `src/instrumentation-client.ts`, `next.config.ts`.
  *Risk:* BotID is categorical bot-detection, not a quota — it does **not** replace the rate
  limiter for volume control against traffic that passes as human, and does not fix the
  underlying Upstash quota issue. Also confirm in the Vercel dashboard which BotID tier
  (Basic vs. Deep Analysis) is included on the current plan — this could not be independently
  confirmed from docs alone.

- **[P1 / S] Add a Vercel WAF rate-limiting rule on `/api/chat`, `/api/tts*`, `/api/transcribe`
  as a Redis-independent backstop** — *(stream: redis-rate-limit-resilience-patterns)*
  Vercel's edge firewall enforces IP-based limits before the request reaches the Next.js
  function at all, so it keeps working through a full Upstash outage or future quota
  exhaustion — zero new vendor (already on Vercel), zero app code required for the basic
  dashboard-configured version, available on the Hobby plan. Set it generous relative to the
  existing 8/60s app-level limit (e.g. 20-30/min per IP) so it only fires as a backstop.
  *Sources:* https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting.
  *Risk:* Counters are tracked per-region, so a distributed attacker spread across regions can
  exceed the configured per-region limit in aggregate — treat as defense-in-depth alongside the
  app-level limiter, not a replacement.

- **[P1 / M] Make `checkRateLimit` distinguish a permanent quota rejection from a transient
  error, and fail differently for each** — *(stream: redis-rate-limit-resilience-patterns)*
  Today's catch-all `catch (err) { ...fail open }` treats a 200ms network blip identically to
  "Redis will keep rejecting every call for the rest of the billing period." The former
  genuinely should fail open (per Upstash's own SDK philosophy — a rate limiter should never
  take down the feature it protects); the latter should not, for potentially weeks of real
  Bedrock-billed traffic. Detect the specific Upstash "request limit exceeded" error text and
  route it to a small in-memory-only fallback limiter (a module-level `Map`-based sliding
  window, instantiated outside the handler so it persists across a warm Vercel Fluid Compute
  instance) instead of unconditional pass-through.
  *Sources:* `node_modules/@upstash/redis/chunk-K7RP6Y36.mjs` lines 14,203,394 (`UpstashError`);
  https://upstash.com/docs/redis/troubleshooting/max_daily_request_limit;
  https://upstash.com/docs/redis/sdks/ratelimit-ts/features.
  *Risk:* An in-memory fallback resets on cold start and doesn't coordinate across concurrent
  instances/regions, so it under-throttles relative to the Redis-backed limiter — document
  explicitly as degraded-mode, not equivalent.

- **[P1 / S] Turn the existing fail-open `console.warn` into a monitored signal** — *(stream:
  redis-rate-limit-resilience-patterns)*
  This session's incident was found only via a manual production audit — nothing was watching
  the `[rate-limit] check failed, failing open` warning already logged to Vercel Runtime Logs (a
  sink that works independent of Redis). Wire a log-drain alert, or extend the existing
  `/api/cron/health-check` cron (already scheduled, `maxDuration` 25) to actively probe Redis
  (a cheap PING/GET) and alert on failure.
  *Sources:* direct read of `src/lib/rate-limit.ts`; `vercel.json` cron schedule.
  *Risk:* Low — purely additive observability; watch for alert-fatigue if too sensitive to
  normal transient Upstash blips.

- **[P1 / M] Scope (don't yet execute) the `mcp-handler` v2 / `@modelcontextprotocol/server` v2
  migration using the official codemod** — *(stream: mcp-server-spec-and-security-currency)*
  This is the only lever to reach the current MCP spec (2026-07-28, which removes the
  `initialize` handshake and `Mcp-Session-Id` entirely and adds `server/discover`) and to pick
  up the SDK's 1.27.0-1.30.0 hardening fixes — notably a Content-Type-parsing fix
  (PR #2444) on the exact `WebStandardStreamableHTTPServerTransport` class Anvilry uses.
  `mcp-handler` retired its 1.x line after 1.1.0 (Anvilry's installed version) — there is no
  incremental patch path; it is v2 or stay on 1.x indefinitely. Anvilry's architecture
  (`mcp-tools.ts` is transport-agnostic pure functions; `route.ts` is thin wiring) minimizes the
  real migration surface to `route.ts`'s 10 `registerTool` calls plus handler/transport setup,
  and the MCP team ships `@modelcontextprotocol/codemod` specifically for this. Not urgent:
  2025-06-18 (Anvilry's current spec version) remains a valid, interoperable "Final" revision,
  Anvilry uses none of the protocol features that changed (no sampling/roots/elicitation/
  subscriptions/tasks), and there is no live CVE exposure today (see P2 note below). Treat as a
  planned architectural spike, not a routine bump — `mcp-handler` 2.x is only ~2 months old as
  of this research and still maturing.
  *Sources:* `gh api repos/modelcontextprotocol/typescript-sdk/pulls/2444`; npm peer-dependency
  inspection of `mcp-handler@1.1.0` vs `2.1.1`; `docs/specification/2026-07-28/changelog.mdx`
  (modelcontextprotocol/modelcontextprotocol repo).
  *Risk of deferring indefinitely:* Anvilry drifts further from the ecosystem's direction of
  travel and stays exposed to any future SDK-1.x-line-only CVE with no upgrade path but the same
  v2 migration, now under time pressure.

- **[P1 / M] Add an axe-core-based automated accessibility CI gate via
  `@axe-core/playwright`** — *(stream: testing-ci-tooling-currency)*
  Anvilry has **zero** automated a11y scanning today (confirmed: no axe-core/pa11y anywhere)
  despite a chat/voice/terminal/3D-graph surface with unusually deep custom ARIA — exactly the
  surface area most prone to the structural mistakes axe-core catches well (missing labels,
  contrast, duplicate IDs, invalid ARIA role/attribute combos). Wire it into the existing e2e
  Playwright job as a new spec scanning each of the four switcher views plus `/resume`, `/work`,
  `/projects`, following Playwright's own documented fixture pattern (shared `makeAxeBuilder`,
  `.withTags(['wcag2a','wcag2aa'])`, fingerprint assertions instead of snapshotting the full
  violations array, `testInfo.attach()` for full results).
  *Sources:* https://playwright.dev/docs/accessibility-testing; `gh api
  repos/dequelabs/axe-core-npm/releases` (current 4.13.0, 2026-08-11, maintained by Deque Labs,
  the axe-core owner).
  *Risk:* Be explicit this would **not** have caught this session's two aria-live
  double-announce bugs — those are behavioral/temporal; axe-core evaluates a static DOM
  snapshot. This closes a different, real gap (structural ARIA/contrast/labels), not "the fix"
  for what was just found (that's the P0 regression test above). Run once in report-only mode
  first to baseline any pre-existing violations before gating merges on it.

- **[P1 / S] Promote the 6 existing jsx-a11y ESLint rules from `warn` to a blocking check** —
  *(stream: testing-ci-tooling-currency)*
  `eslint-config-next/core-web-vitals` already registers 6 jsx-a11y rules
  (`alt-text`, `aria-props`, `aria-proptypes`, `aria-unsupported-elements`,
  `role-has-required-aria-props`, `role-supports-aria-props`) at severity `warn`, and neither
  `pnpm lint` nor CI's Lint step fails on warnings today. A live `npx eslint .` run this session
  showed **zero** current warnings, so there is no existing debt to clean up first — this is a
  same-day, essentially free win. Either add `--max-warnings 0` to the lint script/CI step, or
  override the 6 rules to `error` in `eslint.config.mjs`.
  *Sources:* direct inspection of installed `eslint-config-next@16.3.5`'s `dist/index.js` and
  `dist/core-web-vitals.js`; live `npx eslint .` run this session.
  *Risk:* Low — verified zero current warnings; the only "risk" is a future contributor's PR
  legitimately failing on a new violation, which is the intended behavior.

---

## P2 — Later

### Actionable

- **[P2 / S] Bump the secondary/fallback Opus rung on both model chains and align generations**
  — *(stream: claude-model-chain-currency)*
  Bump `BEDROCK_CHAIN`'s secondary to `us.anthropic.claude-opus-5`, matching Anthropic's actual
  current Opus-tier model, and fix the small pre-existing inconsistency where `ANTHROPIC_CHAIN`
  already uses a newer Opus (4.7) than `BEDROCK_CHAIN` (4.6-v1). Since the account's Opus IAM
  deny is by-family, not by-version, this changes nothing about live Bedrock traffic —
  `MODEL_UNAVAILABLE_MARKERS` already treats the resulting 403 as fallback-eligible, so requests
  still land on Haiku exactly as today. Leave Haiku 4.5 untouched on both chains (no Haiku 5
  exists in Bedrock's catalog yet).
  *Sources:* AWS Bedrock model-cards-anthropic.html (18-row table, no Haiku newer than 4.5); IAM
  deny fact from prior-session memory, corroborated by `MODEL_UNAVAILABLE_MARKERS` in `llm.ts`.
  *Risk:* None functionally; purely keeps the chain's "what would run if permissions change"
  documentation accurate.

- **[P2 / S] Re-derive the Opus 4.6 and Haiku 4.5 rows in `BEDROCK_PRICE`** — *(stream:
  bedrock-prompt-caching-best-practices)*
  Both rows currently match older model generations' rate cards (Opus 4.1 and Haiku 3.5,
  respectively) rather than the models actually named in the row. Opus's row is dormant
  (IAM-denied), but Haiku 4.5 is the real, reachable fallback tier — its mispriced row distorts
  telemetry on every fallback event.
  *Sources:* `src/app/api/chat/route.ts` `BEDROCK_PRICE` table vs. platform.claude.com pricing.
  *Risk:* Verify exact numbers against the AWS Bedrock pricing console (not just doc pages)
  before committing — this session's doc fetches surfaced some unfamiliar model codenames worth
  a sanity check (see "Does NOT cover" below).

- **[P2 / S] Make `cacheWrite` TTL-aware in the pricing table** (e.g.
  `cacheWrite5m`/`cacheWrite1h`) — *(stream: bedrock-prompt-caching-best-practices)*
  Cheap to bundle with the item above; prevents the same class of staleness recurring if a
  future change adds a second, shorter-TTL checkpoint. Not urgent — Anvilry uses only one TTL
  today.
  *Risk:* None — additive; can be deferred indefinitely if not touching this code again soon.

- **[P2 / S] One-time telemetry check: confirm the Haiku 4.5 fallback path actually produces
  nonzero cache tokens in production** — *(stream: bedrock-prompt-caching-best-practices)*
  The measured cached system block (~3,674-4,199 tokens) sits right at/near the ~4,096-token
  minimum both reference sources agree on for Haiku 4.5/Opus 4.6. Bedrock caching fails silently
  below threshold (the call still succeeds normally), so it's plausible the rare Haiku fallback
  gets zero cache benefit unnoticed. Read-only query of existing `llm.attempt` telemetry, no
  code change needed unless it turns out to matter.
  *Risk:* None — read-only verification.

- **[P2 / M] Trial `partialPrefetching: true` alongside the existing `cacheComponents: true`** —
  *(stream: nextjs-react-upgrade-path)*
  Currently-available (non-canary) Next 16.3 feature purpose-built as the next layer on Cache
  Components, which Anvilry has already fully migrated to (26 segment configs / 22 files). Given
  the site's heavy client-side view-switching and multiple MDX content routes, finer per-link
  prefetch control could reduce over/under-fetching.
  *Sources:* nextjs.org/blog/next-16-3 ("Instant Navigations" feature set).
  *Risk:* Needs retesting: the bundle-budget gate (prefetch payload can change first-load JS
  accounting), the full Playwright e2e suite, and manual confirmation that `?view=` deep-link
  behavior (a module-level external store, not App Router navigation) is unaffected.

- **[P2 / S] Consider a `catchError`-based retry boundary for the `/projects` live GitHub
  feed** — *(stream: nextjs-react-upgrade-path)*
  Next 16.3's `catchError` (from `next/error`) is the first API letting an error boundary
  retry/re-render a failed Server Component without fighting `notFound()`/`redirect()`.
  `/projects` is the one route with a genuine live external dependency (`getRepoFeed` under
  `"use cache"` + `cacheLife("hours")`) where a user-facing retry button would beat a generic
  error page.
  *Risk:* Low priority — no evidence of frequent `/projects` failures in the codebase; UX
  nicety, skip if no reported pain.

- **[P2 / S] Re-check `vercel/next.js#94456` before any future Next 16.4 upgrade** — *(stream:
  nextjs-react-upgrade-path)*
  Open upstream issue ("Turbopack: build failure when using dynamic imports and cache
  components") whose body/repro could not be read this session (GitHub REST API rate-limited
  mid-research) — applicability to Anvilry's `next/dynamic(..., {ssr:false})` R3F loader is
  **unconfirmed**, flagged rather than resolved.
  *Risk:* If ignored and it turns out to match Anvilry's exact usage, a future Next 16.4 bump
  could silently break the gamified view's build.

- **[P2 / S] Add a periodic (quarterly) check for a `@react-three/fiber` 9.x patch release or
  v10 stable** — *(stream: r3f-three-upgrade-path)*
  The 9.x backport PR (#3871) for the null-target `connect()` crash Anvilry patches around
  (issue #3754, still open) could merge with no advance warning; v10 stable will eventually ship
  with the fix built-in but is currently alpha.5 with 11 open milestone issues. Anvilry's patch
  is version-locked to exactly `@react-three/fiber@9.7.0` in `pnpm-workspace.yaml`, so any
  version bump will loudly fail to apply (safe failure mode) rather than silently drop.
  *Risk:* Low — worst case is a flagged-unappliable patch, not a silent regression.

- **[P2 / S] Bump `zod` ^3.25.76 → ^4.6.5, fixing the single `z.record()` breaking call** —
  *(stream: zod-v4-and-eslint-10-migration)*
  The real migration surface is tiny: only 3 files import zod directly
  (`telemetry/schema.ts`, `api/error/route.ts`, `mcp-tools.ts`); `velite.config.ts` is
  completely unaffected (Velite vendors its own internal zod-v3-derived validator, decoupled
  from the app's zod dependency); and the whole consuming chain
  (`@modelcontextprotocol/sdk@1.26.0` + `zod-to-json-schema@3.25.2`) already declares peer
  support for zod v4. Exactly one required code change:
  `z.record(z.unknown())` → `z.record(z.string(), z.unknown())` at
  `telemetry/schema.ts:80`. Zod v4 has been GA for 14+ months.
  *Sources:* npm registry dist-tags/time for `zod`; zod.dev/v4/changelog; grep across `src/` for
  `z.record(`; installed package.json manifests for the MCP SDK chain.
  *Risk:* Low — main unknown is whether pnpm dedupes to a single zod v4 cleanly; run `pnpm why
  zod` right after bumping, before the test suite.

- **[P2 / S] Bump `eslint` ^9 → ^10.10.0** — *(stream: zod-v4-and-eslint-10-migration)*
  Anvilry is already pure flat config (no eslintrc-removal cost) with only plain-path
  `globalIgnores` (no minimatch-upgrade impact). `eslint-config-next@16.3.5`'s shipped
  flat-config source never enables `no-unused-vars`/`no-undef` or extends `@eslint/js`
  recommended, so ESLint 10's three newly-default rules and its JSX-scope-tracking risk don't
  apply here. `@typescript-eslint/parser@8.70.0` and `eslint-config-next`'s peer range already
  permit ESLint 10. GA for 7+ months.
  *Sources:* direct read of installed `eslint-config-next@16.3.5` dist files; npm dist-tags for
  `eslint`; official ESLint migration guide (eslint.org/docs/latest/use/migrate-to-10.0.0).
  *Risk:* Medium-low — `eslint-plugin-react`/`react-hooks`/`jsx-a11y`/`import` are pulled in
  transitively, so their ESLint-10 compatibility can't be confirmed from peer ranges alone; run
  `pnpm lint` on a throwaway branch first. Two open, unmerged next-codemod PRs (#98593, #98556)
  in vercel/next.js about this exact peer-range handling signal the combination is still being
  smoothed out upstream — treat the first real `pnpm lint` run as the actual gate.
  *Sequencing note:* ship the zod and eslint bumps together as one small maintenance PR — zero
  shared surface, neither coupled to any in-flight work; if `pnpm lint` under ESLint 10 does
  surface unexpected transitive-plugin findings, split it back out rather than blocking the
  lower-risk zod bump.

- **[P2 / S] Extend `make env-check` (or add `make redis-health`) to verify live Redis
  reachability/quota, not just env-var presence** — *(stream:
  redis-rate-limit-resilience-patterns)*
  The current check only answers "are `UPSTASH_REDIS_REST_URL`/`_TOKEN` set" — exactly the blind
  spot that let "configured but exhausted" go unnoticed until a manual audit found it. A
  one-command live PING probe closes the gap for local/manual verification.
  *Risk:* None — read-only diagnostic.

- **[P2 / M] (Awareness only) Audit aggregate Redis command volume across rate-limit + FAQ
  cache + telemetry** — *(stream: redis-rate-limit-resilience-patterns)*
  The rate limiter, the FAQ/semantic chat cache (`get`/`mget`/`zrange`/`set`/`zadd`/
  `zremrangebyscore`/`zremrangebyrank`), and telemetry's dual-sink emit (`zadd`+
  `zremrangebyscore` per event) all draw from the same account-level budget that just got
  exhausted. Flagging for prioritization only — overlaps with sibling kv-caching/prompt-caching
  research and shouldn't be duplicated here.
  *Risk:* None — pointer, not a proposed change.

- **[P2 / S] Document (don't implement) the Origin-header/DNS-rebinding spec gap as an accepted
  risk** — *(stream: mcp-server-spec-and-security-currency)*
  The Streamable HTTP transport spec's MUST-validate-Origin requirement is unmet — `mcp-handler`
  exposes no config surface for `enableDnsRebindingProtection`/`allowedOrigins` at either major
  version. Per the SDK's own GHSA-w48q-cv73-mx4w and the spec's own framing, this protection
  exists to stop DNS rebinding into *locally-bound* (localhost) unauthenticated servers; Anvilry
  is a publicly reachable HTTPS endpoint on Vercel with no origin- or cookie-based trust
  boundary, so there is no exploitable path (an attacker already has direct access to the same
  data by calling the endpoint). Recommend a one-line note in `mcp-tools.ts`/`route.ts`'s
  comment block recording this as a knowingly-accepted, low-risk gap.
  *Sources:* GHSA-w48q-cv73-mx4w; `docs/specification/2026-07-28/basic/transports/streamable-http.mdx`
  §"Security & Endpoint."
  *Risk:* If Anvilry's threat model ever changes (e.g. the MCP server starts handling
  authenticated/session-scoped data), this decision must be revisited — the "no real risk"
  conclusion depends entirely on staying public/read-only/stateless.

- **[P2 / S] Bump `@playwright/test` ^1.62.1 → ^1.63.0** — *(stream:
  testing-ci-tooling-currency)*
  Purely additive minor (test locks, frame-agnostic `frameLocator()`, `locator.visible()`,
  structured step params, new `snapshots:{dom,aria,screen}` trace capture) — no breaking API
  changes for standard usage; the only announced removals (experimental Component Testing
  packages, Ubuntu 20.04) don't apply to Anvilry's `ubuntu-latest` CI.
  *Sources:* `gh release view v1.63.0 --repo microsoft/playwright`.
  *Risk:* Minimal — additive-only per official release notes.

- **[P2 / S] Bump `vitest` ^5.0.0 → ^5.0.1** — *(stream: testing-ci-tooling-currency)*
  Pure patch release (collection-failure exit code, static-collection parse-error details,
  automocking recursive-prototype fix, cache-metadata-file fix, fake-timers fixes) — no breaking
  changes; since `vitest run` is chained into `pnpm build`, staying current on patches reduces
  exposure to already-fixed bugs at zero migration cost (the real v4→v5 migration is already
  done).
  *Sources:* `gh release view v5.0.1 --repo vitest-dev/vitest`.
  *Risk:* Negligible.

### Confirmed correct / no action needed

These are genuine findings, not omissions — several streams concluded the current
implementation is already correct and recommended explicitly **not** changing it:

- **No Next.js/React version bump needed right now** — Anvilry is already on the latest stable
  release of both (`next@16.3.5`, `react/react-dom@19.3.0`), confirmed live against npm and
  GitHub; Next 16.4 and React's post-19.3.0 line are both still canary-only. *(stream:
  nextjs-react-upgrade-path)*

- **Leave the native `document.startViewTransition` approach as-is; do not migrate to React's
  now-stable `<ViewTransition>`** — no functional gap identified that it would close; Anvilry's
  existing implementation is simpler and was a deliberate, documented choice. *(stream:
  nextjs-react-upgrade-path)*

- **Keep the existing `@react-three/fiber@9.7.0` patch exactly as-is** — no upstream fix exists
  yet; confirmed via the still-open GitHub issue (#3754), five rejected duplicate PRs, and direct
  inspection of the v10 branch source showing the fix only exists in the unreleased, pre-1.0 v10
  line. *(stream: r3f-three-upgrade-path)*

- **Do not adopt `@react-three/fiber` v10 (alpha), drei 10-rc/11-alpha, or postprocessing
  7-alpha for production** — all are pre-1.0 prereleases mid-rewrite for WebGPU/TSL; Anvilry's
  hero-graph is plain WebGL and gets zero benefit today while inheriting alpha-stage
  instability. *(stream: r3f-three-upgrade-path)*

- **Note (don't act on) the React 19.3 / fiber 9.7.0 peer-range gap as a landmine** — fiber
  9.7.0's peerDependencies exclude React 19.3.0 exactly, and this is load-bearing (issue #3915:
  a real `useTransition`-inside-R3F-tree crash under React 19.3, fix PR #3916 open/unmerged).
  Anvilry has zero `useTransition` call sites anywhere today, so nothing is broken — the only
  action is awareness: don't introduce `useTransition` inside the hero-graph's `<Canvas>` tree
  until #3916 merges. *(stream: r3f-three-upgrade-path)*

- **No change to cache checkpoint placement, 1h TTL choice, or leaving the GitHub-stats block
  uncached** — all match AWS's/Anthropic's currently-published guidance for Claude models on
  Bedrock verbatim (stable content before the checkpoint, variable content after, 1h TTL for
  sub-hourly-but-not-sub-5-minute reuse). *(stream: bedrock-prompt-caching-best-practices)*

- **Do not migrate `src/lib/llm.ts` to Vercel AI Gateway now** — nothing in the codebase needs it
  enough to justify re-implementing the hand-built fallback state machine, per-attempt
  telemetry, and Bedrock-specific extended-thinking plumbing against a new transport, especially
  since AI Gateway's docs retrieved this session document reasoning support but **not**
  Anthropic prompt-caching — and Anvilry's entire system-prompt cost-caching design depends on
  that. *(stream: vercel-platform-feature-adoption)*

- **Leave `vercel.json` as-is; do not migrate to `vercel.ts`** — `vercel.ts`'s value proposition
  (dynamic env-driven values, richer type-safety) has no surface to attach to in Anvilry's
  actual `vercel.json`, which is nine lines of static cron schedules with no per-environment
  branching. *(stream: vercel-platform-feature-adoption)*

- **No action on `next/image`/raster images right now** — zero call sites of `next/image` exist
  anywhere in `src/`, and there is no live raster image on any LCP path today, so adopting it
  would not move any Core Web Vital. Worth a one-line doc note (not a code change) so a future
  content author populating `Work.diagram` knows the `next.config.ts` `images` block is
  otherwise inert. *(stream: core-web-vitals-and-bundle-optimization)*

---

## What This Plan Explicitly Does NOT Cover

Several streams flagged real limits on what they could verify in this research pass — these are
open questions, not resolved facts, and should not be treated as settled:

- **Exact Bedrock dollar figures and minimum-cacheable-token thresholds** should be spot-checked
  against the live AWS Bedrock pricing console before being hard-coded anywhere — this
  session's two reference sources disagreed with each other on Sonnet 4.6's exact minimum-token
  threshold (1,024 vs. 2,048), and prior-session experience flagged that sandboxed AWS-doc-fetch
  tools have previously returned content with fabricated-looking model names. (The
  `claude-model-chain-currency` stream did independently corroborate the newer Fable/Mythos
  model-family names via a direct, unauthenticated `curl` outside the sandbox proxy and via
  Anthropic's own news posts — so that specific finding is high-confidence — but the discipline
  of re-verifying bleeding-edge specifics outside the sandbox should continue.)

- **Whether Vercel AI Gateway supports Anthropic prompt-caching pass-through, and whether it
  supports BYOK against Anvilry's own AWS Bedrock account** — neither could be confirmed present
  or absent from the AI Gateway documentation retrieved this session. This is the reason the
  "do not migrate to AI Gateway" recommendation above is conditional, not permanent — revisit
  only if this gap is resolved.

- **Which BotID tier (Basic vs. Deep Analysis) is included on Anvilry's current Vercel plan** —
  could not be independently confirmed from docs search; check the Vercel dashboard before
  enabling.

- **The full body/reproduction of `vercel/next.js#94456`** ("Turbopack: build failure when using
  dynamic imports and cache components") — the GitHub REST API's unauthenticated rate limit was
  exhausted mid-research before it could be read. Its applicability to Anvilry's hero-graph
  loader pattern is flagged as unconfirmed, not resolved either way.

- **ESLint-10 compatibility of `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  `eslint-plugin-jsx-a11y`, and `eslint-plugin-import`** — these are pulled in transitively by
  `eslint-config-next`, not directly pinned by Anvilry, so their internal ESLint-10 compatibility
  cannot be confirmed from `package.json` peer ranges alone. The first real `pnpm lint` run under
  ESLint 10 is the actual gate, not the peer-range check.

- **Whether pnpm will cleanly dedupe to a single zod v4 across the whole dependency tree** given
  the MCP SDK's own `"zod": "^3.25 || ^4.0"` peer range — not verifiable without actually
  performing the bump; a dual-package (v3+v4) `instanceof` hazard is the specific risk to check
  for via `pnpm why zod` immediately after bumping.

- **Whether the rare Haiku 4.5 fallback path actually produces nonzero prompt-cache tokens in
  production** — the measured cached block sits right at/near the ~4,096-token minimum both
  reference sources agree on for Haiku 4.5/Opus 4.6, and Bedrock caching fails silently below
  threshold. Flagged as an open ambiguity (P2 telemetry check above), not confirmed either way.

- **Live production accessibility beyond automated scanning** — Playwright's own accessibility
  docs are explicit that automated tools like axe-core catch only a subset of issues (contrast,
  labels, duplicate IDs) and that "many accessibility problems can only be discovered through
  manual testing." The P1 axe-core recommendation above closes a real, distinct gap but is not a
  substitute for manual review, and would not have caught this session's two aria-live
  double-announce bugs (which are behavioral/temporal, not structural).
