# VOICE.md — Anvilry Portfolio Voice Layer

The **Voice** feature is an opt-in, free-first progressive enhancement layered over the existing text chat of the Anvilry portfolio (Next.js 16, React 19). It lets a recruiter speak questions, hear answers read aloud, hold a hands-free two-way conversation, or enable an always-listening wake word — all without ever displacing the text composer, which remains the primary channel at every moment.

Everything defaults **off** (or to the free browser engine). No backend change is required for the free path, no new vendor is introduced, and any feature-detect miss or runtime error degrades silently back to text. Optional AWS upgrades (Polly TTS, Transcribe STT) reuse the existing Bedrock credentials and fail closed to the browser path.

> **v1.7 update — voice quality upgrade.** A curated voice picker (6 voices) with a "More voices…" overflow (12+) is now available in three surfaces (talk-mode header label, ⌘K palette, settings dialog). Two new TTS engines layer in: AWS Polly Generative (premium tier, gated to user-pick) and Google Cloud TTS Chirp 3 HD (permanent-free hedge against Polly's 12-month free-tier cliff). 16 platform pitfalls (iOS gesture lock, Linux eSpeak detection, Apple Premium download hint, screen-reader double-speak avoidance, etc.) are surfaced as contextual advisories in the picker + settings UI. See [§7. Voice picker (v1.7)](#7-voice-picker-v17) for the full mechanics.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Features & Usage](#2-features--usage)
3. [Feature Flags / Settings Reference](#3-feature-flags--settings-reference)
4. [Environment / IAM / Cost](#4-environment--iam--cost)
5. [Privacy & Accessibility](#5-privacy--accessibility)
6. [Developer Notes](#6-developer-notes)

---

## 1. Overview & Architecture

Voice is a **progressive enhancement over the text chat** — opt-in, free-first, with zero backend change required for the free path. It attaches directly to the existing `useChat()` transport and streamed tokens, so the chat backend is unchanged. Everything defaults **off**. The text composer remains the primary channel at all times; voice is additive and degrades gracefully (to text) on any feature-detect miss or error.

### Components

1. **Settings store** (`src/lib/voice-settings-context.tsx`) — a module-level, localStorage-backed external store (via `useSyncExternalStore`) holding persisted opt-in flags (`micEnabled`, `ttsEnabled`, `wakeWord`) and engine selections (`sttEngine`, `ttsEngine`, `talkSurface`). All default **off** / browser / modal.

2. **STT (Speech-to-Text) hooks**
   - `useSpeechRecognition()` (`src/components/chat/use-speech-recognition.ts`) — browser Web Speech API, push-to-talk, progressive enhancement with a full error taxonomy (`denied` / `no-device` / `no-speech` / `network` / `unknown`).
   - `useTranscribeRecognition()` (`src/components/chat/use-transcribe-recognition.ts`) — optional AWS Transcribe via the `/api/transcribe` route (POSTs 16-bit PCM, returns the final transcript).
   - `useStt()` (`src/components/chat/use-stt.ts`) — engine selector that gates on both support AND runtime errors, with automatic fallback to the browser engine.

3. **TTS (Text-to-Speech) hook** (`src/components/chat/use-speech-synthesis.ts`)
   - Browser `speechSynthesis` (free, per-sentence incremental) is the default.
   - Optional AWS Polly Neural via the `/api/tts` route (one sentence per request, in-process LRU cache, per-IP rate-limited, falls back to browser on error).
   - Per-sentence chunking dodges Chromium's ~15s utterance cutoff.
   - Both engines drive the same `UseSpeechSynthesis` interface, so callers are engine-agnostic.

4. **Two-way talk mode** (`src/components/chat/use-voice-session.ts`) — a half-duplex, grounded state machine that **speaks the answer as it streams** (since v1.5.0).
   - Lifecycle: `idle` → `listening` → `thinking` → `speaking` → `listening` (loop).
   - State is **derived** (not stored) from child-hook signals: `recognition.isListening`, `isStreaming`, `tts.isSpeaking`.
   - **Speak-as-it-streams:** while `/api/chat` is still streaming, each completed sentence is spoken via `tts.speakChunk()` (deduped; trailing partial held back), so the first audio starts ~one sentence after the first token instead of after the whole answer settles. Honest limit: it **speaks as it streams with instant interrupt** but is **not gapless** (inter-sentence timing is browser-controlled) — it feels like a fast assistant, not ChatGPT Advanced Voice's continuous overlap. Barge-in (tap/Space) cancels TTS **and** aborts the in-flight stream.
   - **Audio-reactive orb** (`voice-orb.tsx`): a desktop R3F GLSL "Siri orb" (noise-displaced icosahedron, behind WebGL + min-width + reduced-motion gates) with a universal 2D-canvas orb fallback, driven by a smoothed `level` (`use-voice-level.ts`). The level is a **synthetic per-state envelope** — browser `speechSynthesis` exposes no audio node to tap, so the speaking orb is event-timed, not true amplitude. Reduced-motion → a calm static ring.
   - **Captions** on by default (a11y), toggleable (cc control); show the spoken prose stripped of markdown + card tokens (`toCaptionText` — the same helper feeds the audio so caption == speech).
   - Avoids self-hearing by design: the mic stops after the final result (off during thinking + speaking) and re-opens only after speech fully ends.

5. **UI surfaces**
   - **Mic button** (`src/components/chat/mic-button.tsx`) — push-to-talk in the composer; first-use disclosure (engine-aware copy); fill-for-review (interim + final text flows to the input for edit/confirm).
   - **Read-aloud button** (`src/components/chat/read-aloud-button.tsx`) — per-answer "Listen" button; sets `disableLiveAnnounce` to prevent `aria-live` double-speak.
   - **Talk mode** (`src/components/chat/talk-mode.tsx`) — orb + live transcript + controls; keyboard-operable (Space toggles the turn, Esc closes); reduced-motion static; WCAG caption/status live region.
   - **Talk overlay** (`src/components/chat/talk-mode-overlay.tsx`) — Radix Dialog wrapper (modal, default); focus restoration on close via `onCloseAutoFocus` + a `getOpener` prop.
   - **Optional 5th view** (`src/components/view-context.tsx`, `src/components/view-switcher.tsx`) — full-page talk surface, accessed via the **ViewSwitcher** (only relevant when `talkSurface="view"`); mounted via `src/components/chat/talk-mode-mount.tsx` conditional on settings.

6. **Wake word** (`src/components/chat/use-wake-word.ts`, `src/components/chat/wake-word-controller.tsx`) — opt-in continuous listen; off by default; behind a disclosure gate + persistent banner with one-tap kill.

7. **Voice command group** (`src/components/command-palette.tsx`) — the six toggles/actions for all voice features, in the ⌘K palette's **Voice** group (see [§3](#3-feature-flags--settings-reference)).

8. **API routes** (optional, only hit when an AWS engine is selected)
   - `src/app/api/transcribe/route.ts` — POSTs 16-bit PCM @ 16 kHz, streams to AWS Transcribe, returns the final transcript. Rate-limited (8/min per IP via Upstash).
   - `src/app/api/tts/route.ts` — POSTs sentence text, returns Polly MP3 audio. In-process LRU cache (100 entries). Rate-limited (8/min per IP via Upstash).

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                       │
│  (Press mic button / Space in talk mode / say wake word)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  STT (useStt hook chain)    │
        │  ┌──────────────────────┐   │
        │  │ useSpeechRecognition │◄──┼─ browser Web Speech (free, default)
        │  │  (push-to-talk)      │   │
        │  └──────────────────────┘   │
        │           OR                │
        │  ┌──────────────────────┐   │
        │  │useTranscribeRecognit │◄──┼─ /api/transcribe (POSTs PCM, optional)
        │  │ (with fallback)      │   │
        │  └──────────────────────┘   │
        └────────────┬────────────────┘
                     │ (final transcript string)
                     │
        ┌────────────▼────────────┐
        │   useChat().send(text)  │
        │   (reuses existing      │
        │    chat transport)      │
        └────────────┬────────────┘
                     │ (POST to /api/chat)
                     │
        ┌────────────▼────────────────────────┐
        │  Bedrock stream (AWS Lambda layer)  │
        │  (grounded in corpus, no            │
        │   fabrication structural)           │
        └────────────┬────────────────────────┘
                     │ (streamed markdown tokens)
                     │
        ┌────────────▼──────────────┐
        │  TTS (useSpeechSynthesis) │
        │  ┌──────────────────────┐ │
        │  │ browser speechSynthesis │◄─ free, per-sentence (default)
        │  │ (incremental,        │ │
        │  │  dodge ~15s cutoff)  │ │
        │  └──────────────────────┘ │
        │           OR              │
        │  ┌──────────────────────┐ │
        │  │ /api/tts (Polly)     │◄─ AWS Polly, in-process LRU cache,
        │  │ (sentence by         │ │  optional flag
        │  │  sentence)           │ │
        │  └──────────────────────┘ │
        └────────────┬──────────────┘
                     │ (Audio plays)
                     │
        ┌────────────▼────────────┐
        │   USER HEARS ANSWER     │
        │   (+ live transcript    │
        │    caption always shown)│
        └────────────┬────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │ Talk mode loops: end speaking → re-   │
        │ open mic, user speaks again           │
        │ (Barge-in via Space / UI tap, not     │
        │ voice, so no self-hearing feedback)   │
        └───────────────────────────────────────┘
```

### Free Path (No Server Change)

The free voice stack requires **zero backend modification**:

1. **Mic input** → `useSpeechRecognition()` → browser-native Web Speech API (no backend).
2. **Chat answer** → existing `/api/chat` route (unchanged; Bedrock stream returns tokens).
3. **Read-aloud / talk mode** → `useSpeechSynthesis()` → browser-native `speechSynthesis` (no backend).

This is a **complete voice loop** on zero new infrastructure, and is the default for every visitor: the chat stays grounded, no new vendor, no cost, all opt-in.

### Optional AWS Upgrades (Flags, Reuse Bedrock Creds)

If `BEDROCK_ACCESS_KEY_ID` and `BEDROCK_SECRET_ACCESS_KEY` are configured:

- **AWS Polly TTS** (higher quality) — toggle via the command palette (**"Use higher-quality voice (Polly)"**). Routes `/api/tts` requests, caches in-memory, falls back to browser on any error. Needs IAM `polly:SynthesizeSpeech`.
- **AWS Transcribe STT** (private, enables Firefox) — toggle via the palette (**"Mic: use private transcription (AWS)"**). Routes `/api/transcribe` requests, returns the final transcript, falls back to browser on error. Needs IAM `transcribe:StartStreamTranscription`.

Both routes are optional, fail-closed (HTTP non-2xx → browser fallback), per-IP rate-limited (Upstash, 8/min shared with chat), and require no new environment variables (they reuse the Bedrock creds + region).

### Key Properties

| Property | Value | File |
|---|---|---|
| **Settings store key** | `anvilry:voice:settings` | `src/lib/voice-settings-context.tsx` |
| **Settings defaults** | All OFF (`micEnabled`, `ttsEnabled`, `wakeWord` = `false`; `sttEngine = "browser"`; `ttsEngine = "browser"`; `talkSurface = "modal"`) | `src/lib/voice-settings-context.tsx` |
| **STT engines** | `"browser"` (Web Speech API, free) \| `"transcribe"` (AWS Transcribe, optional) | `src/lib/voice-settings-context.tsx` |
| **TTS engines** | `"browser"` (speechSynthesis, free) \| `"polly"` (AWS Polly Neural, optional) | `src/lib/voice-settings-context.tsx` |
| **Talk surfaces** | `"modal"` (default overlay) \| `"view"` (optional 5th view) | `src/lib/voice-settings-context.tsx` |
| **Rate limit** | 8 requests per minute per IP (shared: `/api/chat`, `/api/transcribe`, `/api/tts`) | `src/lib/rate-limit.ts` |
| **Browser support** | Chrome/Edge/Safari (full); Firefox (degrades to text or uses AWS Transcribe) | `src/components/chat/use-speech-recognition.ts` |
| **Polly TTS max length** | 600 chars per request (hard safety cut) | `src/app/api/tts/route.ts` |
| **Transcribe max audio** | 5 MiB (~2.6 min @ 16 kHz mono PCM) | `src/app/api/transcribe/route.ts` |
| **Polly voice** | "Joanna" (clear US-English neural) | `src/app/api/tts/route.ts` |
| **In-process TTS cache** | 100 entries, per-instance, LRU | `src/app/api/tts/route.ts` |
| **Chromium ~15s utterance cutoff workaround** | Desktop-only pause/resume every ~12s (skipped on Android) | `src/components/chat/use-speech-synthesis.ts` |

### Settings Persistence

All voice settings persist to localStorage under the key `anvilry:voice:settings`. The store hydrates synchronously on the first client render (avoiding an SSR/hydration mismatch), and a partial update (e.g. toggling one flag) persists only that field, so older browsers without all flags upgrade cleanly. Best-effort: if localStorage is unavailable (private mode, quota) or throws, the feature still works with session-only defaults.

---

## 2. Features & Usage

The voice layer is four independent, opt-in features. Each defaults to **off**; visitors explicitly enable them via the command palette (⌘K on desktop) and their preference persists in `localStorage` under the key `anvilry:voice:settings`.

### 2.1 Microphone Input (Push-to-Talk Composer)

**What it does:** Capture your speech as text without typing. The mic button appears next to Send in the composer and converts spoken words into text you review and edit before sending.

**Browser support:** Chrome/Edge/Safari — full (Web Speech API). Firefox — no browser STT, but can use the AWS Transcribe engine (see engine selector below).

**How to enable:** Open the command palette (⌘K), search `"Mic:"`, and select the STT-engine toggle:
- **"Mic: use private transcription (AWS)"** (shown when on the browser engine — flips you to Transcribe)
- **"Mic: use browser speech"** (shown when on the Transcribe engine — flips you back)

This STT-engine toggle is the primary control and is **always shown** (even on Firefox, so a Firefox visitor can opt into Transcribe). On **first use**, a one-time disclosure explains which service transcribes your audio (browser vendor or Sairam's AWS); you press **"Use microphone"** to proceed. Thereafter the disclosure is skipped and you can start/stop listening immediately.

**Key UX:**
- **Press-to-toggle** (not hold — motor-accessible): click to start, click again to stop.
- **Fill-for-review:** interim words appear in the composer as you speak; final text stays for editing before you Send.
- **Visual feedback:** while listening the mic shows a stop-square indicator + pulsing dot (not color-only).
- **Permission denied:** the button shows a mic-off icon with a tooltip guiding you to check permissions.

| Aspect | Detail |
|---|---|
| **Storage** | `micEnabled` boolean (localStorage, default `false`) |
| **Control** | Palette: `"Mic: use private transcription (AWS)"` / `"Mic: use browser speech"` (label flips with state) |
| **Engine** | `sttEngine`: `"browser"` (default) or `"transcribe"` (AWS Transcribe) |
| **UX model** | Press-to-toggle; interim + final transcripts flow into the composer for review |
| **Appearance** | Icon button (right of composer) with a stop-square + pulsing dot while active |

### 2.2 Read-Aloud (Per-Answer Text-to-Speech)

**What it does:** Hear each assistant response spoken aloud. A "Listen" button appears under each message; press it to hear the answer, press again ("Stop") to silence it.

**Browser support:** Chrome/Edge/Safari/Firefox — all full (browser `speechSynthesis`). All browsers fall back to the browser voice if AWS Polly errors.

**How to enable:** ⌘K → search "Read" → select **"Read answers aloud"** (becomes **"Turn off read-aloud"** when on). Persists as `ttsEnabled` (default `false`).

**Optional — higher-quality voice:** ⌘K → search "higher" → toggle between **"Use higher-quality voice (Polly)"** (AWS Polly Neural — richer, via the owner's AWS) and **"Use free browser voice"** (browser `speechSynthesis` — lower latency, free). Stored as `ttsEngine`: `"browser"` (default) or `"polly"`. This toggle only appears when read-aloud is on.

**Key UX:**
- **Per-sentence speech:** long answers speak incrementally — the first sentence starts while later ones stream in.
- **No double-speak:** pressing "Listen" while a previous answer is still speaking stops the old one and starts the new (no overlapping voices).
- **Visual feedback:** "Listen" (Volume2 icon) becomes "Stop" (stop-square icon) while speaking.
- **Stops on view change or tab hide.**
- **Engine fallback:** if Polly is selected but `/api/tts` errors, speech transparently falls back to the browser engine without interrupting.

| Aspect | Detail |
|---|---|
| **Storage** | `ttsEnabled` boolean (default `false`); `ttsEngine`: `"browser"` or `"polly"` (default `"browser"`) |
| **Control** | Palette: `"Read answers aloud"` / `"Turn off read-aloud"`; optional `"Use higher-quality voice (Polly)"` / `"Use free browser voice"` when read-aloud is on |
| **Engine** | Browser `speechSynthesis` (free, instant) or AWS Polly via `/api/tts` (higher quality) |
| **UX model** | One button per message; "Listen" → "Stop"; only one answer speaks at a time |
| **Appearance** | Icon button in each message: Volume2 (listen) / Stop (speaking) |

### 2.3 Two-Way Talk Mode (Hands-Free Voice Conversation)

**What it does:** A turn-based conversation — you speak a question, hear the answer read aloud, then the system listens again automatically; a complete loop without clicking between turns.

**Browser support:** Chrome/Edge/Safari — full (Web Speech API). Firefox — works if the AWS Transcribe engine is selected (requires `AudioContext` + `getUserMedia`). Unsupported browsers — a "type instead" message appears; text chat remains.

**How to enable:** ⌘K → search "voice" → select **"Start voice conversation"**.

> **Note:** The **"Start voice conversation"** palette command appears and functions **only when `talkSurface === "modal"`** (the default). It always opens the **modal overlay** (`talk-mode-overlay.tsx`) — it does not change behavior based on `talkSurface`. When `talkSurface === "view"`, this palette command is **not displayed**; the full-page 5th **"voice"** view is reached through the **ViewSwitcher** instead.

**Optional — where talk mode appears:** ⌘K → search "view" → toggle between **"Voice as full view"** (talk replaces the screen as the 5th view) and **"Voice as modal (not full view)"** (centered dialog, default). Stored as `talkSurface`: `"modal"` (default) or `"view"`.

**Key UX:**
- **Turn-based (half-duplex):** the mic opens only after the answer finishes speaking (no simultaneous mic + speaker, preventing feedback).
- **State machine:** "Listening" → "Thinking" (response streams) → "Speaking" (answer plays) → listening again.
- **Live transcript:** your spoken words appear on screen so voice is never the only channel (WCAG 1.2.2).
- **Orb visual:** a decorative orb pulses while listening/speaking; static under reduced-motion.
- **Space toggle:** Space starts talking (first turn) or interrupts the current speaker; Esc closes.
- **Mute/pause:** Mute button or Space during a listening turn mutes without closing; Resume/Space re-listens.
- **Grounded answers:** answers route through `/api/chat` (same as text chat), so they are grounded in the portfolio corpus.

| Aspect | Detail |
|---|---|
| **Access** | Palette: `"Start voice conversation"` — appears only when STT is supported AND `talkSurface === "modal"` |
| **Surface** | Modal overlay (default, via palette) or full-page "voice" view (via the ViewSwitcher when `talkSurface = "view"`) |
| **Engine** | Browser Web Speech (default) or AWS Transcribe (works in Firefox) |
| **State flow** | Idle → Listening → Thinking → Speaking → (auto-listen) → Listening loop |
| **Controls** | Primary button (start/stop/resume/mute); End button (close); Space/Esc shortcuts |
| **Grounding** | Routes through `/api/chat` (same as text chat) |

### 2.4 Wake Word (Always-Listening, Optional)

**What it does:** Continuously listen for "Hey portfolio" (or "Hey Sairam", "Ask my portfolio", "Hey anvil"). On detection, the two-way talk mode opens hands-free via `openTalkMode()`.

**Browser support:** Chrome/Edge/Safari — full (browser `SpeechRecognition`, continuous). Firefox — not supported. While listening, ambient audio streams to the browser's speech service (Google/Apple) — disclosed prominently.

**How to enable:** ⌘K → search "wake" → select **"Enable wake word (Hey portfolio)"** (becomes **"Turn off wake word"** when on). Enabling it also switches to the Chat view (where the banner lives). On first enable in a session, a disclosure modal explains that the mic stays active and the browser streams audio to detect the phrase; you must press **"Enable listening"** to arm. Acceptance is **session-local** (re-enabling in a later session discloses again — a conservative default). Stored as `wakeWord` boolean (default `false`).

**Key UX:**
- **Highest-trust-cost feature:** off by default, always behind an explicit toggle + cloud-audio disclosure + visible banner.
- **Persistent "Listening" banner:** while active, a non-dismissible **bottom-center** banner shows a pulsing dot + Ear icon + `Listening for "Hey portfolio"` text and a one-tap **Stop** button. Exact styling (`wake-word-controller.tsx`): `className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-accent/50 bg-bg-surface/95 px-4 py-2.5 shadow-2xl backdrop-blur"` (`left-1/2` + `-translate-x-1/2` = horizontally centered).
- **One-tap kill:** Stop calls `disarm()`, releasing the mic and hiding the banner.
- **View-scoped:** only listens on the Chat view (`ACTIVE_VIEWS = ["chat"]`); switching to any other view disarms the mic. (The Anvil **Voice** view is already a live talk surface with its own session, so the wake word is scoped away from it — arming there would open a second concurrent mic.)
- **No silent hot mic:** the banner + button guarantee the visitor always knows the mic is live.

| Aspect | Detail |
|---|---|
| **Storage** | `wakeWord` boolean (default `false`); disclosure acceptance is session-local (not persisted) |
| **Phrases** | "Hey portfolio" \| "Hey Sairam" \| "Ask my portfolio" \| "Hey anvil" |
| **Control** | Palette: `"Enable wake word (Hey portfolio)"` / `"Turn off wake word"` |
| **Engine** | Browser `SpeechRecognition` (continuous) — cloud audio to Google/Apple |
| **Disclosure** | Mandatory first-use modal per session; explains cloud streaming + visible-listening guarantee |
| **Trust surface** | Persistent bottom-center "Listening" banner with one-tap Stop + view-scoped (Chat/Voice only) |
| **Trigger** | Opens two-way talk mode via `openTalkMode()` |

### 2.5 Anvil — The Voice Surface (View + Header Orb)

**What it is:** "Anvil" is the name of the voice *surface* (not a separate character — the assistant still answers in the first person as Sairam, grounded in the corpus). It exposes the same two-way talk engine through two always-available doors that share ONE session/mic:

**A. The Anvil view (always-on 5th view).** A first-class view beside Classic · Play · Chat · Dev, shown in the desktop ViewSwitcher and deep-linkable at `?view=voice`. It is a lean voice landing (`anvil-view.tsx`): a brand header ("Talk to Anvil — the voice of Sairam's work"), example-prompt chips, and an open-to-roles hook, wrapping the shared `TalkMode`.
- **Prompt chips** ("What are you looking for in your next role?", "Walk me through your strongest project", …) call `useVoiceSession.ask(text)` — they ask **by voice** through the session's own `send()` (never a sibling `useChat`), so the answer streams + is spoken like a spoken turn, then the loop re-listens. Chips show only before the first turn; where STT is unsupported they're omitted and the "type instead" fallback covers it.
- **SSR-safe:** the view store's server + first-client snapshot stays `classic`; the 5th switcher entry appears post-hydration (the `useMounted` idiom) — no mismatch. The compact (mobile) switcher omits the pill; the **header orb** is the mobile voice door.

**B. The Anvil header orb — the in-place Siri orb.** A small "beast" Siri-style orb in the global site header — visible on **every route and every viewport, ON by default**. Tapping it does NOT open a centered modal: like macOS Siri, it **expands in place** into a NON-MODAL panel anchored under the orb (top-right) and **starts listening immediately**. The page stays visible + interactive behind it (no overlay/takeover).
- **Build-time flag:** `NEXT_PUBLIC_ANVIL_ORB_MODE = inplace` (default) | `modal` | `off`. `inplace` = the in-place panel on desktop (mobile falls back to the centered modal — iOS Siri is itself a full-screen takeover on phones); `modal` = always the centered modal (the prior behavior — instant revert); `off` = ship dark. (The old boolean `NEXT_PUBLIC_ENABLE_ANVIL_ORB="false"` still maps to `off`.) STT-gated at runtime.
- **Beast idle orb:** a layered, multi-hued CSS orb — a hue-rotating radial core (`@property --anvil-hue`), a gentle breathe, and two violet/cyan blurred lobes drifting + screen-blended for the fluid Siri bleed (`.anvil-orb-idle`). **No WebGL, no rAF, no main-thread work** in the header (the transforms are compositor-only; the hue-rotate/blur are a small constant GPU raster cost — negligible for 28px, off the LCP element). Reduced-motion → a static (still layered) orb. ≥44px hit area (WCAG 2.5.8).
- **Non-modal a11y (hand-rolled — no Radix focus-trap):** the orb carries `aria-expanded`/`aria-controls`; the panel is a `role="region"`; focus moves into the panel on open and back to the orb on close (WCAG 2.4.3); Esc + outside-pointerdown (excluding the orb) close and **fully end the session** (stop mic + TTS); the Space turn-toggle is scoped to the panel so it never hijacks the page behind it.
- **Genie entrance:** the panel scales/fades from the orb's measured rect (Motion spring, `transform-origin: top right`; reduced-motion → opacity-only), reading as the orb blooming in place.
- **Tap = talk:** the orb tap auto-starts listening (best-effort on iOS first-grant; degrades to "paused — tap to talk", never a hot mic).
- **On the Voice view the orb is disabled** (that view is itself the live talk surface).

**The "beast" while speaking:** on desktop + WebGL + motion, a `uSpeaking` shader uniform surges the 3D orb inside the panel (more turbulence, HDR heat, rim glow, spin) while the answer is spoken. Reduced-motion / mobile / no-WebGL keep the calm 2D orb.

**One mic, always (the mutex):** the modal, the in-place panel, and the `?view=voice` view each mount their own session/mic, so a tiny arbiter (`voice-surface-mutex`) guarantees only one is open at a time — opening one closes the others (the view is excluded by routing: the orb is disabled there). **One live WebGL context** likewise: the gamified BuildGraph canvas unmounts while EITHER voice overlay is open (it reads both stores).

| Aspect | Detail |
|---|---|
| **View** | Always-on 5th switcher entry (desktop) + `?view=voice` deep link; `anvil-view.tsx` |
| **Orb** | Header, all routes/viewports, `NEXT_PUBLIC_ANVIL_ORB_MODE=inplace` (default); expands IN PLACE (desktop) / modal (mobile); auto-starts |
| **Engine** | The same `useVoiceSession` (browser Web Speech default) — one session, one mic, grounded via `/api/chat` |
| **Chips** | Ask-by-voice via `session.ask()` (one transcript); hidden when STT unsupported |
| **Idle orb** | Beast layered CSS (no WebGL/rAF in header); reduced-motion static |
| **One-mic mutex** | `voice-surface-mutex` — modal ↔ inline mutually exclusive; orb disabled on the Voice view |
| **Coexistence** | Existing modal (Chat "Talk" pill + ⌘K) is unchanged; both doors share one overlay |

### Accessibility & Browser Fallback Summary

| Feature | Chrome/Edge | Safari | Firefox | Unsupported |
|---|---|---|---|---|
| **Mic input (browser)** | ✓ | ✓ | ✗ | ✗ |
| **Mic input (AWS Transcribe)** | ✓ | ✓ | ✓ | ✗ |
| **Read-aloud** | ✓ | ✓ | ✓ | ✗ |
| **Talk mode (browser)** | ✓ | ✓ | ✗ | No-op; text chat remains |
| **Talk mode (AWS Transcribe)** | ✓ | ✓ | ✓ | No-op; text chat remains |
| **Wake word** | ✓ | ✓ | ✗ | Not available |

**Graceful degradation:** if a browser lacks support, that toggle simply does not appear in the palette. The text composer is always the fallback. If an AWS engine is selected but its route fails or is unsupported, the system transparently degrades to the browser engine (or no-op if the browser also lacks it).

### The Six Voice Palette Commands (⌘K → "Voice" group)

| ID | Label (toggles to) | Condition | Effect |
|---|---|---|---|
| `voice-talk` | `"Start voice conversation"` | STT supported AND `talkSurface === "modal"` | Opens the modal two-way talk mode; restores focus to the palette trigger on close |
| `voice-tts` | `"Read answers aloud"` ⟷ `"Turn off read-aloud"` | Browser TTS supported | Toggles `ttsEnabled` |
| `voice-engine` | `"Use higher-quality voice (Polly)"` ⟷ `"Use free browser voice"` | Browser TTS supported AND `ttsEnabled === true` | Toggles `ttsEngine` (`"polly"` ⟷ `"browser"`) |
| `voice-stt-engine` | `"Mic: use private transcription (AWS)"` ⟷ `"Mic: use browser speech"` | Always shown | Toggles `sttEngine` (`"transcribe"` ⟷ `"browser"`) |
| `voice-surface` | `"Voice as full view"` ⟷ `"Voice as modal (not full view)"` | STT supported | Toggles `talkSurface` (`"view"` ⟷ `"modal"`) |
| `voice-wake` | `"Enable wake word (Hey portfolio)"` ⟷ `"Turn off wake word"` | STT supported | Toggles `wakeWord`; if turning on, switches to the Chat view |

### Storage & Persistence

All preferences live in `localStorage` under `anvilry:voice:settings` as JSON:

```json
{
  "micEnabled": false,
  "ttsEnabled": false,
  "wakeWord": false,
  "sttEngine": "browser",
  "ttsEngine": "browser",
  "talkSurface": "modal"
}
```

- **Read on first client render** so a returning visitor's choices apply without a flash of defaults.
- **Best-effort persistence:** if localStorage is blocked (private mode, quota), prefs stay off for the session but the feature never breaks.
- **No server-side sync:** client-only; no login or account.

---

## 3. Feature Flags / Settings Reference

Voice preferences are **client-side only**, persisted in localStorage, and **all default to OFF** (or the free browser engine). Every toggle is opt-in; the text composer is always the primary channel. Availability is further gated at runtime by capability detection — a preference being "on" never overrides "this browser can't do it."

- **Storage:** `localStorage`, key `anvilry:voice:settings`
- **Hook:** `useVoiceSettings()` (from `src/lib/voice-settings-context.tsx`)
- **Access:** ⌘K → **Voice** group (commands shown only where supported)

### Settings Table

| Field | Type | Default | Description | ⌘K Command |
|---|---|---|---|---|
| `micEnabled` | `boolean` | `false` | Show the push-to-talk mic button; enable gesture-gated speech input. | Controlled indirectly via mic-button use; engine chosen by `sttEngine` toggle |
| `ttsEnabled` | `boolean` | `false` | Enable per-answer "Listen" and spoken talk-mode output. TTS-engine choice appears only when `true`. | **"Read answers aloud"** / **"Turn off read-aloud"** |
| `wakeWord` | `boolean` | `false` | Always-listening wake word ("Hey portfolio"). Highest trust cost — off by default, disclosed before arming, persistent banner + kill switch. | **"Enable wake word (Hey portfolio)"** / **"Turn off wake word"** |
| `sttEngine` | `"browser"` \| `"transcribe"` | `"browser"` | STT engine: free browser Web Speech (default) or AWS Transcribe (private, works in Firefox, no interim words). Toggle **always shown**. | **"Mic: use private transcription (AWS)"** / **"Mic: use browser speech"** |
| `ttsEngine` | `"browser"` \| `"polly"` | `"browser"` | TTS engine: free browser `speechSynthesis` (default) or AWS Polly Neural. Toggle appears only when `ttsEnabled === true`. | **"Use higher-quality voice (Polly)"** / **"Use free browser voice"** |
| `talkSurface` | `"modal"` \| `"view"` | `"modal"` | Where two-way talk mode mounts: modal overlay (default) or full-page 5th view. Toggle appears only where STT is supported. | **"Voice as full view"** / **"Voice as modal (not full view)"** |

### Feature-Detection & Runtime Gating

Each setting is independently feature-detected at render time:

- **Browser Web Speech:** `"SpeechRecognition" in window || "webkitSpeechRecognition" in window`. Absent on Firefox; present on Chrome/Edge/Safari.
- **AWS Transcribe:** requires `navigator.mediaDevices.getUserMedia` + `AudioContext` (all of Chrome/Edge/Safari/Firefox have these — this is how a Firefox visitor enables voice).
- **Browser `speechSynthesis`:** `"speechSynthesis" in window`. Universally available in modern browsers.
- **Polly TTS:** no support check (relies on the AWS API fetch); failure falls back to the browser voice.

When a setting's feature is not detected, its palette command and UI are hidden — the user never sees a no-op toggle.

### Engine Selection & Fallback

**STT (`sttEngine`):**

```
Selected: "browser"
├─ Always works (where SpeechRecognition exists)
├─ Free, client-side; interim words shown live
└─ Google cloud processing (disclosed at first mic use)

Selected: "transcribe"
├─ Supported check: navigator.mediaDevices.getUserMedia + AudioContext
├─ Used only IF supported AND no errors → AWS Transcribe (private)
├─ Unsupported OR errored (net, permission, device) → silently falls back to "browser"
├─ No interim words (full audio buffer sent on stop, then transcribed)
└─ Works in Firefox
```

**TTS (`ttsEngine`):**

```
Selected: "browser"
├─ Free, client-side speechSynthesis
└─ ~15s per-utterance cutoff (mitigated by per-sentence splits)

Selected: "polly"
├─ AWS Polly Neural via /api/tts (streaming MP3)
├─ Falls back to browser voice on fetch failure or any non-2xx response status
└─ Requires BEDROCK_ACCESS_KEY_ID + BEDROCK_SECRET_ACCESS_KEY
```

> **Polly fallback precision:** Polly falls back to the browser voice on a fetch failure (caught by the `catch` block) **or any non-2xx response status** (caught by `if (!res.ok)`). The fetch has **no explicit timeout** (no `AbortController`/timeout parameter), so a slow server response is **not** guaranteed to trigger a fallback and could hang. The guaranteed fallback paths are fetch-failure and non-2xx status.

### Palette Commands (Voice Group)

| Command ID | Label (in palette) | Condition | Action |
|---|---|---|---|
| `voice-talk` | "Start voice conversation" | Browser STT supported AND `talkSurface === "modal"` | Open the modal talk mode; restore focus to the palette trigger on close (WCAG 2.4.3) |
| `voice-tts` | "Read answers aloud" / "Turn off read-aloud" | Browser TTS supported | Toggle `ttsEnabled`; closes palette |
| `voice-engine` | "Use higher-quality voice (Polly)" / "Use free browser voice" | Browser TTS supported AND `ttsEnabled === true` | Toggle `ttsEngine` (`"polly"` ⟷ `"browser"`); closes palette |
| `voice-stt-engine` | "Mic: use private transcription (AWS)" / "Mic: use browser speech" | (always shown) | Toggle `sttEngine` (`"transcribe"` ⟷ `"browser"`); closes palette |
| `voice-surface` | "Voice as full view" / "Voice as modal (not full view)" | Browser STT supported | Toggle `talkSurface` (`"view"` ⟷ `"modal"`); closes palette |
| `voice-wake` | "Enable wake word (Hey portfolio)" / "Turn off wake word" | Browser STT supported | Toggle `wakeWord`; if turning ON, switch to the Chat view; closes palette |

### Persistence & Initialization

1. **SSR / first paint:** `getServerSnapshot()` always returns `DEFAULTS` (all off) to avoid hydration mismatch.
2. **After hydration:** `ensureHydrated()` reads localStorage exactly once (lazily), parses the JSON, and validates each field against its type. Missing/invalid keys fall back to `DEFAULTS` field-by-field (older payloads upgrade cleanly).
3. **Subsequent renders:** components subscribe via `useSyncExternalStore`; changes broadcast synchronously to all subscribers.
4. **Best-effort write:** if localStorage quota is exceeded or in private mode, the write silently fails; the setting still works in memory for the session and the hook returns `DEFAULTS` on the next visit.

**Upgrade path:** adding a new setting is migration-free — unknown keys are ignored, missing keys fall back to the `DEFAULTS` entry for that field.

### Hook API: `useVoiceSettings()`

```typescript
const { settings, set, toggle } = useVoiceSettings();

// Read
settings.micEnabled   // boolean
settings.ttsEnabled   // boolean
settings.wakeWord     // boolean
settings.sttEngine    // "browser" | "transcribe"
settings.ttsEngine    // "browser" | "polly"
settings.talkSurface  // "modal" | "view"

// Update (persists to localStorage)
set({ ttsEnabled: true, sttEngine: "transcribe" });  // partial patch
toggle("ttsEnabled");                                 // flip a boolean
```

> **Note:** `toggle()` only flips `"micEnabled" | "ttsEnabled" | "wakeWord"`. Engine/surface settings (`sttEngine`, `ttsEngine`, `talkSurface`) must be updated via `set({ ... })`.

### Testing & Debugging Helpers

```javascript
// Inspect / reset stored prefs (browser console)
JSON.parse(localStorage.getItem("anvilry:voice:settings"));
localStorage.removeItem("anvilry:voice:settings");

// Feature detection
"SpeechRecognition" in window || "webkitSpeechRecognition" in window;        // browser STT
navigator.mediaDevices?.getUserMedia && ("AudioContext" in window || "webkitAudioContext" in window); // Transcribe
"speechSynthesis" in window;                                                  // browser TTS
```

A test-only reset, `__resetVoiceSettingsForTest()`, is exported from `src/lib/voice-settings-context.tsx`.

---

## 4. Environment / IAM / Cost

The **Voice feature is entirely optional and defaults to the free browser path.** No additional environment variables, AWS permissions, or costs are incurred unless you opt into the higher-quality upgrades (Polly TTS and Transcribe STT). The feature uses the same AWS account and credentials as the main chatbot (`BEDROCK_*` vars, via `bedrockCreds()` in `src/lib/llm.ts`).

### The Free Path (Browser Speech API)

| Component | Engine | Cost | Env Vars | Fallback |
|---|---|---|---|---|
| Input (mic) | `SpeechRecognition` | Free | None | Text composer |
| Output (read-aloud) | `speechSynthesis` | Free | None | Text only |

**No environment variables, no AWS calls, no service dependencies.** `micEnabled`, `ttsEnabled`, and `wakeWord` default to `false` (localStorage key `anvilry:voice:settings`); first activation shows a privacy disclosure before the mic opens.

### Optional Upgrade 1 — AWS Polly Neural (Higher-Quality TTS)

- **What:** replaces browser `speechSynthesis` with AWS Polly Neural (voice `Joanna`, US English).
- **When used:** visitor toggles ⌘K → **"Use higher-quality voice (Polly)"** (`ttsEngine="polly"`); client calls `POST /api/tts` with one sentence (max 600 chars). Route: `src/app/api/tts/route.ts`.
- **Fails closed:** `503` if unconfigured / `502` on error → client silently falls back to `speechSynthesis`.
- **Caching:** in-process LRU (`Map`, max 100 entries) dedupes identical sentences (repeats cost zero); `Cache-Control: private, max-age=3600` + `X-TTS-Cache: hit/miss`.
- **Cost:** free tier 1M chars/month for the first 12 months; ~$16/1M chars after. Negligible at recruiter volumes (cached + rate-limited).
- **Rate limit:** shared with chat (Upstash, 8 req/min per IP).

### Optional Upgrade 2 — AWS Transcribe Streaming (Private STT)

- **What:** replaces browser `SpeechRecognition` with AWS Transcribe, processing audio on your own AWS account.
- **When used:** visitor toggles ⌘K → **"Mic: use private transcription (AWS)"** (`sttEngine="transcribe"`); client records 16-bit PCM @ 16 kHz mono and POSTs the buffer on mic-release. Route: `src/app/api/transcribe/route.ts`. Tradeoff: no interim words, but stronger privacy + works in Firefox.
- **Fails closed:** `503` if unconfigured / `502` on error → client silently falls back to `SpeechRecognition`.
- **Audio limits:** max 5 MiB per request (~2.6 min of 16 kHz mono PCM), chunked to Transcribe in 8 KB frames.
- **Cost:** ~$0.024/min of audio. Negligible at recruiter volumes.
- **Rate limit:** shared with chat (Upstash, 8 req/min per IP).

### Enabling the Upgrades

**Step 1 — Verify Bedrock creds.** Both routes use `bedrockCreds()` from `src/lib/llm.ts`:

```typescript
export function bedrockCreds() {
  return {
    accessKeyId: decodeSecret(process.env.BEDROCK_ACCESS_KEY_ID),
    secretAccessKey: decodeSecret(process.env.BEDROCK_SECRET_ACCESS_KEY),
    sessionToken: process.env.BEDROCK_SESSION_TOKEN
      ? decodeSecret(process.env.BEDROCK_SESSION_TOKEN)
      : undefined,
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
  };
}
```

Required for the main chatbot already: `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION` (preferred — avoids Vercel's reserved `AWS_REGION`). Creds may be base64-encoded or raw; the code detects and decodes base64 automatically.

**Step 2 — Add the voice IAM actions** to your existing Bedrock policy:

```json
{
  "Effect": "Allow",
  "Action": [
    "polly:SynthesizeSpeech",
    "transcribe:StartStreamTranscription"
  ],
  "Resource": "*"
}
```

Minimum full policy (Bedrock + Voice):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-opus-4-6-v1",
        "arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-sonnet-4-6",
        "arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "arn:aws:bedrock:*::foundation-model/anthropic.*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "transcribe:StartStreamTranscription"
      ],
      "Resource": "*"
    }
  ]
}
```

No new environment variables — the routes detect creds via `bedrockCreds()` and enable themselves.

**Step 3 — Smoke-test the routes.**

```bash
# Polly TTS
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world"}'
# 200 + audio/mpeg = success | 503 = not configured | 502 = error | 429 = rate-limited

# Transcribe STT (16-bit PCM @ 16 kHz raw bytes)
curl -X POST http://localhost:3000/api/transcribe --data-binary @recording.pcm
# 200 + {"transcript":"..."} = success | 503/502 = falls back to browser | 429 = rate-limited | 413 = audio > 5 MiB
```

### Rate Limiting (Shared Across Chat + Voice)

Both routes use the same Upstash limiter (`src/lib/rate-limit.ts`):

```typescript
limiter: Ratelimit.slidingWindow(8, "60 s")  // 8 requests / 60s / IP
```

**Fails open:** if `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are unset, the limiter is disabled and all requests pass; it activates automatically once the env vars are deployed — no code change.

### Behavior Summary

| Scenario | `/api/tts` Response | Client Behavior |
|---|---|---|
| Creds not configured | `503 { "error": "TTS not configured." }` | Falls back to free `speechSynthesis` |
| Over rate limit | `429 { "error": "Too many requests." }` + `Retry-After` | Waits, then retries |
| Polly error | `502 { "error": "TTS failed." }` | Falls back to free `speechSynthesis` |
| Success | `200 + audio/mpeg` (+ `X-TTS-Cache: hit/miss`) | Plays audio via `AudioContext` |

`/api/transcribe` follows the same pattern: `503` → browser STT, `502`/errors → browser STT, `429` → retry, `413` → audio too large.

### Cost Estimation

Assuming ~100 visitors/day, ~25% enabling voice, ~2 min avg session:

| Component | Monthly Volume | Monthly Cost |
|---|---|---|
| Polly (free tier, first 12 mo) | ~900k chars | $0 |
| Polly (post free-tier) | ~900k chars | ~$14.40 |
| Transcribe | ~500 min | ~$12 |
| Upstash Redis | ~2k commands/day | Free tier |

**Total:** negligible in free tier; ~$26/mo post-free-tier, exclusive to visitors who opt into voice.

### Environment Variables Reference

| Variable | Required? | When | Notes |
|---|---|---|---|
| `BEDROCK_ACCESS_KEY_ID` | Yes (any feature) | Chat + voice | Base64 or raw |
| `BEDROCK_SECRET_ACCESS_KEY` | Yes (any feature) | Chat + voice | Base64 or raw |
| `BEDROCK_REGION` | Preferred | Chat + voice | Use instead of `AWS_REGION` (reserved on Vercel) |
| `BEDROCK_SESSION_TOKEN` | No | Temporary STS creds | Optional; assumed-role workflows |
| `UPSTASH_REDIS_REST_URL` | No | Rate limiting | Fails open if absent |
| `UPSTASH_REDIS_REST_TOKEN` | No | Rate limiting | Fails open if absent |

> Aligns with `DEPLOY.md` §3 (minimum AWS IAM policy) and §3.1 (optional voice upgrades): full Bedrock policy + resource ARNs, Upstash setup, and smoke-test steps.

### Disabling Voice Entirely

1. Remove the **"Voice"** group from `src/components/command-palette.tsx`.
2. `return null` at the top of `src/components/chat/mic-button.tsx`.
3. `return null` at the top of `src/components/chat/read-aloud-button.tsx`.
4. `return null` at the top of `src/components/chat/talk-launch-button.tsx`.

No environment changes needed — the toggles simply cease to exist for visitors.

---

## 5. Privacy & Accessibility

### Privacy Model

**Microphone activation (gesture-gated, never on load).** The voice layer never accesses the mic without an explicit user gesture. `navigator.mediaDevices.getUserMedia()` is called synchronously in response to a user action (mic-button click, wake-word "Enable listening", or entering talk mode and speaking) — never on mount or in an effect. The OS-level "is using microphone" indicator then shows, and access is revocable via browser settings.

**Cloud-audio disclosure (engine-dependent).** Before any voice input leaves the browser, a one-time consent dialog describes where the audio goes. The wording differs by engine:

- **Browser STT** (`mic-button.tsx`): *"Voice is optional. Your browser (Chrome/Safari) may send the audio to Google or Apple to turn speech into text. Nothing is recorded or stored here."* Shown on the first mic-button click; the persisted `micEnabled` flag short-circuits it afterward.
- **AWS Transcribe STT** (`mic-button.tsx`): *"Voice is optional. Your speech is transcribed on Sairam's own AWS — not a third party — and nothing is stored."* Enables voice where browser Web Speech is off-by-default (Firefox); falls back silently to browser STT if `/api/transcribe` errors or is unconfigured.
- **Wake word** (`wake-word-controller.tsx`): *"Always-listen for 'Hey portfolio'? While on, your microphone stays active on this view and your browser (Chrome/Safari) streams the audio to its speech service to detect the phrase. Nothing is recorded or stored here. A 'Listening' bar stays visible the whole time, and you can stop with one tap."* Shown as a bottom-center dialog the first time the pref is enabled per session; scoped to Chat/Voice views (`ACTIVE_VIEWS`).

**Microphone release & kill.** One-tap stop releases the mic and clears the OS recording indicator. Browser STT (`use-speech-recognition.ts`) calls `track.stop()` on a sibling getUserMedia stream held purely for the indicator; Transcribe (`use-transcribe-recognition.ts`) stops the `ScriptProcessor`, closes the `AudioContext`, and stops all tracks; wake word (`use-wake-word.ts`) calls `disarm()` (`track.stop()` + `rec.abort()`); talk mode closes via `disarm()` from `talk-overlay-store.ts`. **No audio is stored server-side** — `/api/transcribe` receives raw PCM, returns the transcript, and discards the audio.

**Wake word — off by default, disclosed & killable.** `DEFAULTS.wakeWord = false`. Toggling on requires an explicit flip + a cloud-audio disclosure gate; a persistent, non-color-only banner (`Listening for "Hey portfolio"` + Ear icon + pulsing dot per WCAG 1.4.1) is shown while listening; the Stop button calls `disarm()` immediately; the mic is active only on Chat/Voice views; phrases matched: `["hey portfolio", "hey sairam", "ask my portfolio", "hey anvil"]`.

**No new vendor.** Voice uses only the existing Bedrock credentials. Optional upgrades stay within the same AWS account: Polly Neural TTS (IAM `polly:SynthesizeSpeech`) and Transcribe STT (IAM `transcribe:StartStreamTranscription`). See `bedrockCreds` in `src/lib/llm.ts` and IAM templates in `DEPLOY.md`.

### Accessibility Model

**Text always available (voice is additive).** No voice capability, voice not yet enabled, or voice unsupported → the text composer is unchanged and voice buttons hidden. Voice enabled and supported → composer + mic + read-aloud appear.

**Feature detection & graceful degradation:**

| Hook | Detection | Fallback |
|---|---|---|
| `useSpeechRecognition()` | `window.SpeechRecognition` / `webkitSpeechRecognition` | Mic button hides on Firefox (unless Transcribe is available) |
| `useTranscribeRecognition()` | `navigator.mediaDevices.getUserMedia()` + `AudioContext` | Enabled in Firefox; any error (permission/no-device/route 503) degrades to browser STT silently |
| `useSpeechSynthesis()` | `window.speechSynthesis` + `SpeechSynthesisUtterance` | Read-aloud button hidden |
| `useWakeWord()` | `window.SpeechRecognition` / `webkitSpeechRecognition` | Wake-word toggle hidden; pref ignored |

**No double-speak (aria-live reconciliation).** When TTS reads an answer aloud, the `useChatA11y` hook receives `disableLiveAnnounce = true` and announces only a short status (`"Speaking answer aloud."`) instead of the full text — so a screen-reader user hears the synthetic voice plus a status, not the answer twice. Passed from `ChatMessages` when "Listen" is toggled and `isSpeaking === true`.

**ARIA & semantic HTML:**

| Component | ARIA / HTML |
|---|---|
| Mic button | `aria-pressed={isListening}` ("Ask by voice" ⟷ "Stop listening"); `aria-haspopup="dialog"` for the disclosure |
| Read-aloud button | `aria-pressed={speaking}` ("Listen" ⟷ "Stop") |
| Wake-word banner | `role="status"` + `aria-live="polite"`, announces `Listening for "Hey portfolio"` |
| Disclosure dialogs | `role="dialog"` + `aria-modal="false"` (non-modal popovers) with descriptive `aria-label` |
| Talk-mode modal | Radix `Dialog.Root` focus trap + Esc; `sr-only` Title/Description; focus lands on the primary button on open and is restored to the opener on close via `onCloseAutoFocus` + the `getOpener` prop |

**Icon swaps (not color-only, WCAG 1.4.1):** mic button `<Mic>`/`<MicOff>` → `<Square>` + pulsing dot; read-aloud `<Volume2>` "Listen" → `<Square>` "Stop"; wake banner pulsing dot + `<Ear>` icon + text + Stop button.

**Keyboard operability:** mic and read-aloud buttons toggle on `Enter`/`Space`; the talk modal uses `Space` to toggle the turn and `Esc` to close (with a focus trap); the wake banner's Stop is `Tab`-reachable and activates on `Enter`; the command palette opens with `⌘K`, navigates with arrows, runs with `Enter`, closes with `Esc`.

**Reduced motion:** pulsing dots and the talk-mode orb animation are skipped/static under `prefers-reduced-motion`.

**Focus management.** Talk-mode modal: full Radix focus trap; on open, focus moves to the primary mic/start button; on close (Esc or explicit), focus restores to the opener via `onCloseAutoFocus` calling `getOpener?.()` (`talk-mode-overlay.tsx`). Disclosure popovers are non-modal with clearly labeled buttons.

**Live region announce-on-settle.** `useChatA11y()` manages an `aria-live="polite"` region: `"Answering…"` while streaming, the full final answer after the stream settles (debounced ~150ms), or `"Speaking answer aloud."` when TTS is active — never per-token noise, never a double-read.

**Incremental speech (streaming TTS).** `useSpeechSynthesis()` exposes `speakChunk()` called on each streamed token; `splitSentences()` queues only complete sentences (trailing partials wait for finalization); per-sentence utterances stay short enough to dodge Chromium's ~15s cutoff, and on desktop (not Android) a keep-alive pauses/resumes every ~12s to reset the timer.

---

## 6. Developer Notes

### Test Infrastructure

Vitest with two project environments (`vitest.config.ts`):

| Project | Environment | Files | Purpose |
|---|---|---|---|
| **node** | Node.js | `src/**/*.test.{ts,tsx}` (excludes `*.dom.test.*`) | Pure logic: settings parsing, engine selection, error handling |
| **dom** | happy-dom | `src/**/*.dom.test.{ts,tsx}` | React integration: hooks, components, event handlers, stubbed browser APIs |

Idioms: `NODE_ENV=test` forces React's test-only `act`; `tsconfigPaths: true` resolves `@/*` and `.velite` imports against real shipping code; tests are chained into `pnpm build`, so failures fail the deploy.

### Voice Test Suite

| Area | File | Proves |
|---|---|---|
| Settings parsing | `src/lib/voice-settings-context.test.ts` | `DEFAULTS` all OFF / browser; `parse()` never throws on null/malformed JSON; partial/older payloads upgrade field-by-field; invalid enums coerce to safe defaults |
| Speech recognition | `src/components/chat/use-speech-recognition.dom.test.tsx` | Honest `supported`; mic opens only on `start()`; interim vs final results; track released on `stop()`; `NotAllowedError` → `error: "denied"` without hanging |
| Transcribe STT selector | `src/components/chat/use-stt.dom.test.tsx` | Both hooks always called (Rules of Hooks); `useStt("transcribe")` returns Transcribe only if `supported && !error`, else falls back to browser; non-selected engine stays idle |
| TTS | `src/components/chat/use-speech-synthesis.dom.test.tsx` | `splitSentences()` behavior + over-long chunk cap; `speakChunk()` enqueues only new complete sentences; per-sentence start; `cancel()` kills synchronously |
| Mic button | `src/components/chat/mic-button.dom.test.tsx` | Renders nothing when unsupported; first activation shows disclosure (mic NOT opened); "Use microphone" accepts + persists + opens; "Not now" dismisses; second activation skips disclosure; `aria-pressed` correct |
| Talk-mode state machine | `src/components/chat/use-voice-session.dom.test.tsx` | `start` → listening; final transcript → `chat.send()` → thinking; mic stops before `synth.speak()` (no self-hearing); re-arm after speech; `interrupt()` barges in; `stop()` tears down; `supported:false` → no-op |
| Talk mode UI | `src/components/chat/talk-mode.dom.test.tsx` | Unsupported → "type instead"; label mapping per state; live caption + latest answer caption; Esc closes; End stops + closes |
| Wake word | `src/components/chat/wake-word-controller.dom.test.tsx` | Off → renders nothing; ON → disclosure (mic NOT armed); accept arms + banner; Cancel turns pref off; not armed on non-voice views; Stop disarms + hides |
| Chat a11y | `src/components/chat/use-chat-a11y.dom.test.tsx` | Streaming → "Answering…"; settled + TTS off → full text; settled + TTS on → status only; mid-answer TTS-on flips full→status |

### Adding a New TTS Engine

`useSpeechSynthesis(engine: TtsEngine)` (`src/components/chat/use-speech-synthesis.ts`) branches inside `speak()`/`speakChunk()` on `engine`; callers stay engine-agnostic.

1. Extend the type: `export type TtsEngine = "browser" | "polly" | "eleven-labs";`
2. Update the guard in `src/lib/voice-settings-context.tsx`: `isTtsEngine(v) => v === "browser" || v === "polly" || v === "eleven-labs"`.
3. Add engine logic in `speak()`/`speakChunk()` (fetch audio, play via `HTMLAudioElement` like Polly).
4. Create the route `src/app/api/tts-elevenlabs/route.ts` — same contract as `/api/tts` (`POST { text }` → `audio/mpeg`), fail-closed (errors → browser TTS), rate-limited via `checkRateLimit(req)`.
5. Add a palette toggle in `command-palette.tsx` (UI is already engine-agnostic).
6. Add a `useStt`-style test case proving fallback to browser TTS on error.

### Adding a New STT Engine

`useStt(engine: SttEngine)` (`src/components/chat/use-stt.ts`) selects the engine; both child hooks are always called (Rules of Hooks):

```typescript
export function useStt(engine: SttEngine = "browser"): UseSpeechRecognition {
  const browser = useSpeechRecognition();
  const transcribe = useTranscribeRecognition();
  if (engine === "transcribe" && transcribe.supported && !transcribe.error) {
    return transcribe;
  }
  return browser;
}
```

1. Create `src/components/chat/use-deepgram-recognition.ts` returning the unified `UseSpeechRecognition` shape (SSR-safe `supported` via `useSyncExternalStore`; `start(onFinal)`; `stop()` releases the track + POSTs audio; errors surfaced as state, never thrown).
2. Extend `SttEngine` and add a guarded branch in `useStt`.
3. Create `src/app/api/deepgram/route.ts` — `POST` 16-bit PCM @ 16 kHz, return `{ transcript }`, fail-closed, rate-limited.
4. Update the `isSttEngine` guard in `voice-settings-context.tsx`.
5. Add a `use-stt.dom.test.tsx` case proving fallback on unsupported/error.

### SSR Safety Idiom: `useSyncExternalStore`

A naive `useState(getSupported)` causes a hydration mismatch (server `false`, client `true`). All three voice hooks (`use-speech-recognition.ts`, `use-transcribe-recognition.ts`, `use-wake-word.ts`) instead use `useSyncExternalStore` with a server snapshot that always returns `false` and a client snapshot that checks the browser API after hydration:

```typescript
const supported = useSyncExternalStore(
  noopSubscribe,
  getSupportedClient,  // typeof window !== "undefined" && "SpeechRecognition" in window
  getSupportedServer,  // () => false
);
```

Server + first-client snapshots match (`false`); after hydration the client snapshot re-renders if it differs. Never set support in a `useEffect` (flash + race).

### No-New-Vendor Principle

The two AWS routes reuse the same Bedrock credentials to avoid vendor sprawl.

`src/app/api/tts/route.ts`:
```typescript
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { bedrockCreds } from "@/lib/llm";
const { accessKeyId, secretAccessKey, sessionToken, region } = bedrockCreds();
client = new PollyClient({ region: region || REGION_FALLBACK, credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } });
```

`src/app/api/transcribe/route.ts`:
```typescript
import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";
import { bedrockCreds } from "@/lib/llm";
const { accessKeyId, secretAccessKey, sessionToken, region } = bedrockCreds();
client = new TranscribeStreamingClient({ region: region || "us-east-1", credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } });
```

If the site has `BEDROCK_*` creds, both Polly and Transcribe work automatically; if not, they fail gracefully to the browser path.

### Wake-Word Engine Upgrade Path

Currently browser `SpeechRecognition` in continuous mode (`src/components/chat/use-wake-word.ts`). The interface is engine-agnostic:

```typescript
export type UseWakeWord = {
  supported: boolean;
  listening: boolean;
  arm: (onDetect: () => void) => void;
  disarm: () => void;
};
```

A future on-device `openWakeWord` ONNX model is a drop-in: load it in an `AudioWorklet`, wire `arm()`/`disarm()` to start/stop the worklet, keep `supported = false` where unavailable, emit `onDetect()` on a local match, and never open the mic unless armed. **No UI changes** — the existing banner, toggle, and disclosure all work unchanged; only the hook internals swap.

### Running the Tests

```bash
pnpm test                                          # all (node + dom)
pnpm test --project=node                           # pure logic (fast)
pnpm test --project=dom                            # hooks + components
pnpm test src/lib/voice-settings-context.test.ts   # single file
pnpm test --watch                                  # watch mode
pnpm test --coverage                               # coverage
```

All tests must pass before deploy (enforced in the build script).

### Debugging Locally

```javascript
// Inspect settings
JSON.parse(localStorage.getItem("anvilry:voice:settings"));
// Simulate unsupported engine (block the mic button)
vi.stubGlobal("navigator", { mediaDevices: undefined });
```

To force the STT fallback path during debugging, temporarily `return browser;` in `useStt` (`src/components/chat/use-stt.ts`). The selector's fallback is silent by design; add a `console.log` in each branch if you need to trace engine selection.

---

## 7. Voice picker (v1.7)

The voice picker is the visible upgrade in v1.7. One curated set of 6 voices (with a 12+ extended overflow), three TTS engines (browser / Polly / Google), and three surfaces (talk-mode header, ⌘K palette, settings dialog) — all sharing one source of truth.

### Catalog

Defined in `src/lib/voice-catalog.ts`. The catalog is the single source of truth for which voices Anvilry exposes and which engine each voice belongs to. **Curated** voices show in the default picker grid; **extended** voices live in the "More voices…" overflow dialog.

| Tier | Voice | Gender | Engine | Native id |
|---|---|---|---|---|
| Curated | Joanna | F | Polly Neural | `Joanna` |
| Curated | Matthew | M | Polly Neural | `Matthew` |
| Curated | Stephen | M | Polly Generative | `Stephen` |
| Curated | Ruth | F | Polly Generative | `Ruth` |
| Curated | Aoede | F | Google Chirp 3 HD | `en-US-Chirp3-HD-Aoede` |
| Curated | Charon | M | Google Chirp 3 HD | `en-US-Chirp3-HD-Charon` |
| Extended | Danielle, Gregory | F/M | Polly Neural (US) | — |
| Extended | Brian, Amy, Olivia | M/F/F | Polly Neural (UK/AU) | — |
| Extended | Puck, Kore, Fenrir | M/F/M | Google Chirp 3 HD | — |
| Extended | Aria, Guy (Edge) | F/M | Browser (Microsoft Online Natural) | voiceURI prefix |
| Extended | Samantha, Tom (Apple) | F/M | Browser (Apple Premium) | voiceURI prefix |

Default per gender preference: Joanna (female / unspecified) and Matthew (male) — `getDefaultVoiceId()`.

### Engines

Three engines, all server-proxied (CSP-safe):

- **Browser** (`window.speechSynthesis`) — free, no network, default for visitors who never pick. Voice resolution uses `voiceURI` prefix matching (catalog's `findBrowserVoice`) so macOS-localized + Linux speech-dispatcher-modified URIs resolve correctly. Curated voices that aren't on the visitor's device silently fall back to the localService English heuristic (Apple Premium gets a "Download in System Settings" hint per card).

- **Polly** (`/api/tts`) — two tiers picked from the catalog:
  - Polly **Neural** — historical default (Joanna). Free 1M chars/mo for first 12 months, then $16/M. Cache-keyed isolation guarantees cross-voice safety (the v1.7 fix for the latent v1.6 cache bug).
  - Polly **Generative** — premium tier (Stephen, Ruth, Danielle). $30/M with 100k chars/mo free for year 1. Reachable ONLY via user-pick on a Generative-supported voice; unknown voiceId or tier mismatches reject 400 (impossible to send Joanna+generative).
  - SSML prosody (`<prosody rate>`, `<prosody pitch>`, `<break time>`) supported on Neural; rejected on Generative (the hook silently strips character knobs on Generative).

- **Google Cloud TTS** (`/api/tts-google`) — Chirp 3 HD voices. **Permanent free tier 1M chars/mo** (vs Polly's 12-month limit). Set `GOOGLE_TTS_API_KEY` to enable; when unset, the engine option is hidden from settings and the route returns 503 (client falls back to Polly → browser). Uses the REST API directly (not `@google-cloud/text-to-speech` SDK) to keep the Vercel function bundle small.

### Surfaces

Same `<VoicePicker>` component, three mounting points:

1. **Talk-mode header label** — compact "Voice: Stephen ▾" pill below the controls. The most discoverable surface for visitors who've already opened TalkMode. Click opens the picker as a Radix Dialog.

2. **⌘K palette** — `Pick voice…` opens the dialog; six `Voice: <Name>` quick-swap commands set `voiceId` directly without opening the dialog (searchable on name + descriptor + accent + gender + tier — typing `stephen`, `warm`, `generative`, `polly` all surface Stephen). `Voice settings…` opens the canonical settings dialog.

3. **Settings dialog** (`voice-settings-dialog.tsx`) — the only surface that exposes the full character knobs. Five sections: Voice (embeds the picker inline), Engine (radio with cost transparency hints + platform advisories), Character (segmented controls auto-disabled when the engine ignores them), Toggles (read-aloud / captions / mic / wake word), Reset.

### Layout modes (`NEXT_PUBLIC_VOICE_PICKER_MODE`)

The picker has two layouts, switchable via build-time env flag:

- **`descriptor`** (DEFAULT) — modern named cards in a responsive grid. Each card: voice name, 2-word descriptor, accent + engine badge, tap-to-preview button. The ChatGPT/Siri pattern.
- **`gender`** — explicit Male / Female columns with cards stacked under each gender. Same data, regrouped.

Both modes share the catalog; only the rendered grouping differs.

### Voice character (speed / tone / pause)

Cross-engine character knobs in `VoiceSettings.voiceCharacter`:

| Knob | Values | Browser map | Polly Neural map | Generative / Google |
|---|---|---|---|---|
| `speed` | slow / natural / fast | `rate` 0.85 / 1.0 / 1.15 | `<prosody rate>` | dropped |
| `tone` | warm / neutral / crisp | `pitch` 0.95 / 1.0 / 1.10 | `<prosody pitch>` | dropped |
| `pause` | spacious / normal / tight | sentence padding | `<break time>` | dropped |

Defaults: `{ natural, neutral, normal }` — matches v1.6's hardcoded `rate=1, pitch=1, no padding`. Knobs are dropped (not 5xx-rejected) on Generative + Google because those engines reject most prosody tags.

### Pitfall hardening (16 documented landmines)

`src/components/chat/voice-pitfalls.ts` contains small isolated utilities for the documented platform pitfalls. The highest-impact ones surface in the picker / settings UI as contextual advisories rather than silent failures:

| # | Pitfall | Workaround | Surfaced in |
|---|---|---|---|
| 1 | SR + read-aloud double-speak | `detectScreenReader` heuristic; DEFAULTS.ttsEnabled stays false; caption `aria-hidden` while speaking | settings (default-OFF invariant), TalkMode (caption) |
| 2 | iOS Safari user-gesture lock | `isIOS` detection; first-run primer card surfaces the picker affordance | TalkMode primer |
| 3 | Linux eSpeak-only | `isLinuxESpeak` voice-list pattern detection | settings (browser engine disabled with reason) |
| 4 | `voice.gender` deprecated | `voiceURIToGender` curated allow-list (16 known prefixes) | catalog resolution |
| 5 | Locale fallback chain | `localeFallbackChain` (en-IN → en-GB → en-AU → en-US) | hook voice resolution |
| 6 | Apple Premium not on disk | `applePremiumIsMissing(prefix, voices)` | picker (per-card hint) |
| 7 | `getVoices()` race | `getVoicesRaceHardened` (sync read + voiceschanged + 2s timeout) | picker, settings dialog |
| 8 | Blob URL lifecycle leaks | `cancelRemote` token-invalidation + revokeObjectURL on `error` / `play().catch()` / `cancel()` paths | hook |
| 9 | Chromium ~15s SpeechSynthesis cutoff | `startKeepAlive` pause/resume every 12s (desktop only — Android pause = cancel) | hook (existing v1.6) |
| 10 | Bluetooth switch decode error | (deferred to v1.7.1) | — |
| 11 | Tab background dump | `visibilitychange` cancels speech | hook (existing v1.6) |
| 12 | Android Chrome quality cliff | `isAndroid` UA detection | settings (browser engine advisory) |
| 13 | Firefox Linux + eSpeak | `isFirefox` + `isLinuxESpeak` composition | settings (specific reason text) |
| 14 | macOS / Linux URI mangling | `normalizeVoiceURI` + voiceURI-prefix resolution | catalog `findBrowserVoice` |
| 15 | Polly cold-start latency | (deferred — first-utterance warmup) | — |
| 16 | Cross-engine fallback cascade | hook's `playRemoteFrom` → browser path on any remote failure | hook (`use-speech-synthesis.ts`) |

### File map (v1.7 additions)

| Concern | File |
|---|---|
| Voice catalog (source of truth) | `src/lib/voice-catalog.ts` |
| Picker mode flag | `src/lib/voice-picker-mode.ts` |
| Pitfall utilities | `src/components/chat/voice-pitfalls.ts` |
| Picker UI | `src/components/chat/voice-picker.tsx` |
| Settings dialog | `src/components/chat/voice-settings-dialog.tsx` |
| Polly cache (lifted from route.ts) | `src/app/api/tts/cache.ts` |
| Google Cloud TTS route | `src/app/api/tts-google/route.ts` |
| Google Cloud TTS cache | `src/app/api/tts-google/cache.ts` |
