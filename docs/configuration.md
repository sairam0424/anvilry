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

### Voice Picker — UX Mode (v1.7)

| Variable | Values | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_VOICE_PICKER_MODE` | `descriptor` \| `gender` | `descriptor` | **descriptor** = modern named cards with 2-word descriptors (ChatGPT/Siri pattern: "Stephen — warm & direct"). **gender** = explicit Male / Female / System default toggle, 2-column layout. Both modes share the same catalog; only the picker layout + labels differ. |
| `GOOGLE_TTS_API_KEY` | API key | — | Optional. Adds Google Cloud TTS Chirp 3 HD as a third engine (alongside browser + Polly) with a permanent 1M chars/mo free tier — hedges Polly's 12-month free-tier cliff. When unset, Google voices are hidden from the picker. Get a key at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) with the Cloud Text-to-Speech API enabled. |

### Beast-Mode Feature Flags (v1.9 + v2.0) — all default OFF

All six flags default to `false` / unset in production. Set to `"true"` to enable. Require a **redeploy** to take effect (build-time inlining).

| Variable | Default | Added | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ORB_POSTPROCESSING` | `false` | v1.9 | Enables Bloom + Vignette + Noise + ChromaticAberration + cursor-reactive Fluid on the 3D orb (`voice-orb-3d.tsx`). Only activates on high-tier devices (≥4 GB RAM + ≥4 CPU cores). Default is the clean inline-halo orb. |
| `NEXT_PUBLIC_INK_TRANSITION` | `false` | v1.9 | Replaces the plain CSS crossfade with a raw WebGL2 ink-bleed shader on every view switch. Falls back to plain crossfade when `prefers-reduced-motion` is on or the browser lacks the View Transitions API. |
| `NEXT_PUBLIC_SKILL_TREE` | `false` | v1.9 | Shows the SVG RPG Skill Tree section at the bottom of the Play (Gamified) view. 6 categories × 5+ skills, cubic bezier connections, animated energy-flow dashes. Hidden by default to keep the Play view clean. |
| `NEXT_PUBLIC_404_ORB` | `false` | v2.0 | Renders the distressed 3D orb (red/orange `errorMode` palette, erratic breathing) above the terminal on the 404 page. Wrapped in `WebGLBoundary` — falls back to terminal-only when WebGL is unavailable. |
| `NEXT_PUBLIC_VISITOR_COUNTER` | `false` | v2.0 | Shows an `"↑ N engineers visited"` badge in the site footer. Increments a Redis counter (`anvilry:visits:total`) on each page load, rate-limited to 1 increment per IP per 30 min via `@upstash/ratelimit`. Requires Upstash Redis. |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | `false` | v2.0 | Shows a `"★ N/5 discovered"` badge (bottom-right, z-30) as visitors explore the site. Backed by `localStorage` — persists across refreshes. 5 unlock triggers: view switch, AI chat question, terminal command, Konami code, dossier open. Cmd+K → "Unlock all discoveries" is the escape hatch. |

**Dependency note:** `NEXT_PUBLIC_VISITOR_COUNTER` and `NEXT_PUBLIC_DISCOVERY_BADGES` have no hard Redis dependency (they degrade gracefully), but the counter needs `UPSTASH_REDIS_REST_URL` + `_TOKEN` to actually persist the count. `NEXT_PUBLIC_ORB_POSTPROCESSING` requires `@react-three/postprocessing` (already in `package.json`).

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
| `ttsEngine` | `"browser"` \| `"polly"` \| `"google"` | `"browser"` | TTS engine (browser default; AWS Polly Neural opt-in; Google Cloud TTS Chirp 3 HD as a permanent-free hedge — `google` requires `GOOGLE_TTS_API_KEY`). |
| `talkSurface` | `"modal"` \| `"view"` | `"modal"` | Whether the ⌘K "Start voice" command + Chat "Talk" pill show (modal) or hide (view). |
| `voiceId` | string \| `undefined` | `undefined` | Catalog id of the user-picked voice (e.g. `polly-generative-stephen`). When unset, the runtime resolves to the catalog default at point of use (Joanna for Polly, the engine default for browser / Google). Picker writes this; nothing else does. |
| `voiceCharacter.speed` | `"slow"` \| `"natural"` \| `"fast"` | `"natural"` | Speech rate. Maps to browser `u.rate` (clamped 0.85–1.15) + Polly Neural `<prosody rate>`. Dropped on Polly Generative + Google Chirp 3 HD (engines reject most prosody tags). |
| `voiceCharacter.tone` | `"warm"` \| `"neutral"` \| `"crisp"` | `"neutral"` | Pitch bias. Maps to browser `u.pitch` (clamped 0.95–1.10) + Polly Neural `<prosody pitch>`. |
| `voiceCharacter.pause` | `"spacious"` \| `"normal"` \| `"tight"` | `"normal"` | Inter-sentence pause. Maps to browser sentence padding + Polly Neural `<break time>`. |

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

---

## Telemetry & Observability (v1.8)

End-to-end structured event stream: frontend errors → backend errors → AI request tracing.
Zero new vendors — all sinks are same-origin (Vercel Logs) or already-provisioned infra (Upstash).
See `TELEMETRY.md` at the repo root for the full reference.

### Server-side env vars

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEMETRY_ENABLED` | No | `"true"` | Set to `"false"` to disable event emission. `"false"` = off; anything else (including unset) = on. |
| `TELEMETRY_IP_SALT` | No | — | Salt for SHA-256 IP hashing. Without this, IPs hash to `"anonymous"` (fully private, no analytics). Generate: `openssl rand -base64 16`. |
| `ADMIN_PASSWORD` | No | — | Password for `/admin/telemetry` dashboard (HTTP Basic Auth). When unset the page renders an instructions screen. |

### Build-time flag

| Variable | Values | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_LLM_SDK` | `anthropic-bedrock` \| `aws-sdk-bedrock` | `anthropic-bedrock` | SDK for `/api/chat` Bedrock calls. `anthropic-bedrock` = current shipping path (`@anthropic-ai/bedrock-sdk`). `aws-sdk-bedrock` = reserved for v1.8.x OTel auto-instrumentation migration (stub only in v1.8). |

### Admin dashboard

Visit `/admin/telemetry` (or `curl -u :YOUR_ADMIN_PASSWORD https://anvilry.vercel.app/admin/telemetry`).

Six tiles: events today, cache hit rate, fallback rate, error rate, client errors, server errors.
Route breakdown bar chart + recent-events table (last 50 spans, error rows highlighted).

Requires Upstash Redis (`UPSTASH_REDIS_REST_URL` + `_TOKEN`) — without Redis, the dashboard renders
an empty table with a note; Vercel Logs remain the primary sink.

### Trace replay CLI

```bash
node scripts/replay-trace.mjs <traceId>
```

Reads all spans for a traceId from Upstash (7-day retention window) and prints chronological output.
The traceId appears in the `x-anvilry-trace-id` response header on every `/api/*` response.

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
| Shared Redis singleton | `src/lib/redis.ts` |
| Telemetry schema + redactors | `src/lib/telemetry/schema.ts` |
| Dual-sink emitter | `src/lib/telemetry/emit.ts` |
| Route wrapper | `src/lib/telemetry/with-trace.ts` |
| Browser error beacon | `src/lib/telemetry/beacon.ts` |
| Admin auth helper | `src/lib/admin-auth.ts` |
| Admin dashboard | `src/app/admin/telemetry/page.tsx` |
| Replay CLI | `scripts/replay-trace.mjs` |
| **v1.9+ beast flags** | |
| 3D orb + post-processing | `src/components/chat/voice-orb-3d.tsx` |
| Ink-bleed WebGL transition | `src/components/ui/ink-transition.tsx` |
| SVG skill tree | `src/components/game/skill-tree.tsx` |
| **v2.0 beast flags** | |
| 404 orb hero | `src/app/not-found.tsx` |
| Visitor counter API | `src/app/api/visit/route.ts` |
| Visitor badge (footer) | `src/components/site-footer.tsx` |
| Discovery store | `src/lib/discovery-store.ts` |
| Discovery badge component | `src/components/game/discovery-badge.tsx` |
