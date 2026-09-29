---
kind: doc
title: lib — AI, Voice, Telemetry & Infrastructure
domain: [content]
status: current
version: v3.7.0
---

# lib — AI, Voice, Telemetry & Infrastructure

> Part of the Anvilry v3.7.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> Describes Anvilry v3.7.0 (`package.json` 3.7.0), i.e. main a929932 plus five later behavioural fixes: notes hidden at the data layer when `NOTES_ENABLED` is off; per-class rate-limit buckets (`chat`/`voice`/`beacon`) with a `CRON_SECRET` bypass via `src/lib/cron-auth.ts`; admin auth shared by the proxy, `requireAdmin` and the telemetry page through `isAdminAuthorized`; command-palette talk mode gated by `isVoiceViewActive`; and the bundle-budget `MIN_ROUTES` floor plus removal of dead components. Only the rate-limit and admin-auth fixes touch this doc's modules.

**Scope:** `src/lib/llm.ts`, `src/lib/llm-sdk-mode.ts`, `src/lib/llm-trace.ts`, `src/lib/agent-trace.ts`,
`src/lib/voice-catalog.ts`, `src/lib/voice-picker-mode.ts`, `src/lib/voice-settings-context.tsx`,
`src/lib/rate-limit.ts`, `src/lib/redis.ts`, `src/lib/admin-auth.ts`, `src/lib/cron-auth.ts`,
`src/lib/chat-cache.ts`, `src/lib/faq-embeddings.ts`, `src/lib/r3f.ts`,
`src/lib/use-media-query.ts`, `src/lib/use-mounted.ts`, `src/lib/use-reduced-motion.ts`,
`src/lib/telemetry/**` (non-test), `src/lib/scroll/**` (non-test).
Excluded: `*.test.ts` / `*.dom.test.*`, and the content/data/domain modules (`content.ts`, `corpus.ts`,
`game-model.ts`, `mcp-tools.ts`, `flags.ts`, …).

**Files indexed:** 27

`case-study-depth`: **no source file exists.** Only `src/lib/case-study-depth.test.ts` is present; it imports
`allWork` from `@/lib/content` and asserts on Velite frontmatter fields (`diagram`, `diagramAlt`, `constraints`,
`tradeoffs`) directly. There is no `src/lib/case-study-depth.ts` to index (verified with `find`).

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/lib/llm.ts` | Single source of truth for the chatbot AI layer: provider toggle, client construction, model fallback chain, AWS credential decoding, streaming-with-fallback ReadableStream. | `LlmProvider`, `LlmUsage`, `LlmAttempt` (types); `isSonnet5PrimaryEnabled`, `getProvider`, `bedrockCreds`, `isConfigured`, `modelChain`, `makeClient`, `isFallbackEligible`, `streamWithFallback`; re-exports `TRACE_DELIMITER`, `THINKING_SENTINEL`, `THINKING_END` |
| `src/lib/llm-trace.ts` | Client-safe stream-protocol constants + trace-frame type, split out so the chat client never imports the Bedrock SDK. | `TRACE_DELIMITER`, `THINKING_SENTINEL`, `THINKING_END`, `stripControlBytes`; `LlmUsage`, `TraceFrame` (types) |
| `src/lib/llm-sdk-mode.ts` | Build-time flag naming which Bedrock SDK `/api/chat` should use. Currently declared but **imported by nothing** — the `aws-sdk-bedrock` branch is unbuilt. | `LlmSdkMode` (type), `getLlmSdkMode`, `LLM_SDK_MODE` |
| `src/lib/agent-trace.ts` | Hardcoded deterministic multi-agent "glass box" demo script; ships dark behind a placeholder sentinel gate. | `PLACEHOLDER_SENTINEL`, `AgentName`, `AGENTS`, `AgentStep`, `Scenario`, `scenarios`, `allReferencedSlugs`, `traceApproved`, `linkForSlug` |
| `src/lib/voice-catalog.ts` | Authoritative static catalog of every voice across browser / Polly / Google engines + lookup, allowlist and resolver helpers. | `VoiceEngine`, `PollyTier`, `VoiceGender`, `VoiceAccent`, `VoiceEntry` (types); `CURATED_VOICES`, `EXTENDED_VOICES`, `ALL_VOICES`; `getDefaultVoiceId`, `getVoiceById`, `getVoiceByPollyId`, `getVoiceByGoogleName`, `getVoicesForEngine`, `validateVoiceForEngine`, `resolvePollyParams`, `resolveGoogleVoiceName`, `findBrowserVoice` |
| `src/lib/voice-picker-mode.ts` | Build-time flag choosing the voice picker's UX layout (descriptor cards vs gender toggle). | `VoicePickerMode` (type), `getVoicePickerMode`, `VOICE_PICKER_MODE` |
| `src/lib/voice-settings-context.tsx` | Module-level external store for persisted voice prefs (localStorage), read synchronously on first client render. | `SttEngine`, `TtsEngine`, `TalkSurface`, `VoiceCharacter*`, `VoiceSettings` (types); `DEFAULT_VOICE_CHARACTER`, `useVoiceSettings`, `DEFAULTS`, `STORAGE_KEY`, `parse`, `__resetVoiceSettingsForTest` |
| `src/lib/rate-limit.ts` | Per-IP Upstash sliding-window limiter with one independent bucket per route class (`chat`/`voice`/`beacon`); valid cron bearer bypasses; fails open in every failure mode. | `RateLimitClass` (type), `isRateLimitEnabled`, `checkRateLimit` |
| `src/lib/redis.ts` | Shared Upstash Redis singleton; `null` when unconfigured, construction guarded against `UrlError`. | `redis`, `isRedisConfigured` |
| `src/lib/admin-auth.ts` | Single HTTP Basic credential check for the admin surface, shared by `src/proxy.ts`, `requireAdmin` (FAQ purge route) and the `/admin/telemetry` page. | `isAdminAuthorized`, `requireAdmin` |
| `src/lib/cron-auth.ts` | Fail-closed `CRON_SECRET` bearer check (SHA-256 digests + `timingSafeEqual`); guards all five cron routes and lets the eval cron bypass the rate limiter. | `hasValidCronSecret`, `unauthorizedUnlessCron` |
| `src/lib/chat-cache.ts` | Upstash FAQ full-response cache for first-turn chat questions: exact-hash tier + optional semantic tier, corpus-build tagging, 24 h TTL, capped index, admin purge. | `FaqCacheEntry`, `FaqCacheHit`, `FaqCachePurgeResult` (types); `FAQ_CACHE_TTL_SECONDS`, `FAQ_CACHE_INDEX_CAP`, `TRIM_SAMPLE_EVERY`, `MAX_CACHEABLE_ANSWER_CHARS`; `normalizeQuestion`, `faqCacheKey`, `isSemanticMatchEnabled`, `isFaqCacheEnabled`, `faqCacheGet`, `faqCacheSemanticGet`, `faqCacheSet`, `faqCachePurge` |
| `src/lib/faq-embeddings.ts` | Titan Text Embeddings v2 via raw Bedrock `InvokeModel` (5 s abort) plus `cosineSimilarity`; only used by the semantic cache tier. | `embedText`, `cosineSimilarity` |
| `src/lib/telemetry/schema.ts` | Telemetry envelope schema (zod, 8 kinds) + PII redaction + salted IP hashing. Pure data, no I/O. | `KIND_LITERALS`, `KindLiteral`, `TelemetryEventSchema`, `TelemetryEvent`, `redact`, `hashIp` |
| `src/lib/telemetry/emit.ts` | Dual-sink fire-and-forget emitter: Vercel Runtime Logs (source of truth) + Upstash sorted set (7-day retention, sampled trim). | `emit` |
| `src/lib/telemetry/with-trace.ts` | Universal `/api/*` observability wrapper — mints traceId, stamps a response header, emits exactly one span, re-throws. | `TraceCtx` (type), `withTrace` |
| `src/lib/telemetry/beacon.ts` | The single client-side egress for browser errors: `sendBeacon` primary, keepalive `fetch` fallback. | `ErrorBeaconPayload` (type), `sendErrorBeacon` |
| `src/lib/scroll/types.ts` | Type-only contract shared by both autoscroll engines (engine, mode, metric, options, return shape). | `ScrollEngine`, `ScrollMode`, `ScrollMetric`, `UseAutoScrollOptions`, `UseAutoScroll` |
| `src/lib/scroll/resolve-flag.ts` | Pure generic flag resolver: URL param > localStorage > default, invalid values skipped. | `resolveFlag` |
| `src/lib/scroll/scroll-flags.tsx` | Runtime external store + `<ScrollFlagsSync>` reader for the `?scroll=` / `?scrollmode=` A/B flags. | `setScrollEngine`, `setScrollMode`, `ScrollFlagsSync`, `useScrollEngine`, `useScrollMode`, `ENGINES`, `MODES`, `DEFAULT_ENGINE`, `DEFAULT_MODE` |
| `src/lib/scroll/use-auto-scroll.ts` | Engine-agnostic entry point; calls both engine hooks unconditionally and returns the flagged one. | `useAutoScroll` |
| `src/lib/scroll/use-stick-to-bottom-custom.ts` | In-repo autoscroll engine: persisted pin-intent flag + ResizeObserver + programmatic-scroll guard window; supports `message-top`. | `useStickToBottomCustom` |
| `src/lib/scroll/use-stick-to-bottom-library.ts` | Adapter mapping the `use-stick-to-bottom` npm package onto `UseAutoScroll`; instant (non-animated) follow, no `anchorRef`. | `useStickToBottomLibrary` |
| `src/lib/r3f.ts` | Re-export barrel for the whole R3F universe so bundlers hoist ONE shared chunk instead of duplicating per `import()` boundary. | `Canvas`, `useFrame`, `useThree`, `useLoader`, `useGraph`, `extend`, `ThreeEvent`, `RootState`, `RenderCallback`, `THREE`, `OrbitControls`, `Billboard`, `Text`, `Html`, `useTexture`, `useGLTF`, `useAnimations`, `Float`, `MeshDistortMaterial`, `GradientTexture`, `EffectComposer`, `Bloom`, `Vignette`, `Noise`, `ChromaticAberration` |
| `src/lib/use-media-query.ts` | SSR-safe media-query subscription + memoized WebGL-context capability probe. | `useMediaQuery`, `useWebGLSupported` |
| `src/lib/use-mounted.ts` | Hydration-safe "has the client mounted" flag via `useSyncExternalStore` (no setState-in-effect). | `useMounted` |
| `src/lib/use-reduced-motion.ts` | Native `prefers-reduced-motion` hook replacing `motion/react`'s version (avoids the 140KB motion bundle). | `useReducedMotion` |

## Detail

### `src/lib/llm.ts`

- **Role:** The chatbot's entire AI layer — provider selection, credential decoding, model fallback chain, and the streaming `ReadableStream` that falls through models on availability errors.
- **Exports:** `LlmProvider` (type) — `"bedrock" | "anthropic"`; `LlmUsage` (type) — snake_case token block; `LlmAttempt` (type) — per-attempt observability span (carries optional `answerText`); `isSonnet5PrimaryEnabled()`; `getProvider()`; `bedrockCreds()`; `isConfigured()`; `modelChain()`; `makeClient()`; `isFallbackEligible(err)`; `streamWithFallback(params, opts?)`; plus a re-export of `TRACE_DELIMITER`, `THINKING_SENTINEL`, `THINKING_END` (llm.ts:195).
- **Reads / depends on:** `@anthropic-ai/sdk`, `@anthropic-ai/bedrock-sdk`, `@/lib/profile` (for the apology email), `@/lib/llm-trace` (constants plus `stripControlBytes`). Env: `LLM_PROVIDER`, `LLM_USE_SONNET_5`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_SESSION_TOKEN`, `BEDROCK_REGION`, `AWS_REGION`, `ANTHROPIC_API_KEY`.
- **Consumed by:** `src/app/api/chat/route.ts` (`isConfigured`, `streamWithFallback`, `TRACE_DELIMITER`); `bedrockCreds` only (same AWS account/region reuse) by `src/app/api/tts/route.ts:2`, `src/app/api/transcribe/route.ts:6` and `src/lib/faq-embeddings.ts:5`.

**Exact provider toggle** (`getProvider`, llm.ts:83-85):

```ts
return process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "bedrock";
```

Bedrock is the default for *any* value other than the exact string `"anthropic"` (including unset).

**Full model fallback chains** (exact IDs). The PRIMARY rung on both chains is conditional on `isSonnet5PrimaryEnabled()` (`process.env.LLM_USE_SONNET_5 === "true"`, default false) — Opus and Haiku are never affected by this flag:

| Provider | Index 0 (primary) | Index 1 (secondary) | Index 2 (fallback) | Cite |
|---|---|---|---|---|
| `bedrock` | `us.anthropic.claude-sonnet-4-6` (or `-sonnet-5` when the flag is on) | `us.anthropic.claude-opus-4-6-v1` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | `bedrockChain()`, llm.ts:52-60 |
| `anthropic` | `claude-sonnet-4-6` (or `claude-sonnet-5` when the flag is on) | `claude-opus-4-7` | `claude-haiku-4-5` | `anthropicChain()`, llm.ts:63-69 |

Opus 4.6 on Bedrock **requires** the `-v1` suffix; the bare ID 400s with "model identifier is invalid" (llm.ts:48-50). Note the two chains are not version-parallel: Bedrock secondary is opus-4-6, the direct-API secondary is `claude-opus-4-7` (llm.ts:66). The source comment at llm.ts:35-42 records that Opus is IAM-denied on the reference account whichever generation is named. Whether a denied Opus attempt then falls through to Haiku depends on how Bedrock reports the deny: `isFallbackEligible` only advances on a connection error, 429/404/5xx, or a 400 carrying one of the six markers, and a plain 403 would end the chain with the apology tail.

**`decodeSecret`'s base64 round-trip check** (llm.ts:94-104) — private, not exported:

```ts
const decoded = Buffer.from(value, "base64").toString("utf-8");
if (Buffer.from(decoded, "utf-8").toString("base64") === value)
  return decoded;   // llm.ts:97-99
```

Re-encoding the decode and comparing to the original is the discriminator; a plain "decodes without throwing" test is too loose because many raw secrets are coincidentally valid base64. Raw `AKIA…` keys are not valid base64 *of themselves*, so they fall through unchanged. Empty/undefined → `""` (llm.ts:95). `decodeSecret` has no direct unit test (`llm.test.ts` imports neither it nor `bedrockCreds`).

**Every env var read**, with cites:

| Env var | Where | Behaviour |
|---|---|---|
| `LLM_PROVIDER` | llm.ts:84 | `"anthropic"` → direct API; anything else → bedrock |
| `LLM_USE_SONNET_5` | llm.ts:43-45 | `"true"` → Sonnet 5 replaces Sonnet 4.6 as PRIMARY on both chains; default false |
| `BEDROCK_ACCESS_KEY_ID` | llm.ts:111 | base64-or-raw via `decodeSecret` |
| `BEDROCK_SECRET_ACCESS_KEY` | llm.ts:112 | base64-or-raw via `decodeSecret` |
| `BEDROCK_SESSION_TOKEN` | llm.ts:113-115 | optional (STS temp creds); `undefined` when unset |
| `BEDROCK_REGION` | llm.ts:119 | **preferred** region source |
| `AWS_REGION` | llm.ts:119 | second-choice fallback only (local dev), then `"us-east-1"`; reserved on Vercel — observed corrupted to `s-east-1` in prod (llm.ts:116-118) |
| `ANTHROPIC_API_KEY` | llm.ts:129 | readiness check for the `anthropic` provider; the SDK itself reads it from env (llm.ts:159-160) |

Note: `llm.ts` does **not** read `EXTENDED_THINKING` — the chat route does (`src/app/api/chat/route.ts:385`, `process.env.EXTENDED_THINKING !== "false"`, i.e. default ON) and passes the result down as `opts.extendedThinking`.

**The `emittedAny` fallback invariant.** `emittedAny` is declared at llm.ts:292 and set `true` unconditionally inside the `text_delta` branch (llm.ts:497), AFTER `stripControlBytes` but BEFORE any emptiness check — unlike the `thinking_delta` branch, which only enqueues a chunk `if (chunk)` (non-empty after `stripControlBytes`). So the true gate is **"has a `text_delta` event been received,"** not literally "have any bytes been sent": a `text_delta` event whose text strips to an empty string would still set `emittedAny = true` and permanently disable fallback for the rest of that attempt, even though nothing visible was actually streamed. `emittedAny` gates two separate decisions:

1. **Fallback eligibility** (llm.ts:563-590): `const goingToApology = emittedAny || isLast || !isFallbackEligible(err);` (`isLast` at llm.ts:562) → enqueue `apologyTail` and close. Only an attempt with no `text_delta` yet + an eligible error + models remaining advances the loop. Once a `text_delta` has arrived it cannot be un-sent, so a later error is terminal — no retry.
2. **Trace-frame emission** (llm.ts:535-542): the trace frame is appended *only* when `emittedAny`, preserving the v1.6 invariant that an attempt with no `text_delta` can never materialize a trace frame. The `answerText` field on the success `onAttempt` span is gated by the same flag (llm.ts:529).

`THINKING_SENTINEL` emission is a SEPARATE, stream-scoped guard, not gated on `emittedAny` alone: `if (useThinking && !emittedAny && !thinkingSentinelEmitted)` (llm.ts:407-409) — `thinkingSentinelEmitted` (declared once per stream, llm.ts:299) is what prevents a second, spurious sentinel on a fallback attempt; `!emittedAny` here is just "don't bother opening a new reasoning phase once a `text_delta` has already arrived."

The load-bearing reason (the `streamWithFallback` docblock at llm.ts:184-192): streaming errors surface *inside* the `for await` loop, never at the `.stream()` callsite, so connect-time and mid-stream errors are indistinguishable by call site. Whether a `text_delta` has already arrived is the only reliable discriminator.

- **Behaviour notes:**
  - `PER_ATTEMPT_TIMEOUT_MS = 15_000` applied as the SDK `timeout` for both providers (llm.ts:33, 151, 160).
  - `isFallbackEligible` (llm.ts:169-182): `APIConnectionError` → true; status `429`/`404` → true; status `>= 500` → true; status `400` → true only if the lowercased message contains one of the six `MODEL_UNAVAILABLE_MARKERS` (llm.ts:74-81: `"model identifier is invalid"`, `"model id is invalid"`, `"could not be found"`, `"not authorized to access the model"`, `"don't have access to the model"`, `"is not supported"`). Plain 400/401/403/422 → **not** eligible. Status+message driven so it survives a double-installed SDK where `instanceof` breaks.
  - `makeClient` passes DECODED creds via a **double-async** `providerChainResolver: async () => async () => ({...})` (llm.ts:152-156) — the resolver returns a credential provider, which returns credentials. Without this the AWS default chain would sign with still-base64 values.
  - Client construction happens **inside** `start()` (llm.ts:311-329) so a constructor failure becomes a graceful apology stream rather than an uncaught 500. That failure emits an attempt with `model: "client-init"` and `attempt_index: -1` (llm.ts:317-318; `latency_ms: 0` at llm.ts:320) and strips the leading `\n\n` from the apology (llm.ts:326).
  - Usage capture: `message_start` → `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` (llm.ts:417-437); `message_delta` → `output_tokens` and `delta.stop_reason` → `finishReason` (llm.ts:440-449). `usage` starts `undefined` (llm.ts:338) so the trace frame omits the key entirely when the SDK emits no usage block.
  - Extended thinking (adaptive shape, no beta header): `useThinking = opts.extendedThinking === true && !model.includes("haiku")` (llm.ts:355-356) — Haiku is silently excluded from the whole `thinking` param, not just given `disabled` (`modelSupportsThinking`, llm.ts:357, gates whether the key is sent at all). When on, sends `thinking:{type:"adaptive"}` + `output_config:{effort:"low"}` via plain `client.messages.stream()`. When off (and non-Haiku), sends an EXPLICIT `thinking:{type:"disabled"}` rather than omitting the field, because Claude Sonnet 5/Opus 5 default adaptive thinking ON when the field is omitted entirely (llm.ts:359-379, 391-400). `max_tokens` is bumped to `Math.max(existing, 2048)` only when thinking is on, as shared thinking+answer headroom (llm.ts:383-390). Two distinct paths can leave the thinking phase unclosed, and both are handled: (1) a **thinking-only completion** — the model stops normally with no `text_delta` at all — is handled by the post-loop path, which emits `THINKING_END` right after the event loop ends if it hasn't already fired (llm.ts:503-515); (2) a **provider error thrown before any `text_delta`** is handled in the catch path, which closes the thinking phase with `THINKING_END` before a terminal apology or a fallback to a non-thinking model (Haiku), but deliberately leaves it open across a fallback to another thinking-capable model (llm.ts:566-585). In case (1) the client receives no answer and no trace frame (and `answerText` is not set on the span).
  - `thinking_delta` chunks stream live to the client, gated on `useThinking` as defense-in-depth against unsolicited provider-side reasoning (llm.ts:450-480); `THINKING_END` is emitted on the FIRST `text_delta` (llm.ts:483-490). Reasoning is deliberately absent from the trace frame (llm-trace.ts:54).
  - Every model-generated chunk (both `thinking_delta` and `text_delta`) passes `stripControlBytes` before it is enqueued (llm.ts:474, 494), so an anomalous completion cannot inject a byte that collides with the wire framing; `answerText` accumulates only the stripped `text_delta` bytes (llm.ts:496).
  - `ttftMs` is set on the first `text_delta` only (llm.ts:485) — thinking bytes do not count toward TTFT.
  - `safeOnAttempt` swallows any `onAttempt` throw (llm.ts:282-288); `close()` is idempotent via a `closed` latch (llm.ts:301-306).
- **Gotchas / invariants:**
  - The `LlmUsage` field names are **snake_case** and must stay so — `llm.test.ts` pins them (llm.ts:197-204 explains why). A future SDK returning camelCase would silently zero out token telemetry.
  - The trace frame is **additive by contract** (llm.ts:260-263): `splitTrace` in `use-chat.ts` `JSON.parse`s and spreads, so unknown keys are kept. Removing a key is the breaking change, not adding one.
  - `apologyTail` derives the contact address from `profile.email` (llm.ts:259) — do not hardcode it.
  - `AWS_REGION` must never be the primary region source (llm.ts:116-119).
  - `isFallbackEligible` is not imported by `llm.test.ts`; its behaviour is only covered indirectly through the `streamWithFallback` suites there.

### `src/lib/llm-trace.ts`

- **Role:** Client-safe chat-stream protocol constants, the control-byte scrubber and the `TraceFrame` shape, isolated so the browser bundle never pulls the Bedrock SDK.
- **Exports:** `TRACE_DELIMITER` = `U+001E` (RECORD SEPARATOR) — llm-trace.ts:23; `THINKING_SENTINEL` = `U+001E U+0001` — :24; `THINKING_END` = `U+001E U+0002` (STX) — :25; `stripControlBytes(text)` — :36-38, removes `/[\u001e\u0001\u0002]/g` (`CONTROL_BYTES_RE`, :34); `LlmUsage` (type) :40-45; `TraceFrame` (type) :47-55 = `{ model, fellBack, traceId?, usage?, ttftMs?, latencyMs? }`. Code points verified by hexdump (`036`, `036 001`, `036 002`).
- **Reads / depends on:** nothing (pure constants and one pure function).
- **Consumed by:** `src/lib/llm.ts:9` (constants + `stripControlBytes`), `src/lib/chat-cache.ts:5` (`stripControlBytes` before a cache write); `src/components/chat/use-chat.ts:8`.
- **Behaviour notes:** Wire layout (llm-trace.ts:6-9): `[THINKING_SENTINEL][reasoning][THINKING_END][answer][TRACE_DELIMITER][JSON]`, or `[answer][TRACE_DELIMITER][JSON]` without extended thinking.
- **Gotchas / invariants:** Non-printable chars are chosen so they can never collide with model prose. `llm-trace.test.ts` pins all three constants. Because `THINKING_SENTINEL`/`THINKING_END` both *start* with `TRACE_DELIMITER`, any naive `split(TRACE_DELIMITER)` on a thinking stream splits more than twice — the client must strip the sentinels first.

### `src/lib/llm-sdk-mode.ts`

- **Role:** Declares a build-time flag naming which Bedrock SDK `/api/chat` should instantiate.
- **Exports:** `LlmSdkMode` (type) = `"anthropic-bedrock" | "aws-sdk-bedrock"`; `getLlmSdkMode()`; `LLM_SDK_MODE` (const).
- **Reads / depends on:** `NEXT_PUBLIC_LLM_SDK`, read once at module load (llm-sdk-mode.ts:26). Resolution: exact match on either literal, else `DEFAULT_MODE = "anthropic-bedrock"` (llm-sdk-mode.ts:24, 28-29).
- **Consumed by:** **nothing at runtime.** Grep for `llm-sdk-mode` / `LLM_SDK_MODE` / `getLlmSdkMode` finds only the module itself and `llm-sdk-mode.test.ts`. `src/instrumentation.ts:76` snapshots the raw `NEXT_PUBLIC_LLM_SDK` env value directly, not via this module. `.env.example:161` documents it commented out.
- **Gotchas / invariants:** Per its own docstring (llm-sdk-mode.ts:13-15), the `aws-sdk-bedrock` branch is not implemented; flipping the flag today changes nothing because no caller reads it. Guarded by `llm-sdk-mode.test.ts` (pins the default and `getLlmSdkMode() === LLM_SDK_MODE` agreement).

### `src/lib/agent-trace.ts`

- **Role:** Hardcoded, deterministic multi-agent trace script for the glass-box demo, plus the approval flag that keeps the demo rendering dark until the prose is owner-approved.
- **Exports:** `PLACEHOLDER_SENTINEL` = `"[DRAFT — owner to approve]"` (agent-trace.ts:22); `AgentName` (type) = `"Researcher" | "Synthesizer" | "Presenter"`; `AGENTS` (record of label/role/color, agent-trace.ts:27-31); `AgentStep`, `Scenario` (types); `scenarios` (two scenarios, `"scaling-aava"` and `"event-driven"`, three steps each, agent-trace.ts:52-107); `allReferencedSlugs()`; `traceApproved` (boolean const); `linkForSlug(slug)`.
- **Reads / depends on:** `getProject`, `getWork` from `@/lib/content` (agent-trace.ts:1) — used only by `linkForSlug`.
- **Consumed by:** `src/components/game/glass-box-demo.tsx:8` (`AGENTS`, `scenarios`, `traceApproved`, `linkForSlug`); `src/components/game/use-trace-runner.ts:4` (`Scenario` type only).
- **Behaviour notes:** `traceApproved` is computed at module load — true only when no step's `action` or `output` contains `PLACEHOLDER_SENTINEL` (agent-trace.ts:120-122). Every step in the shipped file still carries the sentinel, so `traceApproved` is currently **false** and the demo renders dark. Agent colors are CSS custom properties (`var(--accent)`, `var(--violet)`, `var(--green)`), not hex. `AGENTS` colors and `ms` reveal delays (550–900) are the coordination-feel budget documented as ~400–1200/step, total < 8000 (agent-trace.ts:41).
- **Gotchas / invariants:** `agent-trace.test.ts` is the zero-fabrication gate: every `refs` slug must resolve to real content (`agent-trace.test.ts:20-28`), and the approval flag must agree with reality — `expect(traceApproved).toBe(!hasSentinel)` (`agent-trace.test.ts:56`), an assertion that passes in **both** states. Referenced slugs across scenarios: `aava-code`, `mindforge`, `pensieve`.
  The test does **not** block shipping — it is a consistency check — and the dark render is the *only* gate. The file's header banner says so (agent-trace.ts:13-16: "It does **NOT** block the build: while the sentinel remains, traceApproved is false and glass-box-demo.tsx renders NOTHING"), the `traceApproved` docblock says "NOT a hard build failure" (agent-trace.ts:118), and the Testing Notes section of `CLAUDE.md` agrees. Behaviour: the sentinel is still present, so `traceApproved === false` and `src/components/game/glass-box-demo.tsx:40` returns `null` — the demo ships dark and nothing is blocked.

### `src/lib/voice-catalog.ts`

- **Role:** The one static catalog of voices for all three TTS engines, plus lookups, the server-side allowlist validator, and engine-native parameter resolvers.
- **Exports:** types `VoiceEngine` (`"browser" | "polly" | "google"`, :24), `PollyTier` (`"neural" | "generative"`, :25), `VoiceGender`, `VoiceAccent` (`"us" | "gb" | "au" | "in"`, :27), `VoiceEntry`; data `CURATED_VOICES` (6, :134-141), `EXTENDED_VOICES` (12, :283-287), `ALL_VOICES` (18, :291-294); functions `getDefaultVoiceId`, `getVoiceById`, `getVoiceByPollyId`, `getVoiceByGoogleName`, `getVoicesForEngine`, `validateVoiceForEngine`, `resolvePollyParams`, `resolveGoogleVoiceName`, `findBrowserVoice`.
- **Reads / depends on:** nothing — pure data + Map lookups, no React, no I/O (voice-catalog.ts:16-21).
- **Consumed by:** `src/app/api/tts/route.ts:8`, `src/app/api/tts-google/route.ts:5`, `src/components/command-palette-content.tsx:60`, `src/components/chat/voice-picker.tsx:12`, `src/components/chat/use-speech-synthesis.ts:15`, `src/components/chat/voice-settings-dialog.tsx:19`, `src/components/chat/talk-mode.tsx:21`, `src/lib/voice-settings-context.tsx:4`.
- **Behaviour notes:**
  - Curated 6: Polly Neural `Joanna`, `Matthew`; Polly Generative `Stephen`, `Ruth`; Google Chirp3-HD `en-US-Chirp3-HD-Aoede`, `en-US-Chirp3-HD-Charon` (voice-catalog.ts:61-141).
  - Extended: 5 Polly Neural (`Danielle`, `Gregory`, `Brian` gb, `Amy` gb, `Olivia` au — :145-201), 3 Google Chirp3-HD (`Puck`, `Kore`, `Fenrir` — :203-234), 4 browser voices keyed by `voiceURI` prefix (`Microsoft Aria Online`, `Microsoft Guy Online`, `com.apple.voice.premium.en-US.Samantha`, `com.apple.voice.premium.en-US.Tom` — :239-280).
  - `getDefaultVoiceId(genderPref?)`: `"male"` → `polly-neural-matthew`; everything else (including `undefined`) → `polly-neural-joanna` (voice-catalog.ts:317-320).
  - `validateVoiceForEngine` (:350-367) is the server-side allowlist: unknown id → false; engine mismatch → false; for `polly`, a missing `pollyTier` → false, and an asserted tier that disagrees with the catalog → false (:364) because sending e.g. Joanna with `tier=generative` 5xxs at AWS.
  - `findBrowserVoice` (:389-397) matches on `voiceURI.startsWith(prefix)` — never on `voice.name`, because macOS localizes display names and Linux speech-dispatcher appends `+m1`/`+f1` modifiers (:50-52, "pitfall #14").
- **Gotchas / invariants:** Three lookup Maps are built at module load (`BY_ID` :298, `BY_POLLY_VOICE_ID` :300-305, `BY_GOOGLE_NAME` :307-312) — adding a voice to `CURATED_VOICES`/`EXTENDED_VOICES` is enough; adding one anywhere else leaves it un-lookupable and un-allowlisted. Catalog is build-time static (`as const` + `ReadonlyArray`) — a change requires a rebuild. `getVoiceById` returns `undefined` for unknown ids and callers MUST fall back to `getDefaultVoiceId()` rather than 500 (:322-323). `accent: "in"` is declared in the type but no entry uses it. Guarded by `voice-catalog.test.ts`.

### `src/lib/voice-settings-context.tsx`

- **Role:** Persisted voice preferences as a module-level external store, so a returning visitor's choices apply on the first client render without a flash of defaults.
- **Exports:** types `SttEngine` (`"browser" | "transcribe"`), `TtsEngine` (`"browser" | "polly" | "google"`), `TalkSurface` (`"modal" | "view"`), `VoiceCharacterSpeed/Tone/Pause`, `VoiceCharacter`, `VoiceSettings`; `DEFAULT_VOICE_CHARACTER`; `useVoiceSettings()` → `{ settings, set, toggle }`; and (for tests / non-React callers) `DEFAULTS`, `STORAGE_KEY`, `parse`, `__resetVoiceSettingsForTest`.
- **Reads / depends on:** `react` (`useCallback`, `useSyncExternalStore`), `getVoiceById` from `@/lib/voice-catalog`, `window.localStorage`. `"use client"` (:1).
- **Consumed by:** `src/components/command-palette-content.tsx:57`, and under `src/components/chat/`: `chat-messages.tsx:11`, `use-voice-session.ts:7`, `talk-launch-button.tsx:6`, `voice-settings-dialog.tsx:18`, `use-speech-synthesis.ts:20`, `talk-mode.tsx:20`, `wake-word-controller.tsx:6`, `mic-button.tsx:6`.
- **Behaviour notes:**
  - **Fail-closed defaults** (voice-settings-context.tsx:77-88): `micEnabled: false`, `ttsEnabled: false`, `wakeWord: false`, `captions: true` (a11y), `sttEngine: "browser"`, `ttsEngine: "browser"`, `talkSurface: "modal"`, `voiceId` intentionally omitted, `voiceCharacter: { speed: "natural", tone: "neutral", pause: "normal" }` (:71-75).
  - `STORAGE_KEY = "anvilry:voice:settings"` (:90).
  - `parse` validates field-by-field with type guards (:92-158), falling back to `DEFAULTS` per field so a partial/older payload upgrades rather than throwing; a `JSON.parse` throw returns `DEFAULTS` wholesale (:155-157).
  - **ttsEngine reconciliation** (:143-148): if a valid `voiceId` is stored, the engine is taken from the catalog entry, silently overriding a stored `ttsEngine` mismatch (a bug that existed in `talk-mode.tsx` v1.7).
  - `voiceId` bound: non-empty string under 64 chars (:117-118) — defense-in-depth against a pathological localStorage payload.
  - `getServerSnapshot` returns `DEFAULTS` (:191) so SSR HTML always matches "all off"; `ensureHydrated` reads localStorage exactly once, lazily, on the first client snapshot (:172-176). Writes are immutable (`{ ...current, ...patch }`, :196) and best-effort — a quota/private-mode throw is swallowed (:199-203).
- **Gotchas / invariants:** Toggles only **record intent** — availability is still gated at the point of use by runtime capability detection; a pref being "on" never overrides "this browser can't do it" (:20-23). `voiceId` staying `undefined` (rather than being defaulted at parse time) is load-bearing: it lets the catalog default resolve at point of use and lets a later picker choice take over cleanly (:150-152). `toggle` reads `current[key]` (module state), not the React snapshot (:222). Guarded by `voice-settings-context.test.ts`. Note: there is no `src/lib/voice-settings.ts` (a name older docs used); this `.tsx` module is the real store.

### `src/lib/voice-picker-mode.ts`

- **Role:** Build-time flag choosing the picker's layout.
- **Exports:** `VoicePickerMode` (type) = `"descriptor" | "gender"`; `getVoicePickerMode()`; `VOICE_PICKER_MODE`.
- **Reads / depends on:** `NEXT_PUBLIC_VOICE_PICKER_MODE`, read once at module load (:20). Resolution is asymmetric: only the exact string `"gender"` selects gender mode; everything else → `DEFAULT_MODE = "descriptor"` (:18, :22).
- **Consumed by:** `src/components/chat/voice-picker.tsx:13`.
- **Gotchas / invariants:** `NEXT_PUBLIC_` is inlined at build time — a redeploy is required to switch (:10-13). Both modes share the same catalog; only grouping/labeling differ. Guarded by `voice-picker-mode.test.ts`.

### `src/lib/rate-limit.ts`

- **Role:** Per-IP distributed rate limiter guarding the cost-bearing routes against bot-driven AWS spend, with one independent bucket per route class.
- **Exports:** `RateLimitClass` (type) = `"chat" | "voice" | "beacon"` (rate-limit.ts:19); `isRateLimitEnabled` (const boolean); `checkRateLimit(req, cls)` → `Promise<{ ok: true } | { ok: false; retryAfter: number }>`. `cls` is a required argument so a route can never silently share another class's bucket.
- **Reads / depends on:** `@upstash/ratelimit`, `./redis` (the shared singleton), `./cron-auth` (`hasValidCronSecret`). The only direct env read is `NODE_ENV` for the module-load production warning (rate-limit.ts:62); the Upstash vars are owned by `redis.ts` and `CRON_SECRET` by `cron-auth.ts`.
- **Consumed by** (class in parentheses): `src/app/api/chat/route.ts:6,188` (`"chat"`), `src/app/api/tts/route.ts:3,69` (`"voice"`), `src/app/api/tts-google/route.ts:1,67` (`"voice"`), `src/app/api/transcribe/route.ts:7,63` (`"voice"`), `src/app/api/error/route.ts:3,101` (`"beacon"`) — import line, then call site.

**Exact budget** (`REQUESTS_PER_WINDOW = 8`, `WINDOW = "60 s"`, rate-limit.ts:22-23; built per class in `buildLimiters`, rate-limit.ts:33-46):

```ts
limiter: Ratelimit.slidingWindow(REQUESTS_PER_WINDOW, WINDOW),
prefix: KEY_PREFIX[cls],
analytics: false,
```

**8 requests per 60-second sliding window, per derived client IP, per class.** Each class is its own Upstash `Ratelimit` with its own Redis key prefix (`KEY_PREFIX`, rate-limit.ts:25-29): `chat` → `anvilry:chat` (the original prefix, kept so live counters carry over), `voice` → `anvilry:voice`, `beacon` → `anvilry:beacon`. The `voice` bucket is shared by `/api/tts`, `/api/tts-google` and `/api/transcribe`; chat and error beacons no longer share a budget with them, so a per-sentence TTS burst or an error-beacon loop cannot 429 the visitor's own chat.

**Cron bypass.** A request carrying a valid `CRON_SECRET` bearer skips the limiter entirely (`if (hasValidCronSecret(req)) return { ok: true }`, rate-limit.ts:100): the eval cron fires 12 sequential chats and would otherwise self-throttle against the 8/min budget. A wrong secret still hits the limiter, and an unset `CRON_SECRET` never bypasses (see `cron-auth.ts`).

**Fail-open behaviour**, two distinct paths:

1. **Not configured** — `limiters` is `null` when `redis` is `null`, and `checkRateLimit` returns `{ ok: true }` immediately: `if (!limiters) return { ok: true }; // not configured -> fail open` (rate-limit.ts:99).
2. **Configured but erroring** — any throw from `limiters[cls].limit()` (Upstash unreachable/timeout/5xx) is caught and downgraded to a warn + allow (rate-limit.ts:106-109):

```ts
} catch (err) {
  console.warn(`[rate-limit] check failed, failing open: ${(err as Error)?.name ?? "error"}`);
  return { ok: true };
}
```

The rationale (docblock above `checkRateLimit`, rate-limit.ts:90-93): a cost guard must never be a single point of failure for the feature it protects — going down should degrade to "no limit", not "no chat".

- **Behaviour notes:**
  - A **loud module-load warning** fires when unconfigured in production (rate-limit.ts:62-68), naming `/api/chat`, `/api/tts`, `/api/transcribe` as unprotected (it does not name `/api/tts-google` or `/api/error`, which are equally unprotected in that state). Local dev stays quiet.
  - `retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))` (rate-limit.ts:104).
  - **IP derivation is a security control** (`clientIp`, rate-limit.ts:74-80): `x-vercel-forwarded-for` FIRST segment (platform-set, unspoofable) → else `x-forwarded-for` **LAST** segment → else `x-real-ip` → else `"anonymous"`. Taking the last XFF segment rather than the first is what prevents rate-limit bypass via rotating spoofed headers (docblock at rate-limit.ts:70-73).
- **Gotchas / invariants:** Buckets are independent per class but **shared within a class** (all three `voice` routes draw from one budget). `clientIp` is duplicated on purpose in `telemetry/with-trace.ts:63` and `src/app/api/visit/route.ts:25` (see that entry); a fix to one must be mirrored — and that mirroring is *enforced*: `src/lib/client-ip-consistency.test.ts` discovers every `clientIp` definition under `src/` and fails on an unreviewed copy, then asserts each copy reads `x-vercel-forwarded-for` before `x-forwarded-for` and resolves XFF with a reviewed **last**-segment form. `rate-limit.test.ts` covers module-load configuration (one limiter per class with separate prefixes), the happy path, IP precedence, fail-open, per-class isolation and the cron bypass. The comment above `clientIp` in `with-trace.ts` still points at the pre-fix location of `clientIp` in `rate-limit.ts` (lines 48-53; it is now at 74-80).

### `src/lib/redis.ts`

- **Role:** The single Upstash Redis client, shared by rate limiting, telemetry emit, the FAQ cache, cron routes, visit/error tracking, and the admin dashboard.
- **Exports:** `redis: Redis | null`; `isRedisConfigured(): boolean`.
- **Reads / depends on:** `@upstash/redis`; env `UPSTASH_REDIS_REST_URL` (:26) and `UPSTASH_REDIS_REST_TOKEN` (:27). Client constructed only when both are present (:36).
- **Consumed by:** `src/lib/rate-limit.ts:3`, `src/lib/telemetry/emit.ts:1`, `src/lib/chat-cache.ts:2`, `src/instrumentation.ts:95` (dynamic import; stamps the corpus build tag), `src/app/admin/telemetry/page.tsx:16`, `src/app/api/visit/route.ts:2`, `src/app/api/error/route.ts:7`, and the five cron routes (`content-audit`, `github-sync`, `seo-audit`, `health-check`, `eval`).
- **Behaviour notes:** Construction is wrapped in try/catch (:35-39) because the SDK throws a **synchronous `UrlError`** for an invalid URL scheme (`redis://`, bare hostname, trailing newline from env injection); without the guard a malformed `UPSTASH_REDIS_REST_URL` would crash every API route cold start, since this module is transitively imported by `rate-limit.ts`, `emit.ts`, and `with-trace.ts` (:29-33). On that failure it logs `[redis] Invalid Upstash configuration` and leaves `redis` null.
- **Gotchas / invariants:** Deliberately does **not** throw on missing creds — a hard throw here would kill `next build` on any environment without Upstash creds at build time (:21-23). The all-or-nothing posture is intentional: either every Redis-backed feature is configured or none are, "no half-on state" (:15-16). Every caller MUST null-guard.

### `src/lib/admin-auth.ts`

- **Role:** The one HTTP Basic credential check for the admin surface, applied at three call sites: the proxy, route handlers (`requireAdmin`), and the telemetry page.
- **Exports:** `isAdminAuthorized(header: string | null): boolean` (admin-auth.ts:24); `requireAdmin(req)` → `{ ok: true } | Response` (:48).
- **Reads / depends on:** `node:crypto` (`timingSafeEqual`, `createHash`); env `ADMIN_PASSWORD` (:25).
- **Consumed by:** `src/proxy.ts:4,26` (first-filter gate for `/admin/:path*`, matcher config at `src/proxy.ts:21`); `src/app/admin/telemetry/page.tsx:472` (re-checks the `Authorization` header itself and calls `notFound()` when unauthorized, so the proxy is the first filter, not the only gate); `requireAdmin` by `src/app/api/admin/faq-cache/purge/route.ts:32`. Next 16 proxies run on the Node.js runtime, so the proxy imports `node:crypto`-based code directly — there is no separate Edge re-implementation any more.
- **Behaviour notes:**
  - `ADMIN_PASSWORD` unset → **deny everything** and `console.warn` without leaking the reason to the client (:25-31). The comment says "log once" but nothing dedupes it, so it warns on every call. There is no default password.
  - Requires an `Authorization: Basic …` prefix (:33), base64-decodes (:37), and accepts both `password` (no colon) and `anything:password` forms so `curl -u admin:pw` and `-u :pw` both work (:41). With a colon, everything after the FIRST colon is the password (`split(":").slice(1).join(":")`), so colons in passwords survive.
  - `constantTimeEqual` (:55-59) SHA-256s both sides and `timingSafeEqual`s the digests — the hash is what makes the buffers equal-length, dodging `timingSafeEqual`'s throw-on-length-mismatch.
  - `unauthorized()` (:61-69) returns 401 with `WWW-Authenticate: Basic realm="anvilry"` and `Cache-Control: no-store`.
- **Gotchas / invariants:** Do not "optimize" `constantTimeEqual` back to `===`. The purge route lives under `/api/admin`, which the proxy matcher (`/admin/:path*`) does **not** cover, so it relies solely on `requireAdmin` (it is deliberately not rate-limited either). Guarded by `admin-auth.test.ts`.

### `src/lib/cron-auth.ts`

- **Role:** Fail-closed bearer check for Vercel cron invocations.
- **Exports:** `hasValidCronSecret(req)` (cron-auth.ts:15); `unauthorizedUnlessCron(req)` → `Response | null` (:23) — `null` when authorised, else the standard 401 JSON every cron route returns.
- **Reads / depends on:** `node:crypto`; env `CRON_SECRET` (:16).
- **Consumed by:** `src/lib/rate-limit.ts` (`checkRateLimit` bypass); `unauthorizedUnlessCron` by all five cron routes (`content-audit`, `eval`, `github-sync`, `health-check`, `seo-audit`).
- **Behaviour notes:** An unset/empty `CRON_SECRET`, or a missing `Authorization` header, never authorises (:18). Both the header and `Bearer ${secret}` are hashed with SHA-256 before `timingSafeEqual`, so the compare is constant-time and length-independent (:3-6, :19).
- **Gotchas / invariants:** Guarded by `cron-auth.test.ts`. The eval cron forwards the same header on its internal `/api/chat` calls so the rate-limit bypass applies.

### `src/lib/chat-cache.ts`

- **Role:** Upstash-backed full-response cache for first-turn `/api/chat` questions — an exact tier (SHA-256 of the normalized question) plus an optional semantic tier — so repeated FAQs skip Bedrock.
- **Exports:** types `FaqCacheEntry`, `FaqCacheHit`, `FaqCachePurgeResult`; constants `FAQ_CACHE_TTL_SECONDS` (24 * 60 * 60, :63), `FAQ_CACHE_INDEX_CAP` (500, :66), `TRIM_SAMPLE_EVERY` (20, :72), `MAX_CACHEABLE_ANSWER_CHARS` (4000, :79); functions `normalizeQuestion`, `faqCacheKey`, `isSemanticMatchEnabled`, `isFaqCacheEnabled`, `faqCacheGet`, `faqCacheSemanticGet`, `faqCacheSet(question, answer, model, costUsd, finishReason)`, `faqCachePurge`.
- **Reads / depends on:** `@/lib/redis`, `@/lib/telemetry/emit` and `redact` (for `server.error` events on cache failures), `stripControlBytes` from `@/lib/llm-trace`, and `./faq-embeddings` via dynamic `import()` (semantic tier only). Env: `FAQ_CACHE_ENABLED` (kill switch, default on; `!== "false"`, :130) and `FAQ_CACHE_SEMANTIC_MATCH` (`=== "true"`, :122).
- **Consumed by:** `src/app/api/chat/route.ts` (read at :336-337, skipped when the request carries `x-chat-skip-cache`, which the eval cron sends, :322, write-through via `void faqCacheSet(...)` from the `onAttempt` handler, `chat.cache` telemetry emitted per lookup); `src/app/api/admin/faq-cache/purge/route.ts` (`faqCachePurge`).
- **Behaviour notes:**
  - Redis keys: entries at `anvilry:chat:cache:<sha256 hex>` (`ENTRY_PREFIX`, :52), a sorted-set index `anvilry:chat:cache:index` (`INDEX_KEY`, :53, score = `cachedAt`), and the corpus tag `anvilry:corpus:built_at` (`CORPUS_BUILT_AT_KEY`, :54). No raw question text is stored; the key is derived from `normalizeQuestion` (lowercase, trim, collapse whitespace, strip trailing `? ! . , ; :` via a linear loop, not a regex).
  - **Corpus tagging.** Each entry records `corpusBuiltAt`; a lookup is a hit only if it equals the current tag, and "both null" counts as a match (`isSameCorpusBuild`, :148-156). The tag is stamped by `src/instrumentation.ts` (`redis.set("anvilry:corpus:built_at", Date.now()…, { ex: 7 * 24 * 3600 })`, production deploys only) and shown on `/admin/telemetry`.
  - `faqCacheGet` fetches the entry and the corpus tag in one `MGET` (:200-202), billed as a single Upstash command.
  - **Write gate** (`faqCacheSet`): only `finishReason === "end_turn"` (:278), answer passed through `stripControlBytes` + `trim`, length 1..4000 (:280-282). `SET … ex 86400` then `ZADD` to the index (:297-298); on `cachedAt % TRIM_SAMPLE_EVERY === 0` it trims by score (older than the TTL) and by rank (`-(FAQ_CACHE_INDEX_CAP + 1)`) (:305-312).
  - **Semantic tier** (`faqCacheSemanticGet`): no-op unless `FAQ_CACHE_SEMANTIC_MATCH=true`. Embeds the normalized question, `ZRANGE`s the whole index, one `MGET` of every entry, then picks the best cosine similarity at or above `SIMILARITY_THRESHOLD = 0.92` (:223) among entries that carry an embedding and match the current corpus tag. The embedding is written back to the entry after the base write, only if `cachedAt` still matches (:318-341), so the base exact-match write is never blocked by it.
  - **Purge** (`faqCachePurge`, :368-388): `DEL` + `ZREM`; returns `purged`, `not_found` (still success, idempotent) or `error` (route maps it to 503). Deliberately not gated on `isFaqCacheEnabled()`.
  - Redis failures in `faqCacheGet`, `faqCacheSemanticGet`, `faqCacheSet` and `faqCachePurge` are swallowed and reported through `emitCacheError` (:163-181) as a `server.error` event with `attrs.source = "chat-cache"`. Two paths are not: a corpus-tag read failure (`getCurrentCorpusBuildTag`, :139-146) silently yields `null`, and a failed embedding write-back only `console.warn`s (:342-348). The cache fails open to a miss.
- **Gotchas / invariants:** The gate checks completion integrity, not content safety — a jailbreak that finishes with `end_turn` would be cached, bounded by the 24 h TTL, corpus tagging and the admin purge route. Both index trims run only when `cachedAt % 20 === 0` (sampled deterministically off the millisecond timestamp, not a counter), so trim frequency is uneven and stale index members can linger (the semantic scan skips `null` MGET results). The semantic write-back has a residual GET-then-SET race: a purge landing between the check and the `SET` can resurrect the entry. Guarded by `chat-cache.test.ts`.

### `src/lib/faq-embeddings.ts`

- **Role:** Embedding helper for the semantic cache tier.
- **Exports:** `embedText(text): Promise<number[] | null>` (:32); `cosineSimilarity(a, b)` (:72, pure; returns 0 for mismatched lengths, empty vectors or a zero denominator).
- **Reads / depends on:** `@aws-sdk/client-bedrock-runtime` (`BedrockRuntimeClient`, `InvokeModelCommand`) and `bedrockCreds()` from `@/lib/llm`.
- **Consumed by:** `src/lib/chat-cache.ts` only, through dynamic import.
- **Behaviour notes:** Uses raw Bedrock `InvokeModel` (not `makeClient()`, which is the Anthropic SDK) with `modelId = "amazon.titan-embed-text-v2:0"`, `dimensions: 512`, `normalize: true` (:20-21, :48-55). The call is bounded by `AbortSignal.timeout(EMBED_TIMEOUT_MS)` with `EMBED_TIMEOUT_MS = 5_000` (:28, :57) because the AWS SDK's default request timeout is disabled. A new `BedrockRuntimeClient` is constructed on every call.
- **Gotchas / invariants:** Never throws — any failure or missing credentials returns `null`, and the semantic tier degrades to a miss. Guarded by `faq-embeddings.test.ts`.

### `src/lib/telemetry/schema.ts`

- **Role:** The type-level contract every telemetry producer and consumer imports: envelope schema, PII redaction, salted IP hashing. Pure data — no I/O, no globals, no clock reads (:20-23).
- **Exports:** `KIND_LITERALS`, `KindLiteral`, `TelemetryEventSchema`, `TelemetryEvent`, `redact(text)`, `hashIp(ip, salt)`.
- **Reads / depends on:** `node:crypto` (`createHash`), `zod`. Reads no env itself — the salt is passed in by the caller.
- **Consumed by:** `src/lib/telemetry/with-trace.ts:3` (`hashIp`, `redact`, types); `src/app/admin/telemetry/page.tsx:17` (`KIND_LITERALS`, `TelemetryEvent`); `redact` in `src/lib/chat-cache.ts:4` and `src/app/api/chat/route.ts:9`, `api/tts/route.ts:11`, `api/tts-google/route.ts:8`, `api/transcribe/route.ts:10`, `api/error/route.ts:6`.

**Event schema** (`TelemetryEventSchema`, schema.ts:71-81). Envelope fields, with per-kind detail pushed into `attrs`:

| Field | Type | Required | Cite |
|---|---|---|---|
| `ts` | non-negative int (epoch ms) | yes | :72 |
| `traceId` | string, min 1 | yes | :73 |
| `spanId` | string, min 1 | yes | :74 |
| `parentSpanId` | string, min 1 | optional | :75 |
| `kind` | enum of `KIND_LITERALS` | yes | :76 |
| `route` | string, min 1 | optional | :77 |
| `level` | `"info" \| "warn" \| "error"` | yes | :78 (literals at :56) |
| `message` | string | optional | :79 |
| `attrs` | `z.record(z.unknown())` — opaque | yes | :80 |

The 8 `kind` literals (`KIND_LITERALS`, schema.ts:37-50): `http.request`, `llm.attempt`, `tts.request`, `transcribe.request`, `client.error`, `server.error`, `budget.tick`, `chat.cache`. `chat.cache` is the FAQ-cache hit/miss span, deliberately separate from `llm.attempt` because a cache hit has zero real LLM usage and would corrupt the dashboard's cache-hit-rate and cost tiles; the route emits it per cache lookup with `attrs.outcome`/`tier` (plus `saved_usd`/`model` on a hit and `similarity` on a semantic hit). `chat-cache.ts` itself emits `server.error` (not `chat.cache`) when a Redis operation fails.

- **Behaviour notes:**
  - `attrs` is loose on purpose (:13-18): each emit site knows its own kind's shape; tightening into a discriminated union here would couple the schema to every caller.
  - `redact` order is **load-bearing** (:101-110): `EMAIL_RE` (:88) first so `user@example.com` becomes `[email]` before the local part can match the token regex; then `TOKEN_RE` = `\b[A-Za-z0-9_-]{32,}\b` → `[redacted-token]` (:93); then `DIGIT_RUN_RE` = `\b\d{12,19}\b` → `[redacted-num]` (:98). The 32-char token floor is chosen so UUIDs and trace ids are not scrubbed (:90-92).
  - `hashIp(ip, salt)` (:129-135) returns the literal `"anonymous"` when the salt is falsy OR the ip is empty/already `"anonymous"`; otherwise `sha256(salt + ip)` truncated to **16 hex chars** (~64 bits).
- **Gotchas / invariants:** Adding a `kind` requires updating `KIND_LITERALS` **and** the dashboard's kind filter (:35-36) — the union is what makes the orphan a type error. No-salt → no fingerprinting, by design (:30-32). Guarded by `schema.test.ts` (accept/reject/redact suites; pins the eight kinds).

### `src/lib/telemetry/emit.ts`

- **Role:** The dual-sink, fire-and-forget telemetry writer.
- **Exports:** `emit(event: TelemetryEvent): void`.
- **Reads / depends on:** `redis` from `@/lib/redis`; `TelemetryEvent` type. No env reads.
- **Consumed by:** `src/lib/telemetry/with-trace.ts:2`; `src/lib/chat-cache.ts:3` (`server.error` on cache failures); directly by `src/app/api/chat/route.ts:8`, `api/tts/route.ts:10`, `api/tts-google/route.ts:7`, `api/transcribe/route.ts:9`, `api/error/route.ts:5`.

**Both sinks:**

1. **Vercel Runtime Logs — always, and the declared SOURCE OF TRUTH** (emit.ts:61): `console.log("[trace]", JSON.stringify(event))`. The `[trace]` prefix is the documented grep handle (`vercel logs | grep '\[trace\]'` → jq). Wrapped in try/catch anyway so a throwing custom `console.log` can't take the request down (:60-65) — and crucially it does **not** early-return on that failure, so sink 2 still runs.
2. **Upstash Redis sorted set — best-effort decoration** (emit.ts:67-94). Guarded by `if (!redis) return` (emit.ts:68). One sorted set **per kind**: key `anvilry:trace:${event.kind}` (:70), `ZADD` with `score: event.ts` and the JSON event as the member (:76-77), plus a `ZREMRANGEBYSCORE key 0 cutoff` (:86-87) that runs on a sampled subset of calls.

**Retention: 7 days.** `SEVEN_DAYS_MS = 7 * 86_400_000` (emit.ts:42); `cutoff = event.ts - SEVEN_DAYS_MS` (:72). The window is deliberate — long enough to debug a stale prod incident, short enough for the Upstash free tier (header comment, :12-19). Trimming is *piggybacked on writes* and **sampled 1-in-20**: `TRIM_SAMPLE_EVERY = 20` (:54), gate `event.ts % TRIM_SAMPLE_EVERY === 0` (:85). The sample is stateless — derived from the millisecond timestamp rather than a counter or `Math.random()` — because a per-request trim cost (2-4 `emit()` calls per `/api/chat` request) was a measured contributor to exhausting Upstash's free-tier command quota. A kind that stops receiving events is never trimmed again.

- **Behaviour notes:** `emit` returns `void`, **not** `Promise<void>`, even though ZADD is async (:22-28) — awaiting would couple request latency to Upstash availability. Both Redis promises get explicit `.catch()` handlers that log `[telemetry] redis sink failed: <err.name>` (:78-83, :88-93); without them the un-awaited rejections would surface as runtime process warnings (:74-75).
- **Gotchas / invariants:** `emit` does **no redaction** — the caller must redact before calling, because only the call site knows what's PII-safe for its kind (:30-35). "Garbage in → garbage stored." Per-kind keys keep dashboard reads cheap (only the `llm.attempt` set is pulled, not the firehose). Guarded by `emit.test.ts` (uses the `vi.hoisted` + `vi.mock` pattern to stub the `@/lib/redis` singleton at the import boundary, :37-39).

### `src/lib/telemetry/with-trace.ts`

- **Role:** The universal `/api/*` observability wrapper: one request = one traceId, exactly one emitted span, response header stamped, errors observed and re-thrown.
- **Exports:** `TraceCtx` (type); `withTrace(req, route, handler)`.
- **Reads / depends on:** `node:crypto` (`createHash`), `emit`, `hashIp`/`redact`/types from schema, and a **lazy `require("next/server")`** for `after` (:11). Env: `TELEMETRY_IP_SALT` (:157).
- **Consumed by:** `src/app/api/chat/route.ts:7`, `api/tts/route.ts:9`, `api/tts-google/route.ts:6`, `api/transcribe/route.ts:8`, `api/error/route.ts:4`.

**The wrapper contract:**

| Guarantee | Mechanism | Cite |
|---|---|---|
| One traceId per request | `crypto.randomUUID()`, with a `Date.now()-Math.random()` fallback for runtimes lacking it | :148-155 |
| Propagated to the client | `x-anvilry-trace-id` header set on a reconstructed Response | :207 |
| Exactly ONE span | `http.request` on any returned Response, `server.error` on an uncaught throw | :214-221, :231-243 |
| Never swallows | the error is re-thrown after emission — "withTrace is an OBSERVER; never a SWALLOWER" | :244-246 |
| Never blocks | `afterSafeEmit` schedules via `next/server`'s `after` so emission happens post-stream (zero TTFB cost), falling back to synchronous emit when `after` throws (outside request scope / tests) | :7-17, :212-213 |
| Never throws into the route | `safeEmit` swallows sync throws and, defensively, any returned thenable | :95-106 |
| Route can enrich | `ctx.attrs(extra)` merges into the auto span (`extraAttrs = { ...extraAttrs, ...extra }` — immutable per-call) | :171-173 |
| Streaming preserved | Response reconstructed as `new Response(res.body, { status, statusText, headers })` — the body stream is passed through, never buffered | :200-206 |
| 5xx auto-escalates | `level = res.status >= 500 ? "error" : "info"` | :211 |

Every emitted event carries `attrs: { ipHash, uaHash, ...attrs }` plus `latency_ms` and `session_id` (:191, :216-219). Envelope `ts` is `startedAt` (request start), not emit time (:185).

- **Behaviour notes:**
  - `clientIp` (:63-73) is **duplicated verbatim** from `rate-limit.ts` rather than shared — deliberate, so observability and the cost guard stay independently swappable (:56-62). Same precedence: `x-vercel-forwarded-for` first segment → `x-forwarded-for` LAST segment → `x-real-ip` → `"anonymous"`.
  - `uaHash` is `hashIp(user-agent, salt)` — the same helper reused on the UA string (:159).
  - `sessionId` (:115-126): first 12 hex of `sha256(ipHash + ":" + uaHash + ":" + "YYYY-MM-DD")`; returns `"anonymous"` with no salt. The date component means sessions roll at UTC midnight.
  - `awsRequestIdOf` (:82-88) lifts `err.$metadata.requestId` (AWS SDK v3 shape) into `attrs.err.awsRequestId` so one trace id correlates Vercel logs ↔ CloudWatch ↔ an AWS ticket. Absent (not null) for non-AWS errors.
  - Error attrs pass both `message` and `stack` through `redact` (:237-238).
  - Chosen over a proxy/middleware layer because a Next 16 Proxy (Node runtime by default) runs before the route and never sees the response body or the route's own errors, and cannot enrich the span without a second roundtrip (header comment, :28-33). No route exports `runtime` (the export is rejected under `cacheComponents: true`), so the cost-bearing routes run on Next's default Node.js runtime.
- **Gotchas / invariants:** The `require("next/server")` is intentional (an ESM `import` would force test suites to stub `next/server`); the eslint disable at :10 is load-bearing. `safeEmit`'s thenable branch (:98-101) is currently dead code — `emit` returns `void` — but is the guard if `emit`'s signature ever becomes async. Reconstructing the Response is required because headers on `Response.json(...)` are guarded/immutable in some runtimes (:35-40). Guarded by `with-trace.test.ts`.

### `src/lib/telemetry/beacon.ts`

- **Role:** The ONE client-side egress for browser errors — every React boundary, window listener, and unhandledrejection funnels through it.
- **Exports:** `ErrorBeaconPayload` (type); `sendErrorBeacon(payload): void`.
- **Reads / depends on:** `navigator.sendBeacon`, `fetch`, `Blob`. No imports, no env.
- **Consumed by:** dynamically imported (never statically) at `src/instrumentation-client.ts:59`, `src/app/error.tsx:64`, `src/app/global-error.tsx:57`. The server counterpart `src/app/api/error/route.ts` documents this module as its load-bearing client contract (header comment and payload schema) and rate-limits it in its own `beacon` bucket.
- **Behaviour notes:**
  - `BEACON_URL = "/api/error"` — hard-coded, not env-configurable, because CSP `connect-src 'self'` would block any other origin and a configurable value would be a footgun (:46-52).
  - Payload `source` enum (:42): `"boundary" | "global-boundary" | "window" | "unhandledrejection" | "react19"`; optional `level: "error" | "warn"`, `stack`, `url`, `userAgent`, `componentStack`.
  - SSR bail: returns early if `window` or `navigator` is undefined (:69).
  - Primary path is `sendBeacon` with the body wrapped in a `Blob` of type `application/json` (:72, :77-80) — `sendBeacon` defaults to `text/plain` and refuses `application/*` unless the payload is a Blob. `sendBeacon` is preferred over `fetch` because it survives `pagehide`/`unload`, which is exactly when a fatal error happens (:12-17).
  - Fallback is `fetch(..., { keepalive: true })`, `void`-ed and with a `.catch()` (:88-95). The `.catch` is required: an unhandled rejection would re-fire `window.addEventListener("unhandledrejection")` and recurse straight back into this function (:85-87).
  - Outer try/catch swallows everything (:96-98).
- **Gotchas / invariants:** Returns `void` deliberately — callers live in synchronous render/event paths where a Promise would invite unhandled-rejection recursion (:60-63). A `sendBeacon` returning `false` (queue full) falls through to fetch rather than returning. Guarded by `beacon.dom.test.ts` (happy-dom project).

### `src/lib/scroll/*` — the two stick-to-bottom implementations

**Why both exist.** They are a live A/B "bake-off" between build and buy, running behind a runtime flag with a shared type contract, so the measured winner can become the default with no call-site change (types.ts:2-9, scroll-flags.tsx:20). `ScrollMetric` (types.ts:15-26) is the dev-only comparison instrument: `missedBottomPx`, `falseDepin`, `snapLatencyMs`, tagged with `surface` and `engine`.

**The flag that chooses between them:** `ScrollEngine` = `"custom" | "library"` (types.ts:11), resolved by `useScrollEngine()` and consumed at `use-auto-scroll.ts:21`. Precedence (resolve-flag.ts:4-8): `?scroll=` URL param > `localStorage["anvilry.scroll.engine"]` > default. **`DEFAULT_ENGINE = "custom"`** (scroll-flags.tsx:21) — the in-repo engine is what ships today. A second, orthogonal flag `ScrollMode` = `"bottom-pin" | "message-top"` uses `?scrollmode=` / `localStorage["anvilry.scroll.mode"]`, default `"bottom-pin"` (scroll-flags.tsx:22, :25). Invalid values at any layer are skipped and the next layer consulted, so a hand-typed bad param cannot wedge the UI (resolve-flag.ts:10-11, 13-15).

#### `src/lib/scroll/use-auto-scroll.ts`
- **Role:** Engine-agnostic entry point.
- **Exports:** `useAutoScroll(opts?)` → `UseAutoScroll`.
- **Consumed by:** `src/components/ask-portfolio.tsx:13`, `src/components/chat/chat-messages.tsx:12`, `src/components/game/terminal/terminal.tsx:7`.
- **Behaviour notes:** BOTH engine hooks are called unconditionally every render (:25-29) — required by the rules of hooks — and each is handed `enabled: callerEnabled && engine === "<its own>"` so the inactive engine attaches no observers/listeners (:24-29). The return is `engine === "library" ? library : custom` (:30), i.e. `custom` is the else-branch default.
- **Gotchas / invariants:** Do not make either hook call conditional. `chat-messages.tsx:383` destructures `anchorRef`, which only the custom engine provides — under `?scroll=library` it is `undefined` (see below).

#### `src/lib/scroll/use-stick-to-bottom-custom.ts`
- **Role:** The in-repo engine — intent-flag + ResizeObserver + programmatic-guard design.
- **Exports:** `useStickToBottomCustom(opts?)`.
- **Behaviour notes:**
  - Fixes two named failure modes of a naive per-frame distance check (:6-16): **DE-PIN TRAP** — follow is gated on a persisted intent flag `pinnedRef` (:53) written ONLY by genuine user scrolls, so content growth never re-evaluates the threshold; **STALE HEIGHT** — a `ResizeObserver` on the inner content wrapper drives the snap so it fires when `dynamic(ssr:false)` markdown finally paints, which a `[messages]`-dep effect cannot see.
  - Magic values: `PROGRAMMATIC_WINDOW_MS = 150` (:29), `MESSAGE_TOP_OFFSET_PX = 12` (:30), default `threshold = 120` px (:33).
  - `snap()` (:61-93) stamps `performance.now()` before writing `scrollTop`; in `message-top` mode it targets `anchor.offsetTop - 12` clamped to `[0, scrollHeight - clientHeight]` (:73-74), else `scrollTop = scrollHeight` (:76). It then sets `isAtBottom` true directly (:81) because the resulting scroll event falls inside the guard window.
  - `handleScroll` (:103-112) is the ONLY place intent changes: it returns early if `now - programmaticScrollAtRef.current < 150` (:108), then sets `pinnedRef = dist <= threshold` (:110) and `isAtBottom = dist <= 1` (:111). Two different thresholds — 120px for re-pin intent, 1px for the geometric jump-button state.
  - `handleResize` (:116-126) follows only if `grew && pinnedRef.current`; `grew` is `height >= lastHeightRef.current` (`>=`, so an unchanged height still counts as growth). The snap is deferred through `requestAnimationFrame` (:125) to dodge the "ResizeObserver loop" warning and read true post-layout height.
  - React 19 callback refs with cleanup (:130-160): `scrollRef` attaches a `{ passive: true }` scroll listener; `contentRef` constructs the `ResizeObserver` (skipped entirely when `ResizeObserver` is undefined, :148) and re-arms `lastHeightRef = 0` so the first observe-snap fires (:149).
  - `anchorRef` (:158-160) is a plain setter ref for the newest user message.
  - Live config is mirrored into a single `cfg` ref in an effect (:47-49) so handler identities stay stable and listeners never re-attach; it is never written during render (React 19 ref discipline, :37-39).
- **Gotchas / invariants:** `pinnedRef` is the load-bearing flag (:53) — routing content-growth through the threshold check would reintroduce the de-pin trap. The `message-top` `offsetTop` math assumes the content wrapper is normally positioned inside the scroller (:70-72); a `position: relative` intermediate would break it. Guarded by `use-stick-to-bottom-custom.dom.test.tsx` (7 assertions, happy-dom).

#### `src/lib/scroll/use-stick-to-bottom-library.ts`
- **Role:** Adapter over the `use-stick-to-bottom` npm package (`^1.1.6`).
- **Exports:** `useStickToBottomLibrary(opts?)`.
- **Behaviour notes:** Configured `{ resize: "instant", initial: "instant" }` (:23) — the library's velocity-spring smooth follow is deliberately opted out of, because a per-token chase animation lags behind the stream (:14-17). `scrollRef`/`contentRef` are wrapped so a disabled engine attaches nothing (:28-33). The library owns user-vs-programmatic discrimination, ResizeObserver, and scroll anchoring internally — which is exactly the surface being A/B'd.
- **Gotchas / invariants:** **`message-top` mode is NOT supported here** and no `anchorRef` is returned (:18-20, :25-38) — the adapter silently behaves as bottom-pin. The bake-off therefore only compares engines on bottom-pin. Guarded by `use-stick-to-bottom-library.dom.test.tsx` (4 assertions).

#### `src/lib/scroll/scroll-flags.tsx`
- **Role:** The runtime flag store + the mount-time URL/localStorage reader.
- **Exports:** `setScrollEngine`, `setScrollMode`, `ScrollFlagsSync`, `useScrollEngine`, `useScrollMode`, `ENGINES`, `MODES`, `DEFAULT_ENGINE`, `DEFAULT_MODE`.
- **Consumed by:** `src/components/providers.tsx:7`, mounted as `<ScrollFlagsSync>{children}</ScrollFlagsSync>` at `providers.tsx:55`. `useScrollEngine` is consumed by `use-auto-scroll.ts:3`.
- **Behaviour notes:** Snapshots are **cached** (`snapshot` :35, `SERVER_SNAPSHOT` :36) and only replaced inside `emit()` (:38-41) because `useSyncExternalStore` compares by identity — returning a fresh object per call warns ("should be cached to avoid an infinite loop") and re-renders forever (:31-34). `getServerSnapshot` returns the constant defaults (:49) so SSR HTML matches; the persisted/URL value is applied AFTER mount (:13-15). `readStored`/`writeStored` swallow storage exceptions (private mode) (:51-67). `ScrollFlagsReader` (:107-113) is `Suspense`-wrapped in a leaf because `useSearchParams` forces client rendering up to the nearest boundary on a prerendered route (:102-105); it renders `null`.
- **Gotchas / invariants:** `setScrollEngine`/`setScrollMode` early-return on an unchanged value (:70, :77) so no spurious emit fires. These are described as dev/bake-off conveniences, **not** user-facing settings (:15).

#### `src/lib/scroll/types.ts` / `src/lib/scroll/resolve-flag.ts`
- `types.ts` is type-only and imported by all four scroll implementation files (no runtime output). `UseAutoScroll` (:47-63) is the shared contract: `scrollRef`, `contentRef`, `isAtBottom`, `scrollToBottom`, and optional `anchorRef`. `UseAutoScrollOptions` (:28-41) documents the per-surface thresholds — chat ~120, terminal ~32 (:30) — and `enabled` (the floating widget passes `open`).
- `resolve-flag.ts` exports the generic `resolveFlag(allowed, { param, stored, fallback })` (:12-21), extracted from the React store purely so it is unit-testable in the fast node environment (:1-2). Guarded by `resolve-flag.test.ts` (4 assertions). It has no importer other than `scroll-flags.tsx:5`.

### `src/lib/use-media-query.ts`

- **Role:** SSR-safe media-query subscription, plus a memoized WebGL capability probe used to decide whether to mount an R3F Canvas at all.
- **Exports:** `useMediaQuery(query)`; `useWebGLSupported()`.
- **Reads / depends on:** `react` (`useSyncExternalStore`), `window.matchMedia`, `document.createElement`.
- **Consumed by:** `useMediaQuery` — `src/components/chat/header-orb-trigger.tsx:8`, `chat/voice-orb.tsx:6`, `hero-graph/index.tsx:6`, `game/build-graph.tsx:7`, `hero-avatar/index.tsx:6`, `view-hint.tsx:7`, `src/app/resume/page.tsx:11`. `useWebGLSupported` — `chat/voice-orb.tsx:6`, `hero-graph/index.tsx:6`, `game/build-graph.tsx:7`.
- **Behaviour notes:** `useMediaQuery` server snapshot is `false` (mobile-first / no-WebGL default) (:15). `useWebGLSupported` (:28-47) probes once per session into a module-level `webglSupport` cache (:19, :32), trying `webgl2` → `webgl` → `experimental-webgl` on a throwaway canvas; any throw → `false` (:40-43); server snapshot `false` (:45). Its subscribe is a no-op (`() => () => {}`, :30) — the value never changes after the probe.
- **Gotchas / invariants:** The probe exists because R3F surfaces a failed context as an async unhandledRejection that React error boundaries **cannot** catch (:21-26) — so the Canvas must be skipped entirely, not caught. `useMediaQuery`'s client snapshot calls `window.matchMedia(query).matches` on every read (:14) and its subscribe touches `window` unguarded, so it is client-only in practice (the server snapshot covers SSR).

### `src/lib/use-reduced-motion.ts`

- **Role:** Native `prefers-reduced-motion` hook, written to avoid importing `motion/react` (and its ~140KB bundle) just for this (:3-6).
- **Exports:** `useReducedMotion(): boolean`.
- **Consumed by:** `src/components/ui/reveal.tsx:4`, `ui/skeleton.tsx:3`, `hero-graph/scene-physics.tsx:7`, `hero-graph/index.tsx:5`, `hero-avatar/index.tsx:5`.
- **Behaviour notes:** Unlike the other hooks in this file set, this one uses `useState` with a lazy initializer that reads `matchMedia` when `window` exists (:9-14), plus an effect that subscribes to `change` (:15-21). SSR returns `false`.
- **Gotchas / invariants:** This is the one motion/media hook that is *not* `useSyncExternalStore`-based, so it renders once with the initializer value and can hydrate-mismatch if the server and client disagree — the initializer guards `window` but the server always yields `false`.

## Coverage

- `src/lib/llm.ts`
- `src/lib/llm-trace.ts`
- `src/lib/llm-sdk-mode.ts`
- `src/lib/agent-trace.ts`
- `src/lib/voice-catalog.ts`
- `src/lib/voice-picker-mode.ts`
- `src/lib/voice-settings-context.tsx`
- `src/lib/rate-limit.ts`
- `src/lib/redis.ts`
- `src/lib/admin-auth.ts`
- `src/lib/cron-auth.ts`
- `src/lib/chat-cache.ts`
- `src/lib/faq-embeddings.ts`
- `src/lib/r3f.ts`
- `src/lib/use-media-query.ts`
- `src/lib/use-mounted.ts`
- `src/lib/use-reduced-motion.ts`
- `src/lib/telemetry/schema.ts`
- `src/lib/telemetry/emit.ts`
- `src/lib/telemetry/with-trace.ts`
- `src/lib/telemetry/beacon.ts`
- `src/lib/scroll/types.ts`
- `src/lib/scroll/resolve-flag.ts`
- `src/lib/scroll/scroll-flags.tsx`
- `src/lib/scroll/use-auto-scroll.ts`
- `src/lib/scroll/use-stick-to-bottom-custom.ts`
- `src/lib/scroll/use-stick-to-bottom-library.ts`

Table-only (trivial, fully covered in "At a glance"):
- `src/lib/r3f.ts` — pure re-export barrel; named exports only (no wildcards) to avoid collisions between fiber/drei/postprocessing (r3f.ts:11-13). Exists so bundlers see ONE module-graph node for the R3F universe and hoist a shared chunk instead of emitting duplicate ~873KB chunks per async `import()` boundary (r3f.ts:5-10). `three` is the only namespace re-export (`export * as THREE`, r3f.ts:21).
- `src/lib/use-mounted.ts` — 16 lines; `useSyncExternalStore(emptySubscribe, () => true, () => false)` (use-mounted.ts:11-15). Consumed by `view-switcher.tsx:12`, `ui/reveal.tsx:6`, `game/glass-box-demo.tsx:7`.
- `src/lib/scroll/types.ts` — type-only (see Detail note under the scroll section).

**Not in this index (no source file):** `case-study-depth.ts` — does not exist; only `src/lib/case-study-depth.test.ts` is present.
