---
kind: doc
title: Components — Chat & Voice Surface
domain: [content]
status: current
version: v3.6.0
---

# Components — Chat & Voice Surface

> Part of the Anvilry v3.6.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `src/components/chat/**` (all non-test files) + `src/components/ask-portfolio.tsx`
**Files indexed:** 39

Excluded (tests, not indexed here — mapped to the module each guards in the table below):
`anvil-inline-panel.dom.test.tsx`, `markdown-message.test.ts`, `mic-button.dom.test.tsx`,
`parse-cards.test.ts`, `talk-mode.dom.test.tsx`, `use-chat-a11y.dom.test.tsx`,
`use-chat-stream.dom.test.tsx`, `use-chat.test.ts`, `use-speech-recognition.dom.test.tsx`,
`use-speech-synthesis.dom.test.tsx`, `use-stt.dom.test.tsx`, `use-voice-session.dom.test.tsx`,
`voice-picker.dom.test.tsx`, `voice-pitfalls.test.ts`, `voice-pitfalls.dom.test.ts`,
`voice-surface-mutex.test.ts`, and `src/components/ask-portfolio.dom.test.tsx`.

> There is **no** `use-chat-stream.ts` module. `use-chat-stream.dom.test.tsx` imports `./use-chat`
> (`use-chat-stream.dom.test.tsx:3`) — it is the streaming/coalescing guard for `use-chat.ts`.

## At a glance

| File | Role | Key exports | Guarded by |
|---|---|---|---|
| `chat/use-chat.ts` | Shared `/api/chat` streaming transport: message list, rAF-coalesced writes, thinking-phase timing, abort | `ChatRole`, `FileUIPart`, `ChatMessage`, `ChatStatus`, `useChat` | `use-chat.test.ts`, `use-chat-stream.dom.test.tsx` |
| `chat/use-chat-a11y.ts` | Single `aria-live` announce-on-settle string; suppressed to a status line while TTS speaks | `useChatA11y` | `use-chat-a11y.dom.test.tsx` |
| `chat/parse-cards.ts` | Splits assistant text into text / card / cmd segments; resolves slugs against the Velite allowlist (fail-closed) | `CardSegment`, `parseCards`, `hasCardToken`, `CMD_RE` | `parse-cards.test.ts` |
| `chat/markdown-message.tsx` | Safe markdown renderer (react-markdown + `skipHtml` + rehype-sanitize) plus a streaming delimiter balancer | `closeOpenMarkdown`, `MarkdownMessage` | `markdown-message.test.ts` |
| `chat/chat-card.tsx` | Renders a resolved project/work card entirely from Velite fields | `ChatCard` | — |
| `chat/chat-messages.tsx` | Full transcript renderer: image lightbox, thinking block, model badge, read-aloud, cmd-token dispatch, autoscroll | `ChatMessages` | — |
| `chat/chat-view.tsx` | The `chat` view "concierge console": impact strip, chip rails, composer, mic, file picker, Stop | `ChatView` | — |
| `chat/chat-suggestions.ts` | Static chip prompt arrays for the Chat view | `RECRUITER_CHIPS`, `STARTER_CHIPS` | — |
| `chat/attachment-preview-strip.tsx` | Pending-attachment thumbnails/badges above the composer with per-item remove | `AttachmentPreviewStrip` | — |
| `chat/file-picker-button.tsx` | Flag-gated attachment picker: base64 for images, pdf.js text extraction for PDFs, type+size validation | `FilePickerButton` | — |
| `chat/mic-button.tsx` | Push-to-talk composer mic with first-use privacy disclosure gate | `MicButton` | `mic-button.dom.test.tsx` |
| `chat/read-aloud-button.tsx` | Presentational per-answer Listen/Stop toggle | `ReadAloudButton` | — |
| `chat/use-stt.ts` | STT engine selector (browser vs AWS Transcribe) with runtime degrade-to-browser | `SttEngine`, `useStt` | `use-stt.dom.test.tsx` |
| `chat/use-speech-recognition.ts` | Web Speech API push-to-talk STT + sibling `getUserMedia` mic-live handle | `SpeechErrorKind`, `UseSpeechRecognition`, `useSpeechRecognition` | `use-speech-recognition.dom.test.tsx` |
| `chat/use-transcribe-recognition.ts` | AWS Transcribe STT: 16-bit PCM @16 kHz capture, POST to `/api/transcribe` on stop | `useTranscribeRecognition` | — |
| `chat/use-speech-synthesis.ts` | Three-engine TTS (browser / polly / google) with per-sentence queue, streaming `speakChunk`, fallback cascade | `splitSentences`, `TtsEngine` (re-export), `UseSpeechSynthesisOptions`, `UseSpeechSynthesis`, `useSpeechSynthesis` | `use-speech-synthesis.dom.test.tsx` |
| `chat/use-voice-session.ts` | Turn-based half-duplex talk state machine over `useChat` + STT + TTS; derived state, no stored turn state | `VoiceSessionState`, `toCaptionText`, `useVoiceSession` | `use-voice-session.dom.test.tsx` |
| `chat/use-voice-level.ts` | Synthetic per-state 0..1 amplitude envelope in a ref, driven by rAF | `useVoiceLevel` | — |
| `chat/use-wake-word.ts` | Opt-in continuous "Hey portfolio" wake-word engine with self re-arm | `UseWakeWord`, `useWakeWord` | — |
| `chat/wake-word-controller.tsx` | Wake-word disclosure gate + mandatory persistent "Listening" banner; Chat-view-scoped | `WakeWordController` | `wake-word-controller.dom.test.tsx` |
| `chat/talk-mode.tsx` | The shared voice surface UI (orb, captions, controls, primer, Chrome-TTS banner) over `useVoiceSession` | `TalkMode` | `talk-mode.dom.test.tsx` |
| `chat/talk-mode-overlay.tsx` | Radix Dialog modal wrapper for `TalkMode` with focus restore | `TalkModeOverlay` | — |
| `chat/talk-mode-mount.tsx` | Single global mount of the modal, wired to `talk-overlay-store` | `TalkModeMount` | — |
| `chat/talk-launch-button.tsx` | Chat-view "Talk" entry point; renders only when STT supported and `talkSurface === "modal"` | `TalkLaunchButton` | — |
| `chat/talk-overlay-store.ts` | Module store for the modal surface (open flag + opener element) | `openTalkMode`, `setTalkModeOpen`, `getTalkOpener`, `useTalkModeOpen` | `voice-surface-mutex.test.ts` (indirect) |
| `chat/anvil-inline-store.ts` | Module store for the non-modal inline panel surface | `openInlineVoice`, `setInlineVoiceOpen`, `getInlineVoiceOpener`, `useInlineVoiceOpen` | `anvil-inline-panel.dom.test.tsx` |
| `chat/anvil-inline-panel.tsx` | The Siri-style in-place disclosure panel anchored under the header orb; hosts `TalkMode autoStart` | `AnvilInlinePanel` | `anvil-inline-panel.dom.test.tsx` |
| `chat/anvil-core-store.ts` | Module store for the orb-only CORE surface | `openCoreVoice`, `setCoreVoiceOpen`, `getCoreVoiceOpener`, `useCoreVoiceOpen` | `voice-surface-mutex.test.ts` |
| `chat/anvil-core-surface.tsx` | Minimal orb-only voice surface: enlarged orb + frosted answer card, no chrome | `AnvilCoreSurface` | — |
| `chat/anvil-view.tsx` | The `?view=voice` ("Anvil") view: hero copy + prompt chips wrapped around `TalkMode` | `AnvilView` | — |
| `chat/header-orb-trigger.tsx` | Persistent header orb button; routes to core / inline / modal per build flags + viewport | `HeaderOrbTrigger` | — |
| `chat/voice-surface-mutex.ts` | The one-mic arbiter: surfaces register force-close callbacks; `claimVoiceSurface` closes all others | `VoiceSurfaceId`, `registerVoiceSurface`, `claimVoiceSurface` | `voice-surface-mutex.test.ts` |
| `chat/voice-orb.tsx` | Capability-tiered orb selector (R3F 3D on desktop+WebGL+motion, else 2D canvas) | `VoiceOrb` | — |
| `chat/voice-orb-canvas.tsx` | Universal 2D-canvas orb; static ring under reduced motion | `VoiceOrbCanvas` | — |
| `chat/voice-orb-3d.tsx` | R3F GLSL "Siri orb": fBm domain-warped icosahedron, halo shell, optional post-FX, `errorMode` palette | `VoiceOrb3D` | — |
| `chat/voice-picker.tsx` | Shared voice picker (inline block or Radix dialog) with tap-to-preview and "More voices…" overflow | `VoicePickerProps`, `VoicePicker` | `voice-picker.dom.test.tsx` |
| `chat/voice-settings-dialog.tsx` | Canonical voice settings dialog: picker + engine radios + character segments + toggles + reset | `VoiceSettingsDialogProps`, `VoiceSettingsDialog` | — |
| `chat/voice-pitfalls.ts` | Small independent workarounds for documented browser voice landmines + first-run primer storage | `detectScreenReader`, `isIOS`, `isLinuxESpeak`, `voiceURIToGender`, `localeFallbackChain`, `applePremiumIsMissing`, `getVoicesRaceHardened`, `normalizeVoiceURI`, `isAndroid`, `isFirefox`, `FIRST_RUN_PRIMER_STORAGE_KEY`, `hasSeenFirstRunPrimer`, `markFirstRunPrimerSeen` | `voice-pitfalls.test.ts`, `voice-pitfalls.dom.test.ts` |
| `ask-portfolio.tsx` | Floating "Ask my portfolio" widget, hidden on the `chat` view, remounted per view | `AskPortfolio` | `ask-portfolio.dom.test.tsx` |

## Store & hook map

### Module-level external stores (all four are plain module state + `useSyncExternalStore`, **not** zustand)

| Store | State shape | Mutators | Readers | Server snapshot |
|---|---|---|---|---|
| `talk-overlay-store.ts` | `open: boolean`, `opener: HTMLElement \| null` (module-scope, `talk-overlay-store.ts:17-18`) | `openTalkMode(triggerEl?)` (:30), `setTalkModeOpen(next)` (:38); force-close registered as `"modal"` (:46) | `useTalkModeOpen()` (:54), `getTalkOpener()` (:49). Called by `command-palette-content.tsx:427`, `talk-launch-button.tsx:33`, `header-orb-trigger.tsx:76`, `wake-word-controller.tsx:51`, `game/build-graph.tsx:11` | `false` (:57) |
| `anvil-inline-store.ts` | `open: boolean`, `opener: HTMLElement \| null` (:18-19) | `openInlineVoice(triggerEl?)` (:31), `setInlineVoiceOpen(next)` (:39); registered as `"inline"` (:47) | `useInlineVoiceOpen()` (:55), `getInlineVoiceOpener()` (:50). Called by `header-orb-trigger.tsx:74`, `anvil-inline-panel.tsx`, `game/build-graph.tsx:12` | `false` (:59) |
| `anvil-core-store.ts` | `open: boolean`, `opener: HTMLElement \| null` (:15-16) | `openCoreVoice(triggerEl?)` (:22), `setCoreVoiceOpen(next)` (:30); registered as `"core"` (:44) | `useCoreVoiceOpen()` (:40), `getCoreVoiceOpener()` (:36). Called by `header-orb-trigger.tsx:73`, `anvil-core-surface.tsx`, `game/build-graph.tsx:13` | `false` (:41) |
| `voice-surface-mutex.ts` | `closers: Map<VoiceSurfaceId, () => void>` where `VoiceSurfaceId = "modal" \| "inline" \| "core"` (:23-25) | `registerVoiceSurface(id, close)` returns an unregister fn (:28); `claimVoiceSurface(id)` (:40) | The three stores above only — nothing else imports it | n/a (no React state) |

Notes:
- Each `open*` mutator calls `claimVoiceSurface` **before** touching local state, and returns early if
  already open — but it always refreshes `opener` first (`anvil-core-store.ts:22-28`), so re-clicking a
  different trigger while open updates the focus-restore target.
- `registerVoiceSurface` runs at **module scope** (`talk-overlay-store.ts:46`) — one registration per
  app lifetime, deliberately not in an effect.
- Persisted voice preferences are **not** in this scope: they live in `src/lib/voice-settings-context.tsx`
  (`DEFAULTS` = `micEnabled:false, ttsEnabled:false, wakeWord:false, captions:true, sttEngine:"browser",
  ttsEngine:"browser", talkSurface:"modal"`, `voice-settings-context.tsx:78-84`).

### Hooks

| Hook | Signature | Side effects | Cleanup |
|---|---|---|---|
| `useChat()` | `() => { messages, status, send(text, files?), stop(), reset(), isStreaming, pendingFiles, setPendingFiles }` | `fetch("/api/chat", POST)` with `AbortController`; `requestAnimationFrame` + `setTimeout(250ms)` flush schedulers; `URL.revokeObjectURL` on `reset()` | `useEffect` on unmount cancels the pending rAF + safety timer (`use-chat.ts:245-251`); `finally` nulls `abortRef` (:381) |
| `useChatA11y(messages, isStreaming, disableLiveAnnounce = false)` | `→ { liveMessage: string }` | One `setTimeout` per state change (0 ms while streaming, 150 ms on settle) — never a synchronous setState in the effect body | Effect return clears the timer (`use-chat-a11y.ts:46-48`) |
| `useSpeechRecognition()` | `→ UseSpeechRecognition { supported, isListening, interim, error, start(onFinal, onInterim?), stop() }` | Constructs `SpeechRecognition` (`lang:"en-US"`, `continuous:false`, `interimResults:true`, `maxAlternatives:1`, :161-164); opens a **sibling** `getUserMedia({audio:{echoCancellation,noiseSuppression}})` stream purely as the OS mic-live signal (:202-203) | `stop()` calls `recognition.abort()` + stops all sibling tracks; `useEffect(() => () => stop(), [stop])` (:224) |
| `useTranscribeRecognition()` | `→ UseSpeechRecognition` (same shape; `interim` is always `""`, :148) | `getUserMedia`, `new AudioContext`, `createScriptProcessor(4096,1,1)`, PCM accumulation; on `stop()` POSTs the raw `Int16Array` buffer to `/api/transcribe` as `application/octet-stream` (:87-91) | `teardown()` disconnects the node, closes the AudioContext, stops tracks (:57-64); called from both `start` failure and `stop`. **No unmount effect** — see gotchas |
| `useStt(engine = "browser")` | `→ UseSpeechRecognition` | None of its own — calls both child hooks unconditionally (Rules of Hooks) and returns one (:22-28) | Delegated to the child hooks |
| `useSpeechSynthesis(arg?: TtsEngine \| UseSpeechSynthesisOptions)` | `→ { supported, isSpeaking, speak(text), speakChunk(fullTextSoFar), cancel(), resetTurn() }` | `speechSynthesis.speak` per sentence; `fetch("/api/tts")` or `fetch("/api/tts-google")` per sentence for remote engines; `new Audio()` + object URLs; 12 s pause/resume keep-alive interval (desktop only, :266-276); `voiceschanged` listener | `voiceschanged` listener removed (:256); `visibilitychange` listener removed and `cancelRef.current()` called on unmount with **empty deps** (:566-575) |
| `useVoiceSession()` | `→ { supported, active, state, interim, messages, isStreaming, error, start(), ask(text), stop(), interrupt(), pause(), resume() }` | Three side-effect-only effects: speak-as-it-streams (:166-182), settle finalizer (:196-215), speaking→listening re-listen (:219-224). Never setState inside an effect | Unmount-only teardown via `teardownRef` with empty deps: `recognition.stop()` + `tts.cancel()` (:238-244) |
| `useVoiceLevel(state)` | `(state: VoiceSessionState) => React.RefObject<number>` | One rAF loop; writes the smoothed level into a ref (never React state) | `cancelAnimationFrame` + `running = false` in the effect return (:93-96); loop self-stops at rest when `idle`/`paused` and level `< 0.01` (:81-88) |
| `useWakeWord()` | `→ { supported, listening, arm(onDetect), disarm() }` | `getUserMedia({audio:true})` sibling stream; continuous `SpeechRecognition`; `setTimeout(startEngine, 400)` re-arm in `onend` (:130) | `disarm()` clears the re-arm timer, aborts recognition, stops tracks; `useEffect(() => () => disarm(), [disarm])` (:167) |

## The streamed-markdown security path

Three independent layers, all in scope, all fail-closed:

**1. Card/cmd token validation against the build-time slug allowlist — `chat/parse-cards.ts`**
- Token grammar is a fixed regex with a locked charset: `/\[\[(card:(project|work)|cmd:(view|highlight)):([a-z0-9-]+)\]\]/g`
  (`parse-cards.ts:33`). A slug containing `/`, `:`, `.` or uppercase cannot match, so a model can never
  smuggle a path or URL through the slug capture (`parse-cards.test.ts:55`).
- Every matched token is resolved, never echoed:
  - `card:project` → `getProject(slug)`; segment pushed **only if truthy** (`parse-cards.ts:54-56`).
  - `card:work` → `getWork(slug)`; same guard (:57-59).
  - `cmd:view` → allowed only if the slug is in `VIEWS` (:60-63); `VIEWS` is the exported readonly tuple
    `["classic","gamified","chat","developer","voice","resume"]` (`view-context.tsx:26`, exported at :198).
  - `cmd:highlight` → allowed only if `getProject(slug) || getWork(slug)` (:65-68).
- `getProject` / `getWork` are `allProjects.find(...)` / `allWork.find(...)` over the Velite output
  (`src/lib/content.ts:43-44`, sourced from `.velite/projects.json` + `.velite/work.json`) — i.e. the
  allowlist is fixed at build time and cannot be influenced at runtime.
- An unresolved token is **dropped entirely** — no card, no echoed literal (`parse-cards.ts:16-18` doc,
  `parse-cards.test.ts:41`). `cmd-*` segments produce **no DOM at all**; they are pure side-effect
  triggers dispatched by `ChatMessages` (`chat-messages.tsx:307-311`).
- Card fields are 100% server-sourced: `ChatCard` reads only `p.url / p.repo / p.name / p.tagline /
  p.tech / p.commits / p.group` and `w.url / w.register / w.name / w.summary / w.metrics`
  (`chat-card.tsx:12-77`) — the model influences only *which* card, never its contents or href.

**2. `rehype-sanitize` + `skipHtml` on the markdown renderer — `chat/markdown-message.tsx`**
- `<Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} skipHtml components={components}>`
  (`markdown-message.tsx:88-93`).
- react-markdown emits a React vdom — never `dangerouslySetInnerHTML` (:10-11 comment).
- `skipHtml` drops raw model HTML before it can become a node, so `<script>` / `<img onerror>` stay inert
  text (`parse-cards.test.ts:67`).
- The **default** `urlTransform` is deliberately not overridden, so `javascript:` / `data:` hrefs are
  stripped to `''` (:14-15). All rendered anchors carry `target="_blank" rel="noopener noreferrer nofollow"`
  (:66-75).
- `rehypeSanitize` (GitHub `defaultSchema`) is explicitly documented as defense-in-depth, not the primary
  guard (:16).

**3. Prompt-injection posture**
- Card tokens never reach the markdown renderer: `parseCards()` extracts them first and only `type:"text"`
  segments are passed to `MarkdownMessage` (`chat-messages.tsx:532-548`, `ask-portfolio.tsx:155-170`).
- `parse-cards.test.ts` is the pinned contract ("a hostile model turn can neither inject markup nor conjure
  a card/href for content that doesn't exist", `parse-cards.test.ts:6-11`). `CLAUDE.md:317` names
  `ask-portfolio.dom.test` as the streamed-markdown injection/XSS guard and says not to weaken it.
- The spoken/caption path has its own stripper: `toCaptionText()` runs `parseCards` then removes markdown
  markers **and** a dangling unclosed `[[card:` fragment mid-stream (`use-voice-session.ts:48-63`), so a
  half-written token is never spoken or shown.
- `closeOpenMarkdown()` is cosmetic only (balances a trailing `**`, `*`, backtick, hides a dangling
  `](` link-open) and is applied *after* sanitization concerns — it never re-enables HTML
  (`markdown-message.tsx:29-45`).

## The voice-surface-mutex contract

**Problem it solves (stated in the module header, `voice-surface-mutex.ts:4-21`):** every voice surface mounts
its **own** `<TalkMode>` → `useVoiceSession` → `useChat` + mic + TTS. `useChat` is per-instance state, not a
shared context, so two simultaneously-open surfaces = two concurrent mics talking over each other.

**Contract:**
1. `VoiceSurfaceId = "modal" | "inline" | "core"` (:23) — the three **overlay** surfaces are mutually
   exclusive. Each store calls `registerVoiceSurface(id, forceClose)` at module scope.
2. Every `open*()` calls `claimVoiceSurface(id)` **first** (`talk-overlay-store.ts:31`,
   `anvil-inline-store.ts:32`, `anvil-core-store.ts:23`), which iterates `closers` and invokes every
   *other* surface's close (:41-43). Idempotent: each `set*Open` short-circuits on unchanged state.
3. Dependency direction is one-way — the stores depend on this leaf module and never on each other, so
   there is no import cycle (:16-17).
4. The **`?view=voice` view is deliberately NOT a mutex participant** (:18-20): a view is not a closable
   overlay, it is mutually exclusive by routing. It is enforced instead in `header-orb-trigger.tsx`, which
   sets `onVoiceView = view === "voice"` (:67), early-returns from `open()` (:70) and renders the button
   `disabled` with the label "Anvil voice is already open in this view" (:84-88).
5. A second, related exclusion: `WakeWordController` is scoped to `ACTIVE_VIEWS = new Set(["chat"])`
   (`wake-word-controller.tsx:29`) precisely so arming it on the voice view cannot stack the modal's second
   session over the view's live one (:22-26).

## Detail

### `chat/use-chat.ts`
- **Role:** The one chat transport for every surface — owns the message list, the `/api/chat` stream read loop, thinking-phase parsing, and abort.
- **Exports:** `ChatRole` (type), `FileUIPart` (type — attachment wire+preview shape), `ChatMessage` (type), `ChatStatus` (type `"idle" | "streaming" | "error"`), `useChat` (hook).
- **Reads / depends on:** `TRACE_DELIMITER`, `THINKING_SENTINEL`, `THINKING_END` from `@/lib/llm-trace`; `fetch("/api/chat")`.
- **Consumed by:** `ask-portfolio.tsx:8`, `chat-view.tsx:5`, `use-voice-session.ts:4`; type-only by `chat-messages.tsx:5`, `use-chat-a11y.ts:4`, `attachment-preview-strip.tsx:3`, `file-picker-button.tsx:5`.
- **Behaviour notes:**
  - Wire protocol parsing lives in `parseAccumulated` (:93-116): `[THINKING_SENTINEL][reasoning][THINKING_END][answer][TRACE_DELIMITER][JSON]`. `splitTrace` (:60-74) tolerates a partially-arrived JSON frame by holding the trace until it parses.
  - Writes are coalesced: the read loop only records the buffer and calls `scheduleFlush` (:350); at most one commit per animation frame (:222-233). `BACKGROUND_FLUSH_MS = 250` is the fallback timer for tabs where rAF is paused (:124, :229).
  - `pendingRef` is a single-consumption token — whichever of rAF / safety timer fires first nulls it, so the loser is a no-op (:207-219).
  - Thinking timing is latched from **byte arrival** in the read loop (:337-346), not from render deltas — coalescing can collapse the intermediate render.
  - Trailing `flushNow(acc)` after the loop is mandatory (:353-354). The `catch` path calls `flushPending()` **before** mutating messages so an abort can't append to a stale buffer (:360).
  - HTTP error copy is status-specific: 503 → "The chat isn't switched on yet…", 429 → "That's a lot of questions!…", else "Something went wrong." (:312-325).
  - `AbortError` is treated as a user action: the partial answer is kept and suffixed ` …[stopped]` (or `"[stopped]"` when empty), status returns to `"idle"` (:363-374).
  - Multi-modal payload: attachment blocks first, text block last; PDFs are sent as a `text` block `"[PDF: name]\n<pdfText>"` (no base64), images as `{type:"image",source:{type:"base64",...}}` (:275-293).
- **Gotchas / invariants:**
  - `commit()` writes a `reasoning` property (:190-192) that is **not declared** on the exported `ChatMessage` type (:40-56). Nothing in `src/` reads `message.reasoning`; only `use-chat.test.ts` asserts on `trace.reasoning`.
  - `send` early-returns when `status === "streaming"` (:262) — the only concurrency guard; there is no queue.
  - `reset()` revokes every attachment `previewUrl` (:391-393); dropping that leaks object URLs.
  - `send`'s dep array includes `messages` (:384), so its identity changes every message — callers must not memoize on it.

### `chat/use-chat-a11y.ts`
- **Role:** Produce one polite live-region string: "Answering…" while streaming, the settled answer once afterwards, or a short status when TTS owns the audio.
- **Exports:** `useChatA11y` (hook).
- **Consumed by:** `chat-messages.tsx:9` (called at :344 with `activeIdx !== null`).
- **Behaviour notes:** All three branches set state **inside a timer callback**, never synchronously in the effect body (:36-45). Debounce is `0 ms` for "Answering…", `150 ms` for the settle/TTS branches.
- **Gotchas / invariants:** When `disableLiveAnnounce` is true the region gets `"Speaking answer aloud."` instead of the answer text — this is the no-double-speak invariant (:19-23). Exactly one channel conveys the answer.

### `chat/parse-cards.ts`
- **Role:** Turn one assistant message into ordered `text` / `project` / `work` / `cmd-view` / `cmd-highlight` segments.
- **Exports:** `CardSegment` (union type), `parseCards`, `hasCardToken`, `CMD_RE` (re-exported at :87, unused internally).
- **Reads / depends on:** `getProject`, `getWork`, `Project`, `Work` from `@/lib/content`; `VIEWS`, `View` from `@/components/view-context`.
- **Consumed by:** `chat-messages.tsx:6`, `ask-portfolio.tsx:10`, `use-voice-session.ts:8`; type-only by `chat-card.tsx:4`.
- **Behaviour notes:** Uses `content.matchAll(ALL_RE)` after resetting `ALL_RE.lastIndex = 0` (:38). `hasCardToken` resets `CARD_RE.lastIndex` before `.test()` (:82-83).
- **Gotchas / invariants:** `CARD_RE`, `CMD_RE`, `ALL_RE` are module-level `/g` regexes — the explicit `lastIndex` resets are what keep repeated calls stateless (pinned by `parse-cards.test.ts:77`). This module never produces HTML (:19-20).

### `chat/markdown-message.tsx`
- **Role:** Render one plain-text assistant segment as markdown, safe by construction.
- **Exports:** `closeOpenMarkdown` (fn), `MarkdownMessage` (memoized component, prop `{ text: string }`).
- **Reads / depends on:** `react-markdown`, `remark-gfm`, `rehype-sanitize`.
- **Consumed by:** `chat-messages.tsx:261` and `ask-portfolio.tsx:17` (both via `next/dynamic` with `ssr:false`), and `anvil-core-surface.tsx:6` (static import).
- **Behaviour notes:** A `components` map overrides 16 element renderers (:47-84); `h1` and `h2` both render as `<h3>` (:54-55). Memoized on `text` so settled bubbles never re-parse (:20-22).
- **Gotchas / invariants:** Removing `skipHtml` or overriding `urlTransform` breaks the XSS posture (:10-16). `anvil-core-surface.tsx` imports it **statically**, so that surface pulls react-markdown into its chunk while the other two lazy-load it (`chat-messages.tsx:259-260` calls out the ~46 KB motive).

### `chat/chat-messages.tsx`
- **Role:** Render the whole transcript for the Chat view: attachments, lightbox, thinking block, answer segments, cards, model badge, read-aloud, and the a11y live region.
- **Exports:** `ChatMessages` (component, props `{ messages, isStreaming }`).
- **Reads / depends on:** `parseCards`, `ChatCard`, `ReadAloudButton`, `useChatA11y`, `useSpeechSynthesis`, `useVoiceSettings`, `useAutoScroll`, `JumpToLatest`, `useView`, `highlightProject` (`@/lib/highlight-store`), `unlock` (`@/lib/discovery-store`), `SkeletonMarkdownLine`; env `NEXT_PUBLIC_EXTENDED_THINKING`.
- **Consumed by:** `chat-view.tsx:7` (rendered at :94).
- **Behaviour notes:**
  - `ThinkingBlock` is disabled when `process.env.NEXT_PUBLIC_EXTENDED_THINKING === "false"` (:159, early return :190) — i.e. **enabled by default**. Ctrl/Cmd+O toggles the settled reasoning panel (:178-188).
  - `cmd-view` / `cmd-highlight` tokens are dispatched only from **settled** messages (`if (isStreaming) return;` :303) and de-duplicated per message index via a ref-held `Set` (:297, :311).
  - Discovery side effect: `unlock("chat-question")` once any user message has non-empty content (:300-302).
  - One `useSpeechSynthesis` instance for the whole transcript (:320-324); `speakingIdx` tracks which message is being read, and `activeIdx` collapses to `null` when the engine stops on its own (:328).
  - Spoken text = the `type:"text"` segments joined — card tokens are never spoken (:495-499). Read-aloud is offered only when `settings.ttsEnabled && tts.supported` and the answer is complete (:325, :500).
  - Model badge shows `friendlyModel(m.model)` + `· Bedrock`, prefixed with `"↳ primary unavailable · "` when `fellBack` (:557-559). `friendlyModel` maps on substring: opus → "Claude Opus", sonnet → "Claude Sonnet", haiku → "Claude Haiku", else "Claude" (:251-257).
  - Attachment mosaic grid class is chosen by image count 1/2/3/3+ (:424-428); `count === 3` gives the first image `row-span-2` (:442).
  - `ImageLightbox` binds Escape / ArrowLeft / ArrowRight on `document` (:40-48) and renders `role="dialog" aria-modal="true"` without a focus trap (:51-57).
- **Gotchas / invariants:** Model output reaches the DOM only as React text nodes; cards come from the slug allowlist (:266-272 doc). The container carries `[overflow-anchor:none]` to stop browser scroll-anchoring fighting the JS pin (:395-399). Two live regions coexist: the `sr-only` `aria-atomic="true"` one from `useChatA11y` (:363-367) and `aria-live="polite" aria-atomic="false"` on the scroll container (:397-398).

### `chat/chat-view.tsx`
- **Role:** The `chat` view — a bounded-height "concierge console" around `useChat`.
- **Exports:** `ChatView` (component, no props).
- **Reads / depends on:** `useChat`, `RECRUITER_CHIPS`/`STARTER_CHIPS`, `ChatMessages`, `MicButton`, `TalkLaunchButton`, `FilePickerButton`, `AttachmentPreviewStrip`, `ViewEscapeHatch`, `profile`/`impactMetrics` (`@/lib/profile`); env `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS`.
- **Consumed by:** `view-router.tsx:25` via `next/dynamic`, rendered when `view === "chat" && isViewEnabled("chat")` (:64).
- **Behaviour notes:**
  - Root is `h-[calc(100dvh-3.5rem)]` — a **fixed** height, not `min-h`, so the transcript scrolls internally (:43-48 comment). `dvh` keeps the composer clear of iOS Safari chrome.
  - `FilePickerButton` renders only when `process.env.NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS === "true"` (:155) and new files are appended then `.slice(0, 3)` (:157).
  - Removing a pending attachment revokes its `previewUrl` (:133-137).
  - The Send/Stop button swaps on `isStreaming` (:161-178); Send is disabled unless there is text or a pending file (:172).
- **Gotchas / invariants:** The `min-h-0` / `shrink-0` layout comments (:63-64, :97-98, :140-141) document real regressions — the composer previously escaped the bordered `<section>` on short viewports. `ViewEscapeHatch` is the first focusable element (:22 doc, :50).

### `chat/file-picker-button.tsx`
- **Role:** Read, validate, and encode composer attachments into `FileUIPart[]`.
- **Exports:** `FilePickerButton` (component, returns `React.ReactElement | null`).
- **Reads / depends on:** `FileUIPart` type; dynamic `import("pdfjs-dist")`; env `NEXT_PUBLIC_PDF_ATTACHMENTS`.
- **Consumed by:** `chat-view.tsx:10`.
- **Behaviour notes:** `ALLOWED_IMAGE_TYPES` = jpeg/png/gif/webp (:9-14); `application/pdf` is added only when `NEXT_PUBLIC_PDF_ATTACHMENTS === "true"` (:7, :19-21). Limits: `MAX_IMAGE_SIZE = 2 MB`, `MAX_PDF_SIZE = 10 MB`, `MAX_FILES = 3` (:23-25). Rejections `console.warn` and are filtered out (:56-67). Images: `readAsArrayBuffer` → manual `String.fromCharCode` loop → `btoa` (:117-125). PDFs: `pdfjs-dist` `getDocument` → per-page `getTextContent()` joined with `\n\n`, `previewUrl` and `data` both `""` (:83-103). The worker src is set to `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` (:79-82).
- **Gotchas / invariants:** `inputRef.current.value = ""` is reset on every change so the same file can be re-attached after removal (:52-53). A failed read/extract resolves `null` and is filtered, never rejected (:104-109, :144-147).

### `chat/mic-button.tsx`
- **Role:** Push-to-talk composer mic with a one-time privacy disclosure gate.
- **Exports:** `MicButton` (component, props `{ onText, disabled?, compact? }`).
- **Reads / depends on:** `useStt(settings.sttEngine)`, `useVoiceSettings`.
- **Consumed by:** `chat-view.tsx:8` (`<MicButton onText={setInput} …/>` :152), `ask-portfolio.tsx:9` (`compact` :199).
- **Behaviour notes:** Returns `null` when `!supported` (:40) — the text composer is untouched. First click with `settings.micEnabled === false` shows the disclosure instead of listening (:60-63); accepting persists `micEnabled: true` then starts (:67-71). Both interim and final transcripts call `onText`, i.e. fill-for-review (:45-50). Press-to-toggle, deliberately not press-and-hold (:11 comment).
- **Gotchas / invariants:** Disclosure copy is engine-specific — "Sairam's own AWS" for `transcribe`, "your browser … Google or Apple" otherwise (:84-86). Listening state is signalled by an icon swap + pulsing dot, not colour alone (WCAG 1.4.1, :123-129).

### `chat/use-speech-recognition.ts`
- **Role:** Browser Web Speech STT as progressive enhancement.
- **Exports:** `SpeechErrorKind` (type), `UseSpeechRecognition` (type), `useSpeechRecognition` (hook). Also declares local minimal Web Speech typings (:29-63) because they are absent from `lib.dom.d.ts`.
- **Consumed by:** `use-stt.ts:3`; the type by `use-transcribe-recognition.ts:4`.
- **Behaviour notes:** `getCtor()` feature-detects `window.SpeechRecognition ?? window.webkitSpeechRecognition` (:68-75). `supported` is resolved via `useSyncExternalStore` with a noop subscribe and a server snapshot of `false` (:81-83, :127) — the codebase's `use-mounted` idiom, avoiding a hydration mismatch. `classifyError` maps raw engine strings to `denied | no-device | no-speech | network | unknown`, and maps `"aborted"` to `null` because that is a deliberate stop (:86-102). The engine is started **only after** the sibling `getUserMedia` resolves (:204-212); a `getUserMedia` rejection sets `no-device` for `NotFoundError`, else `denied` (:213-218).
- **Gotchas / invariants:** `continuous = false` (:162) is load-bearing for the whole talk loop — it is why the mic is already off during thinking/speaking and self-hearing is impossible (`use-voice-session.ts:26-30`). The sibling stream exists only so the OS recording indicator clears via `track.stop()` (:14-18).

### `chat/use-transcribe-recognition.ts`
- **Role:** AWS Transcribe STT with the same hook shape as the browser engine.
- **Exports:** `useTranscribeRecognition` (hook).
- **Reads / depends on:** `SpeechErrorKind`/`UseSpeechRecognition` types; `getUserMedia`, `AudioContext`/`webkitAudioContext`; `POST /api/transcribe`.
- **Consumed by:** `use-stt.ts:4`.
- **Behaviour notes:** `getSupported()` requires `getUserMedia` **and** an AudioContext — which includes Firefox, where browser SpeechRecognition is off by default (:19-24, :14-16 comment). `floatToPcm16k` downsamples by nearest-sample index and clamps to ±1 before scaling by `0x8000`/`0x7fff` (:34-44). `stop()` flattens the chunk list and skips the POST entirely when total length is 0 (:78-80). Any non-ok response sets `error: "unknown"` so `useStt` degrades (:93-100); a thrown fetch sets `"network"` (:105).
- **Gotchas / invariants:** `interim` is hard-coded `""` — there is no live partial text on this engine (:147-148). Uses the deprecated `ScriptProcessorNode` deliberately (:125-128). **There is no unmount cleanup effect** in this hook (contrast `use-speech-recognition.ts:224`); teardown happens only via `start` failure or `stop`.

### `chat/use-stt.ts`
- **Role:** Pick between the two STT engines and degrade transparently.
- **Exports:** `SttEngine` (type `"browser" | "transcribe"`), `useStt` (hook).
- **Consumed by:** `mic-button.tsx:5`, `use-voice-session.ts:5`.
- **Behaviour notes:** Both hooks are always called; Transcribe is returned only when `engine === "transcribe" && transcribe.supported && !transcribe.error` (:25-27), so a static unsupported OR any runtime error (permission, no device, route 503/5xx) falls back to browser (:16-19 doc).
- **Gotchas / invariants:** Because the fallback is keyed on `transcribe.error`, a *transient* Transcribe failure sticks for the rest of the hook's life — `error` is only cleared inside `start()` (`use-transcribe-recognition.ts:112`).

### `chat/use-speech-synthesis.ts`
- **Role:** Three-engine TTS with a per-sentence queue, streaming append, and a fallback cascade.
- **Exports:** `splitSentences` (fn), `TtsEngine` (type re-export from the settings store, :134), `UseSpeechSynthesisOptions` (type), `UseSpeechSynthesis` (type), `useSpeechSynthesis` (hook).
- **Reads / depends on:** `findBrowserVoice`, `getDefaultVoiceId`, `getVoiceById`, `VoiceEntry` from `@/lib/voice-catalog`; `DEFAULT_VOICE_CHARACTER`, `TtsEngine`, `VoiceCharacter` from `@/lib/voice-settings-context`; `POST /api/tts` (polly) and `POST /api/tts-google` (google).
- **Consumed by:** `chat-messages.tsx:10`, `use-voice-session.ts:6`, `voice-picker.tsx:14`.
- **Behaviour notes:**
  - `splitSentences` splits on `/[^.!?]*[.!?]+(?:["')\]]+)?\s*/g` with `MAX_CHUNK = 200`, breaking an over-long chunk at the last space past index 40 (:53-81). A trailing punctuation-less fragment is still returned.
  - Per-sentence utterances exist to dodge Chromium's ~15 s utterance cutoff; a desktop-only 12 s `pause()/resume()` keep-alive backs that up and is skipped on Android where `pause()` behaves like `cancel()` (:236-276).
  - Voice resolution: catalog `voiceURI` prefix match first, else the first English `localService` voice, else `null` so Chrome uses its default rather than a cancel-prone online voice (:87-103).
  - Character knobs are clamped: rate `slow 0.85 / natural 1.0 / fast 1.15`, pitch `warm 0.95 / neutral 1.0 / crisp 1.1` (:111-130).
  - `enqueue` re-reads `getVoices()` synchronously when the cache is empty, and if voices still aren't loaded registers a one-shot `voiceschanged` retry (:387-407). `synth.resume()` is called before every enqueue on non-Android to clear Chrome's silent paused state (:418).
  - Remote path: `remoteTokenRef` is a monotonic invalidation token; `cancelRemote` increments it so a late fetch can't resurrect stopped speech (:285-295). `playRemoteFrom` fetches → object-URL → `<audio>` per sentence, awaiting `onended` (:341-381).
  - `felledBackRef` blocks re-entering the remote path for the rest of the turn after a fallback — otherwise every streaming update would re-fetch, fail, reset `spokenCountRef` and produce a 429 storm plus duplicate speech (:226-232, :336-338).
  - `speakChunk` holds back a trailing partial sentence unless the text ends on terminal punctuation (`endsClean`, :518-519) and dedups against `spokenCountRef` (:520).
  - `effectiveVoiceId` defaults to `getDefaultVoiceId()` for polly only; google requires an explicit voiceId and otherwise falls through to the browser engine (:462-466, :476-479, :523-531).
- **Gotchas / invariants:**
  - The visibility/unmount effect **must** keep empty deps and reach `cancel` through `cancelRef` — listing `[cancel]` re-runs the cleanup on every render during streaming, wiping `spokenCountRef` and producing permanent silence (:552-575). This is documented as a real past bug.
  - `resetTurn()` deliberately does **not** touch the remote queue/index/token — clearing them mid-tail could truncate playing audio or flip `isSpeaking` and reopen the mic while audio is audible (:499-511).
  - There is no google→polly hop; both remote engines fall back only to the browser engine (:40-43).

### `chat/use-voice-session.ts`
- **Role:** The turn-based (half-duplex) talk state machine.
- **Exports:** `VoiceSessionState` (type `"idle" | "listening" | "thinking" | "speaking" | "paused"`), `toCaptionText` (fn), `useVoiceSession` (hook).
- **Reads / depends on:** `useChat`, `useStt`, `useSpeechSynthesis`, `useVoiceSettings`, `parseCards`.
- **Consumed by:** `talk-mode.tsx:13`, `anvil-core-surface.tsx:5`; the `VoiceSessionState` type by `use-voice-level.ts`, `voice-orb.tsx`, `voice-orb-canvas.tsx`, `voice-orb-3d.tsx`, `app/not-found.tsx:27`.
- **Behaviour notes:**
  - `state` is **derived every render** from `active` / `isStreaming` / `tts.isSpeaking` / `recognition.isListening`, in that precedence order (:248-253). `active` is the only stored state (:81).
  - `beginListening(force)` takes a `force` flag so `start()` can begin listening in the same tick it calls `setActive(true)` without a stale-closure read (:97-113).
  - `ask(text)` opens the session, calls `recognition.stop()` (mic off), then routes through the session's own `send` — one transcript, one mic (:122-131).
  - `interrupt()` cancels TTS **and** aborts the in-flight `/api/chat` stream, then re-listens (:144-148).
  - `turnStartedRef` makes `tts.resetTurn()` fire exactly once per assistant turn, before the first `speakChunk` (:176-179), and is re-armed when the stream settles (:213).
  - The settle finalizer must use `speakChunk`, not `speak` — `speak()` cancels and would re-speak the whole answer (:184-188). It also calls `beginListening()` when `!tts.isSpeaking` after the flush, covering short answers where the engine drained before the stream ended (:196-215).
  - `toCaptionText` is the single source for both the spoken text and the visible caption (:36-63); `stripForSpeech` is a deprecated local alias for it (:66).
- **Gotchas / invariants:**
  - The unmount teardown effect **must** keep empty deps and read `teardownRef` — `recognition`/`tts` are fresh objects every render, so listing them re-runs the cleanup (`tts.cancel()`) on every render, which is the documented "no audio" bug (:226-244).
  - Voice barge-in is explicitly *not* supported — barge-in is a UI interrupt (tap/Space) because `continuous=false` keeps the mic closed during playback (:26-31).

### `chat/talk-mode.tsx`
- **Role:** The shared voice surface UI used by all three overlay surfaces and the voice view.
- **Exports:** `TalkMode` (component, props `{ onClose, prompts?, autoStart? }`).
- **Reads / depends on:** `useVoiceSession`, `toCaptionText`, `useVoiceLevel`, `VoiceOrb`, `VoicePicker`, `useVoiceSettings`, `getDefaultVoiceId`/`getVoiceById`, `CHROME_TTS_BANNER_ENABLED` (`@/lib/writing-flags`), `hasSeenFirstRunPrimer`/`markFirstRunPrimerSeen`; env `NEXT_PUBLIC_VOICE_TEST_AUDIO`.
- **Consumed by:** `talk-mode-overlay.tsx:5`, `anvil-inline-panel.tsx:5` (with `autoStart`), `anvil-view.tsx:4` (with `prompts`).
- **Behaviour notes:**
  - `!supported` renders a "Voice conversation isn't available in this browser" panel with a Back-to-chat button (:273-289).
  - `STATUS_LABEL` maps each state to visible + `sr-only` copy (:111-117); the live region is `aria-live="polite" aria-atomic="true"` (:315-317).
  - Space is the turn toggle but **only** when focus is inside `containerRef` and the target isn't a button — so it can't hijack the page's Space behind the non-modal inline panel; Esc stays window-wide (:232-254).
  - `autoStart` fires once via `autoStarted` ref (:210-216); the JSDoc records that iOS Safari's first permission grant may lapse the user-activation window and degrade to "paused — tap to talk" (:144-149).
  - Captions block is `aria-hidden={speaking}` so a screen reader doesn't double-announce text being read aloud; the visible caption stays (:362-380). It is `max-h-[40vh] overflow-y-auto` with `[overflow-anchor:none]` and auto-scrolled on caption change (:268-271).
  - `isChromeTtsBuggy()` = `/Chrome\//` and **not** Brave (`navigator.brave`) and **not** `/Edg\//` (:101-109). The banner shows only when `CHROME_TTS_BANNER_ENABLED` (`NEXT_PUBLIC_CHROME_TTS_BANNER === "true"`, `writing-flags.ts:86-87`) **and** buggy Chrome **and** `ttsEngine === "browser"` (:348-350).
  - `TtsTestButton` renders only when `NEXT_PUBLIC_VOICE_TEST_AUDIO === "true"` (:478) and makes exactly one synchronous `speak()` attempt — no retries, because Chrome's user-activation window expires (:44-46).
  - Picking a voice also syncs `ttsEngine` to that voice's engine, so a stale `polly` in localStorage doesn't strand a browser-voice pick on the remote path (:543-549).
  - Focus rescue: when the prompt chips unmount on the first turn and `document.activeElement === document.body`, focus moves to `primaryRef` (:217-229).
- **Gotchas / invariants:** The orb is `aria-hidden` and decorative — meaning is carried by the visible label + live region (:319-336). `VoicePicker` is mounted **inside** `TalkMode` so opening it inherits the settings store and does not tear down the session (:167-169).

### `chat/talk-mode-overlay.tsx`
- **Role:** Radix Dialog modal wrapper for `TalkMode` (the default `talkSurface`).
- **Exports:** `TalkModeOverlay` (component, props `{ open, onOpenChange, getOpener? }`).
- **Consumed by:** `talk-mode-mount.tsx:3`.
- **Behaviour notes:** `onOpenAutoFocus` redirects focus to the first `button[type="button"]` inside the content so a keyboard user can start talking immediately (:35-46). `onCloseAutoFocus` restores focus to `getOpener()` because this is a *controlled* dialog Radix has no trigger for (:47-53). Visually-hidden `Dialog.Title`/`Description` satisfy Radix's a11y contract (:76-81). Entrance is a single in-portal Motion spring — deliberately **not** a cross-portal layout morph, which would churn the WebGL context (:56-60).
- **Gotchas / invariants:** `max-h-[90vh] overflow-y-auto` on the inner motion div is the safety net for short viewports where banner + primer + chips stack above the already-scrollable captions (:70-74).

### `chat/anvil-inline-panel.tsx`
- **Role:** The non-modal Siri-style disclosure panel anchored under the header orb.
- **Exports:** `AnvilInlinePanel` (component, no props).
- **Consumed by:** `app/layout.tsx:11` (mounted at :112).
- **Behaviour notes:** Uses the ARIA **disclosure** pattern, not `role="dialog"` — the element is `role="region" aria-label="Anvil voice"` with `id="anvil-inline-panel"` (`PANEL_ID`, :35, :113-115). Position is measured from the orb's `getBoundingClientRect()` (top = `bottom + 8`, right = `max(8, innerWidth - rect.right)`) and re-measured on `resize` (:43-57). `aria-expanded` + `aria-controls` are written imperatively onto the live orb button (:70-80). On open, focus moves to the first `button[type="button"]` in the panel (:83-87). An outside `pointerdown` in the **capture** phase closes it, excluding the panel and the orb itself (:92-105).
- **Gotchas / invariants:** No focus trap, no scroll lock, no `inert` — trapping a non-modal surface would be a WCAG 2.1.2 failure (:13-17). Esc is handled by `TalkMode`'s existing window listener; adding a second handler here is explicitly forbidden (:26). `autoStart` is only safe because the P2 one-mic mutex guarantees no other surface is listening (:130-132).

### `chat/anvil-core-surface.tsx`
- **Role:** The minimal orb-only "CORE" voice surface — enlarged orb, mic-hot dot, frosted answer card, nothing else.
- **Exports:** `AnvilCoreSurface` (component, no props).
- **Reads / depends on:** `useVoiceSession`, `MarkdownMessage` (static import), `anvil-core-store`.
- **Consumed by:** `app/layout.tsx:12` (mounted at :115).
- **Behaviour notes:** Self-gates — returns `null` when closed (:102). Auto-starts once per open and resets `autoStarted` on close (:40-46). `close()` stops the session, clears the store flag, and focuses the opener (:49-53). Esc (window) and capture-phase outside `pointerdown` both close, excluding the orb (:56-78). `aria-expanded`/`aria-controls` are set imperatively on the opener with id `anvil-core-surface` (:81-87). Renders the CSS-only `anvil-orb-idle` blob at `h-16 w-16` — **not** the reactive 3D orb, despite the header comment describing a ~200 px reactive orb (:134-138 vs :20-22).
- **Gotchas / invariants:** `posRef` is read inside a Motion `style` object with an eslint disable for `react-hooks/refs` (:125-126). The answer card renders the **raw** `messages[i].content` through `MarkdownMessage` (:163) — card tokens are *not* stripped here (contrast `talk-mode.tsx:263`, which uses `toCaptionText`).

### `chat/anvil-view.tsx`
- **Role:** The `?view=voice` "Anvil" view — a lean voice hero wrapped around `TalkMode`.
- **Exports:** `AnvilView` (component, prop `{ onClose }`).
- **Reads / depends on:** `profile`, `TalkMode`, `ViewEscapeHatch`.
- **Consumed by:** `view-router.tsx:40` via `next/dynamic`; rendered when `view === "voice" && isViewEnabled("voice")` with `onClose={() => setView("classic")}` (:67).
- **Behaviour notes:** Ships four hard-coded recruiter `PROMPTS` (:23-28) passed into `TalkMode`, so they drive that component's own session (:53). Closing unmounts the view, which tears the session + mic down (:14-15 comment).
- **Gotchas / invariants:** This view is **not** a `voice-surface-mutex` participant — exclusivity is enforced by `header-orb-trigger` disabling the orb here.

### `chat/header-orb-trigger.tsx`
- **Role:** The persistent header orb button and the router between the three voice surfaces.
- **Exports:** `HeaderOrbTrigger` (component, no props).
- **Reads / depends on:** `openTalkMode`, `openInlineVoice`, `openCoreVoice`, `useMediaQuery`, `useView`; env `NEXT_PUBLIC_ANVIL_ORB_MODE`, `NEXT_PUBLIC_ENABLE_ANVIL_ORB`, `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE`.
- **Consumed by:** `site-nav.tsx:11` (rendered at :75).
- **Behaviour notes:**
  - `ORB_MODE` is resolved once at module load: `"modal"` or `"off"` pass through; legacy `NEXT_PUBLIC_ENABLE_ANVIL_ORB === "false"` maps to `"off"`; default `"inplace"` (:34-39).
  - `ORB_EXPERIENCE` is `"core"` only when `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE === "core"`, else `"classic"` (:44-45).
  - Routing (:69-78): `inplace` + desktop (`min-width: 768px`) → `openCoreVoice` when experience is `core`, else `openInlineVoice`; everything else (mobile, or `modal` mode) → `openTalkMode`.
  - Returns `null` when `ORB_MODE === "off"` or STT is unsupported (:62); on `?view=voice` the button renders `disabled` with an explanatory label instead (:67, :84-90).
  - Idle visual is pure CSS (`anvil-orb-idle`), no rAF and no WebGL, because it sits on the Classic/SSG critical path (:26-29). 44 px hit area via padding around a 28 px visual (:92-99).
- **Gotchas / invariants:** All three env reads are build-time inlined — changing them requires a redeploy (:32).

### `chat/wake-word-controller.tsx`
- **Role:** Drive the opt-in wake word and render its mandatory trust surface.
- **Exports:** `WakeWordController` (component, no props).
- **Reads / depends on:** `useWakeWord`, `useVoiceSettings`, `useView`, `openTalkMode`.
- **Consumed by:** `app/layout.tsx:13` (mounted at :118).
- **Behaviour notes:** `ACTIVE_VIEWS = new Set(["chat"])` (:29). `wantsOn = settings.wakeWord && supported && ACTIVE_VIEWS.has(view)`; `shouldListen` additionally requires session-local `accepted`; `showDisclosure` is `wantsOn && !accepted` (:44-47) — all derived, never reset in an effect. The single arming effect calls `arm(() => openTalkMode())` or `disarm()`, and its cleanup always disarms (:49-54). While listening it renders a fixed bottom-centre `role="status" aria-live="polite"` banner with a ping dot + ear icon + one-tap Stop (:106-131).
- **Gotchas / invariants:** `accepted` is component state, not persisted, so re-enabling in a later session discloses again (:36-39). Scoping to `chat` only is a hard safety requirement — arming on the voice view would stack a second concurrent mic (:22-26).

### `chat/voice-picker.tsx`
- **Role:** The shared voice-picker UI, mounted in three surfaces.
- **Exports:** `VoicePickerProps` (type), `VoicePicker` (component). Internal: `VoiceCard`, `DescriptorGrid`, `GenderColumns`, `ColumnSection`, `PickerBody`, `accentLabel`, `engineLabel`.
- **Reads / depends on:** `CURATED_VOICES`, `EXTENDED_VOICES`, `getVoiceById`, `VoiceEntry` (`@/lib/voice-catalog`); `VOICE_PICKER_MODE` (`@/lib/voice-picker-mode`); `useSpeechSynthesis`; `applePremiumIsMissing`, `getVoicesRaceHardened`.
- **Consumed by:** `talk-mode.tsx:19` (`mode="dialog"`), `voice-settings-dialog.tsx:7` (`mode="inline"`), `command-palette-content.tsx:56` (rendered at :682).
- **Behaviour notes:** Layout is `GenderColumns` when `VOICE_PICKER_MODE === "gender"`, else `DescriptorGrid` (:342); the mode comes from `NEXT_PUBLIC_VOICE_PICKER_MODE` (default `"descriptor"` at `voice-picker-mode.ts:18`, env read at `:20`, resolved at `:22`). One TTS hook instance flips engine + voiceId via state, and `speak()` is deferred with `queueMicrotask` so the hook has re-rendered on the new engine (:294-296, :335-338). A second tap on the previewing card is Stop (:322-326). `previewingId` clears 250 ms after `isSpeaking` drops, to avoid flicker between sentences (:304-310). `getVoicesRaceHardened()` populates `browserVoices`, which drives the per-card Apple-Premium download hint (:276-284, :184). Overflow "More voices…" is a nested Radix Dialog at `z-[60]` over the parent's `z-50` (:361-407).
- **Gotchas / invariants:** Preview is cancelled on unmount via a `ttsRef` snapshot taken in an effect (:312-318) so a half-played preview never leaks into the chat session. In `dialog` mode `onCloseAutoFocus` restores focus to `getOpener()` (:429-435).

### `chat/voice-settings-dialog.tsx`
- **Role:** The canonical all-in-one voice settings dialog.
- **Exports:** `VoiceSettingsDialogProps` (type), `VoiceSettingsDialog` (component). Internal: `SegmentedControl`, `ToggleRow`, `ENGINE_LABEL`, `ENGINE_HINT`, `SPEED_OPTIONS`, `TONE_OPTIONS`, `PAUSE_OPTIONS`.
- **Reads / depends on:** `VoicePicker`, `DEFAULTS`/`DEFAULT_VOICE_CHARACTER`/`useVoiceSettings` and the character types (`@/lib/voice-settings-context`), `getDefaultVoiceId`/`getVoiceById`, and `getVoicesRaceHardened`/`isAndroid`/`isFirefox`/`isLinuxESpeak` from `voice-pitfalls`.
- **Consumed by:** `command-palette-content.tsx:57` (rendered at :692).
- **Behaviour notes:** Voice list loads only while `open` (:183-192) and `voices` stays `null` until then so no inaccurate advisory flashes. The browser engine radio is **disabled** when `isFirefox() && linuxESpeakOnly` or `linuxESpeakOnly`, each with its own explanation; Android gets a softer non-blocking advisory (:284-296). `characterIgnored` is true for `google`, or `polly` when the current voice's `pollyTier === "generative"` (:197-199) — the character block then renders at `opacity-50` with `aria-disabled` (:350-353). Picking a voice also sets `ttsEngine` to that voice's engine (:265-268). `reset()` writes every `DEFAULTS` field plus `voiceId: undefined` and `DEFAULT_VOICE_CHARACTER` (:201-212).
- **Gotchas / invariants:** `SegmentedControl` hand-rolls `role="radiogroup"` + `role="radio"`/`aria-checked` on buttons (:111-133) — no Radix RadioGroup, so arrow-key roving is not provided.

### `chat/voice-pitfalls.ts`
- **Role:** Small, independent workarounds for documented browser-voice landmines, plus the first-run-primer storage key.
- **Exports:** `detectScreenReader`, `isIOS`, `isLinuxESpeak`, `voiceURIToGender`, `localeFallbackChain`, `applePremiumIsMissing`, `getVoicesRaceHardened`, `normalizeVoiceURI`, `isAndroid`, `isFirefox`, `FIRST_RUN_PRIMER_STORAGE_KEY`, `hasSeenFirstRunPrimer`, `markFirstRunPrimerSeen`.
- **Consumed by:** `voice-picker.tsx:15-18` (`applePremiumIsMissing`, `getVoicesRaceHardened`), `voice-settings-dialog.tsx:19-24` (`getVoicesRaceHardened`, `isAndroid`, `isFirefox`, `isLinuxESpeak`), `talk-mode.tsx:23-26` (`hasSeenFirstRunPrimer`, `markFirstRunPrimerSeen`).
- **Behaviour notes:** `FIRST_RUN_PRIMER_STORAGE_KEY = "anvilry:voice:first-run-seen-v1"` (:223); both accessors are try/caught so private mode degrades to "show it once more" (:227-246). `getVoicesRaceHardened(timeoutMs = 2000)` resolves on a non-empty sync read, else on `voiceschanged`, else after the timeout (:158-188). `normalizeVoiceURI` strips trailing Linux speech-dispatcher modifiers `/\+[mf]\d+$/i` (:196-199). `voiceURIToGender` is a curated 15-entry prefix allowlist because `voice.gender` is deprecated and unreliable (:79-104). `localeFallbackChain` has hard-coded neighbour chains for 7 English locales (:111-127).
- **Gotchas / invariants:** `detectScreenReader` appends and removes a probe div on `document.body` (:32-36) — a real DOM side effect, and it is heuristic by design; the header states the practical effect is only that `ttsEnabled` stays default-OFF for likely SR users (:20-23). Note the module is **not** marked `"use client"`, but the side-effecting helpers are guarded by `typeof window`/`typeof navigator` checks. **UNVERIFIED:** `detectScreenReader`, `isIOS`, `voiceURIToGender`, `localeFallbackChain`, and `normalizeVoiceURI` have no importer anywhere under `src/` outside the two test files — I could not find a production caller.

### `chat/voice-orb.tsx` / `voice-orb-canvas.tsx` / `voice-orb-3d.tsx`
- **Role:** The orb renderer stack. `VoiceOrb` selects; `VoiceOrbCanvas` is the universal baseline; `VoiceOrb3D` is the desktop R3F enhancement.
- **Exports:** `VoiceOrb`, `VoiceOrbCanvas`, `VoiceOrb3D` — all take `{ level: React.RefObject<number>, state: VoiceSessionState, size? }`; `VoiceOrb3D` additionally takes `errorMode?`.
- **Consumed by:** `talk-mode.tsx:18` → `VoiceOrb` (`size={160}`, :328). `VoiceOrb3D` is also lazy-imported directly by `app/not-found.tsx:29` with `state={"idle"}`.
- **Behaviour notes:**
  - `use3D = isDesktop && webgl && !reduced && !glFailed` (`voice-orb.tsx:42`); the 3D orb is wrapped in `WebGLBoundary` whose `onFail` flips permanently to the canvas orb (:44-50). `VoiceOrb3D` is lazy so three/R3F never enters the talk-mode bundle on mobile / reduced-motion / no-WebGL (:11-16).
  - `VoiceOrbCanvas` draws a single static ring and returns early (no rAF loop) under `prefers-reduced-motion` (:54-63). Otherwise one rAF loop reads `level.current` directly — never through React state (:69-118). DPR is capped at 2 (:45). Accent is hard-coded `#38e1ff` to match `--accent` (:19).
  - `VoiceOrb3D`: 5-octave fBm (`SNOISE`/`fbm`, :47-98) domain-warps the sample point before displacing an `icosahedronGeometry(1, 24)` along its normal; an inverted-fresnel `BackSide` additive halo sphere at `scale={1.8}` provides the volumetric glow (:255-268). `frameloop` is `"demand"` only in `errorMode`, otherwise `"always"` (:306). `dpr={[1, 1.75]}`, ACES tone mapping at exposure 1.15 (:310-317).
  - Post-processing (`Fluid` → `Bloom` → `Vignette` → `Noise` → `ChromaticAberration`, order deliberate) requires **both** `NEXT_PUBLIC_ORB_POSTPROCESSING === "true"` **and** `getDeviceTier() === "high"` (≥4 GB `deviceMemory` and ≥4 `hardwareConcurrency`) (:300-301, :39-44, :327-348). `Bloom` uses `luminanceThreshold={1.0}` so only HDR crests bloom (:333-338).
  - `errorMode` shifts the palette to `#ff4e00`/`#ff1a1a`, multiplies turbulence by 1.4, and swaps smooth breathing for an erratic double-sin (:35-36, :124, :245-248).
- **Gotchas / invariants:** All three are `aria-hidden` decorative (`voice-orb-canvas.tsx:123`, `voice-orb-3d.tsx:304`). The `uniforms` `useMemo` in `OrbMesh` has an empty dep array with an eslint disable (:217-218), so a change to `errorMode` after mount will not rebuild `uErrorMode`.

### `chat/use-voice-level.ts`
- **Role:** Produce a smoothed 0..1 amplitude in a ref for the orb's draw loop.
- **Exports:** `useVoiceLevel`.
- **Consumed by:** `talk-mode.tsx:17` (:195).
- **Behaviour notes:** `SMOOTH = 0.18` ease factor (:30). Per-state envelopes: listening `0.26 + 0.12·sin(1.6t)` plus a `0.1·sin(7.3t+1.1)` shimmer; thinking `0.18 + 0.08·sin(2.2t)`; speaking `0.45 + 0.14·sin(2.1t)` plus a syllabic transient, clamped to `[0.18, 1]`; idle/paused `0` (:32-52). `dt` is clamped to 0.05 s to survive tab refocus (:72).
- **Gotchas / invariants:** The envelope is **synthetic on purpose** — `speechSynthesis` exposes no MediaStream/AudioNode in any shipping browser, and a second `getUserMedia` analyser would conflict with the mic the STT hook already holds (:11-20). The loop self-stops at rest and restarts only because a `state` change remounts the effect (:81-88, :97).

### `chat/talk-overlay-store.ts`, `chat/anvil-inline-store.ts`, `chat/anvil-core-store.ts`
See **Store & hook map** above. All three are structurally identical: module `open` + `opener`, a `Set` of listeners, `useSyncExternalStore` with a `false` server snapshot, a `claimVoiceSurface` call at the top of `open*()`, and a module-scope `registerVoiceSurface`. They exist as three separate stores specifically so two surfaces can never both believe they are open (`anvil-inline-store.ts:11-13`).

### `chat/talk-mode-mount.tsx`, `chat/talk-launch-button.tsx`
- **`TalkModeMount`** — the single global mount of the modal, wiring `useTalkModeOpen` / `setTalkModeOpen` / `getTalkOpener` into `TalkModeOverlay`. Mounted at `app/layout.tsx:108` so every entry point drives one overlay instance and focus restore works regardless of entry point.
- **`TalkLaunchButton`** — renders `null` unless the browser exposes `SpeechRecognition`/`webkitSpeechRecognition` **and** `settings.talkSurface === "modal"` (:28), so the 5th-view surface doesn't produce two doors to one mode. Passes `e.currentTarget` as the focus-restore target (:33).

### `ask-portfolio.tsx`
- **Role:** The floating "Ask my portfolio" widget available on every non-chat view.
- **Exports:** `AskPortfolio` (component). Internal: `AskPortfolioWidget`, `SUGGESTED`.
- **Reads / depends on:** `useView`, `useChat`, `MicButton`, `parseCards`, `ChatCard`, lazy `MarkdownMessage`, `useAutoScroll`, `JumpToLatest`, `SkeletonMarkdownLine`.
- **Consumed by:** `app/layout.tsx:8` (rendered at :105).
- **Behaviour notes:**
  - Returns `null` when `view === "chat"` — the Chat view *is* the concierge (:37-38).
  - The inner widget is keyed by `view` (:39), so any view change remounts it and resets `useChat`'s message list — transcript/open state never leaks across a classic↔gamified switch, with no setState-in-effect (:29-35).
  - Its own four `SUGGESTED` prompts (:22-27) are **separate** from `chat-suggestions.ts` — the two lists overlap but are not shared.
  - Autoscroll uses `useAutoScroll({ threshold: 120, enabled: open, surface: "widget", mode: "bottom-pin" })` — bottom-pin only, and attaches nothing while closed (:56-61).
  - Focus returns to the trigger button when the panel closes, tracked via a `wasOpen` ref (:64-67).
  - Assistant rendering mirrors the full view: `parseCards` → markdown for text segments, `ChatCard` for resolved cards, `null` for `cmd-*` (:155-170). An empty assistant message shows "Thinking…" only while streaming (:144-152).
  - `MarkdownMessage` is lazy (`ssr:false`, skeleton fallback) so react-markdown stays off the initial bundle (:15-20).
- **Gotchas / invariants:** `MicButton` is rendered `compact` here to match the smaller controls (:199). The widget does **not** render attachments, thinking blocks, model badges, or read-aloud — those are Chat-view-only. Guarded by `ask-portfolio.dom.test.tsx`, which pins that the widget rides the shared `useChat` stream and surfaces the 503 message; `CLAUDE.md:317` marks these guards as not-to-be-weakened.

### `chat/chat-suggestions.ts`, `chat/chat-card.tsx`, `chat/read-aloud-button.tsx`, `chat/attachment-preview-strip.tsx`
- **`chat-suggestions.ts`** — two `string[]` constants. `RECRUITER_CHIPS` (4 prompts) is always shown; `STARTER_CHIPS` (3 prompts) only in the empty state (`chat-view.tsx:100`, :112-114).
- **`chat-card.tsx`** — project branch renders name/tagline/`tech.slice(0,5)`/commit count (or `group` when `commits == null`) and links to `p.url` + `p.repo`; work branch is a single `Link` to `w.url` with `register`, `name`, `summary`, and every `w.metrics` entry. Every value is Velite-sourced (:6-11 doc).
- **`read-aloud-button.tsx`** — stateless; `aria-pressed` + icon swap (speaker↔stop), label "Listen"/"Stop". The single TTS engine lives in `ChatMessages`, not here (:6-9).
- **`attachment-preview-strip.tsx`** — returns `null` on an empty list so there is no layout shift (:19). PDFs show a 📄 badge plus an approximate extracted-character count (`Math.round(pdfText.length / 1000)`k, :37); images show a 48×48 `object-cover` thumbnail from `previewUrl`. `role="list"`/`role="listitem"` are set explicitly (:24-30). Removal is delegated to `onRemove(index)`; the **caller** revokes the object URL (`chat-view.tsx:133-137`).

## Coverage

- `src/components/ask-portfolio.tsx`
- `src/components/chat/anvil-core-store.ts`
- `src/components/chat/anvil-core-surface.tsx`
- `src/components/chat/anvil-inline-panel.tsx`
- `src/components/chat/anvil-inline-store.ts`
- `src/components/chat/anvil-view.tsx`
- `src/components/chat/attachment-preview-strip.tsx`
- `src/components/chat/chat-card.tsx`
- `src/components/chat/chat-messages.tsx`
- `src/components/chat/chat-suggestions.ts`
- `src/components/chat/chat-view.tsx`
- `src/components/chat/file-picker-button.tsx`
- `src/components/chat/header-orb-trigger.tsx`
- `src/components/chat/markdown-message.tsx`
- `src/components/chat/mic-button.tsx`
- `src/components/chat/parse-cards.ts`
- `src/components/chat/read-aloud-button.tsx`
- `src/components/chat/talk-launch-button.tsx`
- `src/components/chat/talk-mode-mount.tsx`
- `src/components/chat/talk-mode-overlay.tsx`
- `src/components/chat/talk-mode.tsx`
- `src/components/chat/talk-overlay-store.ts`
- `src/components/chat/use-chat-a11y.ts`
- `src/components/chat/use-chat.ts`
- `src/components/chat/use-speech-recognition.ts`
- `src/components/chat/use-speech-synthesis.ts`
- `src/components/chat/use-stt.ts`
- `src/components/chat/use-transcribe-recognition.ts`
- `src/components/chat/use-voice-level.ts`
- `src/components/chat/use-voice-session.ts`
- `src/components/chat/use-wake-word.ts`
- `src/components/chat/voice-orb-3d.tsx`
- `src/components/chat/voice-orb-canvas.tsx`
- `src/components/chat/voice-orb.tsx`
- `src/components/chat/voice-picker.tsx`
- `src/components/chat/voice-pitfalls.ts`
- `src/components/chat/voice-settings-dialog.tsx`
- `src/components/chat/voice-surface-mutex.ts`
- `src/components/chat/wake-word-controller.tsx`
