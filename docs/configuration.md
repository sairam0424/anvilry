# Configuration Reference — Anvilry

All environment variables, feature flags, and build-time configuration for Anvilry.
This is the single source of truth; `.env.example` in the project root has the same
info in a copy-pasteable format for local dev.

## Environment Variables

### LLM Provider

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | No | `bedrock` | `bedrock` = AWS Bedrock (primary); `anthropic` = direct Anthropic API. Switching is an env change, not a code change. |

### AWS Bedrock (when LLM_PROVIDER=bedrock)

| Variable | Required | Default | Description |
|---|---|---|---|
| `BEDROCK_ACCESS_KEY_ID` | Yes | — | IAM access key (raw or BASE64-encoded; code decodes automatically). |
| `BEDROCK_SECRET_ACCESS_KEY` | Yes | — | IAM secret key (raw or BASE64-encoded). |
| `BEDROCK_SESSION_TOKEN` | No | — | Only for temporary STS credentials. |
| `BEDROCK_REGION` | No | `us-east-1` | Preferred over `AWS_REGION` (Vercel/Lambda can mangle that reserved name). |
| `AWS_REGION` | No | `us-east-1` | Fallback if `BEDROCK_REGION` is unset. |

**Model chain:** Sonnet 4.6 (primary, fast) → Opus 4.6 (secondary, deeper reasoning) → Haiku 4.5 (fallback). Configured in `src/lib/llm.ts`. The chain auto-falls-through on availability errors (400 "model identifier is invalid" or access-denied).

### Direct Anthropic API (when LLM_PROVIDER=anthropic)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Get one at https://console.anthropic.com/ |

### Rate Limiting (Upstash Redis) — Optional

| Variable | Required | Default | Description |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | No | — | If unset, the rate limiter is a no-op (fine for local dev). |
| `UPSTASH_REDIS_REST_TOKEN` | No | — | Per-IP limit on `/api/chat`, `/api/tts`, `/api/transcribe` (8 req/min). |

When both are set, per-IP rate limiting is active. When unset, the limiter fails OPEN
(no cost protection — a production-readiness warning logs on startup).

### Voice — Optional AWS Engines

The voice layer is **free by default** (browser Web Speech API: SpeechRecognition +
speechSynthesis). Two optional upgrades reuse the existing `BEDROCK_*` credentials — NO
new env vars:

| Engine | Route | IAM action needed | Fallback |
|---|---|---|---|
| AWS Polly Neural TTS | `/api/tts` | `polly:SynthesizeSpeech` | Browser speechSynthesis |
| AWS Transcribe streaming STT | `/api/transcribe` | `transcribe:StartStreamTranscription` | Browser SpeechRecognition |

Both routes **fail closed**: without the IAM permission they return 502 and the client
silently falls back to the free browser voice.

---

## Feature Flags (Build-Time)

All `NEXT_PUBLIC_*` variables are inlined at build time by Next.js. Changing them
requires a **redeploy** — they are not runtime-toggleable.

### Enabled Views

| Variable | Values | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ENABLED_VIEWS` | Comma-separated: `gamified`, `chat`, `developer`, `voice` | (unset = ALL on) | Which views are available beyond Classic. Classic is ALWAYS on (non-disableable — SSG/crawler/no-JS default). If unset, all views are enabled. If set to empty string, Classic-only. |

**Examples:**
- `NEXT_PUBLIC_ENABLED_VIEWS=gamified,chat,developer,voice` — all on (same as default)
- `NEXT_PUBLIC_ENABLED_VIEWS=chat,voice` — only Chat + Voice; Play + Dev hidden
- `NEXT_PUBLIC_ENABLED_VIEWS=` — Classic only

### Anvil Header Orb — Placement & Kill-Switch

| Variable | Values | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ANVIL_ORB_MODE` | `inplace` \| `modal` \| `off` | `inplace` | **inplace** = the orb expands in-place (desktop) / modal (mobile). **modal** = always the centered modal (prior behavior — instant revert). **off** = hide the orb entirely. |
| `NEXT_PUBLIC_ENABLE_ANVIL_ORB` | `"false"` | (any other / unset = on) | Legacy kill-switch. `"false"` maps to `ORB_MODE=off`. Superseded by `ORB_MODE`. |

### Anvil Header Orb — Experience (Chrome Level)

| Variable | Values | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE` | `classic` \| `core` | `classic` | **classic** = the full in-place panel (orb + captions + chips + controls). **core** = the minimal Siri orb-only mode (enlarged orb + frosted result card, no panel chrome). Orthogonal to `ORB_MODE`. |

### Flag Matrix (desktop behavior)

| ORB_MODE | EXPERIENCE | Desktop behavior |
|---|---|---|
| `inplace` | `classic` | **Default.** Full in-place panel anchored under the orb. |
| `inplace` | `core` | Orb-only + frosted result card, auto-listens. |
| `modal` | (any) | Centered modal overlay (the v1.5.0 behavior). |
| `off` | (any) | Orb hidden; the Voice view (switcher) + Chat "Talk" pill still work. |

**Mobile (<768px):** always falls back to the centered modal regardless of `ORB_MODE`/`EXPERIENCE`.

---

## Runtime Voice Settings (localStorage, visitor-toggleable)

Stored in `localStorage` under `anvilry:voice:settings`. All default OFF / browser /
modal. Toggled via the command palette (⌘K → "Voice" group).

| Key | Type | Default | Description |
|---|---|---|---|
| `micEnabled` | boolean | `false` | Show the push-to-talk mic button in the composer. |
| `ttsEnabled` | boolean | `false` | Allow per-answer "read aloud" + spoken talk-mode output. |
| `wakeWord` | boolean | `false` | Always-listening wake word ("Hey Anvil"). Highest trust cost. |
| `captions` | boolean | `true` | Show the live caption (spoken-text transcript) in talk mode. |
| `sttEngine` | `"browser"` \| `"transcribe"` | `"browser"` | STT engine (browser Web Speech default; AWS Transcribe opt-in). |
| `ttsEngine` | `"browser"` \| `"polly"` | `"browser"` | TTS engine (browser default; AWS Polly Neural opt-in). |
| `talkSurface` | `"modal"` \| `"view"` | `"modal"` | Whether the ⌘K "Start voice" command + Chat "Talk" pill show (modal) or hide (view). |

---

## Security Headers

Configured in `next.config.ts` via the `headers()` function (not middleware — `middleware.ts` is deprecated in Next 16, renamed to `proxy.ts`).

| Header | Value | Notes |
|---|---|---|
| `Content-Security-Policy` | Enforced (not Report-Only) since v1.4.1 | `script-src 'self' 'unsafe-inline'`; no `unsafe-eval`/`wasm-unsafe-eval`. |
| `X-Frame-Options` | `SAMEORIGIN` | |
| `X-Content-Type-Options` | `nosniff` | |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Permissions-Policy` | `microphone=(self)` | Mic scoped to self only. |
| `Strict-Transport-Security` | Platform default (Vercel) | HSTS from Vercel's edge. |

---

## One-Mic Mutex (Architecture)

The voice engine (`useVoiceSession`) is per-instance. Four surfaces can open it:
1. The centered **modal** (Chat "Talk" pill, ⌘K).
2. The in-place **inline panel** (header orb, `ORB_MODE=inplace`, `EXPERIENCE=classic`).
3. The **core surface** (header orb, `ORB_MODE=inplace`, `EXPERIENCE=core`).
4. The **Voice view** (`?view=voice`).

A small arbiter (`src/components/chat/voice-surface-mutex.ts`) guarantees exactly ONE is
open at a time — opening one closes the others (the voice view is excluded by disabling
the orb on that view). The gamified `BuildGraph` WebGL canvas unmounts while any voice
overlay is open (one live GL context).

---

## File Locations

| Concern | File |
|---|---|
| LLM client + model chain | `src/lib/llm.ts` |
| Voice settings store | `src/lib/voice-settings-context.tsx` |
| Voice session state machine | `src/components/chat/use-voice-session.ts` |
| Voice surface mutex | `src/components/chat/voice-surface-mutex.ts` |
| Header orb trigger (flag reads) | `src/components/chat/header-orb-trigger.tsx` |
| Inline panel (classic) | `src/components/chat/anvil-inline-panel.tsx` |
| Core surface (core) | `src/components/chat/anvil-core-surface.tsx` |
| Talk-mode (shared voice UI) | `src/components/chat/talk-mode.tsx` |
| Anvil view (5th view) | `src/components/chat/anvil-view.tsx` |
| Security headers | `next.config.ts` (headers()) |
| Rate limiting | `src/lib/rate-limit.ts` |
