# Anvilry

> **Sairam Ugge** — GenAI & Backend Engineer. Live at **[anvilry.vercel.app](https://anvilry.vercel.app)**.

A recruiter-facing engineering portfolio built as a **beast with four switchable experiences over one canonical content source** — pick the way you want to explore the same verified work:

- **🗂 Classic** — a fast, static (SSG) portfolio. The SEO-indexed default and the recruiter-in-a-hurry path.
- **🎮 Play** — an explorable **WebGL "Build Graph"**: every node is a real project/work system that opens its actual card. Accessible DOM-first index as the mobile / reduced-motion / no-JS fallback.
- **💬 Chat** — an **AI concierge console**: a RAG-grounded, first-person chatbot over the real résumé, with streaming markdown answers and generative project/work cards. Optional **voice** — push-to-talk mic input, read-aloud answers, and a hands-free two-way "talk mode" (all opt-in, free, browser-native).
- **⌨️ Developer** — a focused, full-page **keyboard-native terminal** over the same content: ~16 commands (`whoami`, `ls work`, `cat <slug>`, `grep`, `open <slug>`, `tree`, …) with history, autocomplete, a boot banner, theme cycling, and a fullscreen overlay. Reachable from the nav switcher, ⌘K, the `developer` command, or `?view=developer`.

All four render from **one content layer** — zero duplication, zero fabrication. The honest contribution register (*Co-built / Architected / Owned / Led*) is preserved everywhere, and every metric traces to a source file.

---

## ✨ Highlights

- **4-view architecture** — a single client `ViewProvider` switches Classic / Play / Chat / Developer without a navigation, so the WebGL context and chat transcript survive a switch. `/` stays SSG; `?view=` deep-links collapse to one canonical URL (no duplicate-content SEO hit).
- **AI concierge (AWS Bedrock)** — Claude **Opus 4.6 → Sonnet 4.6 → Haiku 4.5** availability fallback with a streaming byte-gate invariant, in-context RAG grounding, prompt-injection guardrails, and per-IP rate limiting (Upstash, fails open).
- **Generative chat cards** — the model emits only a `[[card:work:slug]]` intent token; the client resolves it against a build-time slug allowlist and renders the *real* Velite card. Zero fabrication is structural, not prompt-based.
- **Safe streaming markdown** — `react-markdown` + `rehype-sanitize` + `skipHtml` (no raw model HTML, `javascript:` links stripped), with a preprocessor that gracefully renders partial markdown mid-stream.
- **Interactive 3D Build Graph** — R3F scene with clickable/keyboard-focusable nodes, gated behind a WebGL capability probe (graceful DOM fallback), with GL-context disposal on view exit.
- **Anti-drift content layer** — a build-time test asserts a bijection between graph nodes and content (fails the deploy on an orphaned node).
- **Voice (opt-in, free-first)** — push-to-talk **mic input**, per-answer **read-aloud**, and a hands-free turn-based **talk mode** (modal or a 5th view), all bolted onto the existing `useChat` transport with **zero backend change**. Browser-native (`SpeechRecognition` + `speechSynthesis`) by default; optional **AWS Polly / Transcribe** behind flags using the existing Bedrock creds (no new vendor). Strictly opt-in, feature-detected (degrades to text on Firefox), with cloud-audio disclosure, a no-double-speak `aria-live` reconciliation, and a wake word that is off by default behind a disclosure + persistent "Listening" banner.
- **WCAG 2.2 AA** — keyboard operability, focus management, `aria-live` announce-on-settle chat, reduced-motion + mobile fallbacks throughout; voice is an addition, never a requirement (text always works).

## 🧱 Stack

| Area | Tech |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** (strict) |
| Styling | **Tailwind v4** — dark-technical design system (`src/app/globals.css`) |
| Content | **Velite** — type-safe MDX content layer (`content/` → `.velite/`) |
| Motion / 3D | **Motion** (reduced-motion aware) · **React Three Fiber** + **three.js** |
| Chat | **AWS Bedrock** (`@anthropic-ai/bedrock-sdk`) · **react-markdown** · **Upstash** rate limiting |
| Voice | **Web Speech API** (`SpeechRecognition` + `speechSynthesis`, free, browser-native) · optional **AWS Polly** / **Transcribe** behind flags (existing creds) |
| UI | **cmdk** (⌘K command palette) · lucide icons |
| Hosting | **Vercel** — Analytics + Speed Insights |
| Tests | **Vitest** — content-coverage + chat injection/XSS guards (chained into `build`) |

## 🚀 Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000  (Velite runs in watch mode via predev)
pnpm build        # velite --clean && vitest run && next build
pnpm lint
pnpm test         # vitest run
pnpm clean        # wipe .next/.turbo/.velite caches (run after moving/renaming the folder)
```

## 📇 Content (single source of truth)

All site content is data-driven — no fabrication, mirrors the résumé / LinkedIn / GitHub pack:

- `content/work/*.mdx` — **5 production systems** (Pensieve, AAVA Code, Wireframe Generator, Prompt-to-React, Execution Engine), honest *Co-built / architected* register + real metrics.
- `content/projects/*.mdx` — **8 open-source repos** (architecture + tech + commit counts only).
- `src/lib/profile.ts` — identity, headline, impact metrics, skills, achievements, résumé variants.
- `src/lib/game-model.ts` — derives the Play view's nodes/dossiers from the same content (build-time coverage test enforces no drift).

Edit those files; the home grids, case-study pages, the Build Graph, sitemap, chatbot corpus, and JSON-LD all update automatically.

## 💬 Chatbot configuration

The chat uses **AWS Bedrock** by default (toggle to the direct Anthropic API with `LLM_PROVIDER=anthropic`). Without credentials it degrades gracefully (`503` → the widget tells visitors to email / check the résumé).

```bash
cp .env.example .env.local
# LLM_PROVIDER=bedrock
# BEDROCK_ACCESS_KEY_ID / BEDROCK_SECRET_ACCESS_KEY   (base64 or raw)
# BEDROCK_REGION=us-east-1                            (NOT AWS_REGION — reserved on Vercel)
# UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (optional rate limiting)
```

The grounding corpus is built in-context from `src/lib/corpus.ts` — the portfolio is small enough that no vector DB is needed (upgrade path: pgvector + BM25 if a blog is added). The model chain + streaming fallback live in `src/lib/llm.ts`.

## 🎙️ Voice (optional, opt-in)

Voice is **progressive enhancement over the text chat** — it attaches to the existing `useChat` transport, so the chat backend is unchanged. Everything defaults **off** and is toggled from the ⌘K palette's **Voice** group; the text composer is always the primary channel.

| Feature | How | Cost |
|---|---|---|
| **Mic input** (push-to-talk) | A mic button in the chat composer. Speak → transcript fills the input for review. | **$0** — browser `SpeechRecognition`. |
| **Read-aloud** | A per-answer "Listen" button speaks the reply (per-sentence, starts early). | **$0** — browser `speechSynthesis`. |
| **Talk mode** | Hands-free turn-based loop (listen → think → speak) as a modal or an optional 5th view. | **$0** — STT + Bedrock + TTS. |
| **Wake word** | "Hey portfolio" continuous listen. **Off by default**, behind a disclosure + a persistent "Listening" banner with one-tap kill. | **$0** — browser `SpeechRecognition`. |

**Privacy:** on Chrome/Edge, browser `SpeechRecognition` sends audio to the browser vendor's cloud (Google) — disclosed in-UI before the first listen; nothing is stored server-side. `getUserMedia` runs only on an explicit gesture, with a visible mic indicator and a one-tap stop that releases the mic.

**Browser support:** feature-detected. Chrome/Edge/Safari get full voice; **Firefox** (where `SpeechRecognition` is off-by-default) silently keeps the text composer — or can use the AWS Transcribe path.

**Optional AWS upgrades (flags, no new vendor — reuse the Bedrock creds):**

```bash
# Higher-quality voice output: AWS Polly Neural via /api/tts (else free browser voice).
#   Toggle in-app: ⌘K → "Use higher-quality voice (Polly)"
# Private speech-to-text: AWS Transcribe via /api/transcribe (audio processed on your
#   own AWS, not Google; also enables voice in Firefox).
#   Toggle in-app: ⌘K → "Mic: use private transcription (AWS)"
```

Both reuse `BEDROCK_*` creds, are per-IP rate-limited (Upstash), and **fail closed** — any error degrades to the free browser path, so voice never breaks. Needs IAM `polly:SynthesizeSpeech` / `transcribe:StartStreamTranscription` on the same key (see `DEPLOY.md`).

## 🌐 Deploy (Vercel)

See **[`DEPLOY.md`](./DEPLOY.md)** for the full guide (env vars, verified Bedrock model chain + IAM policy, rate limiting, the region gotcha). In short:

1. Repo: **[github.com/sairam0424/anvilry](https://github.com/sairam0424/anvilry)**.
2. Import at [vercel.com/new](https://vercel.com/new) — framework auto-detected as Next.js.
3. Add env vars (Production + Preview): `LLM_PROVIDER`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
4. **Branch model:** `develop` = primary working branch (Preview deploys) · `main` = release branch (Production → the live domain).
5. Live at **[anvilry.vercel.app](https://anvilry.vercel.app)** (custom domain optional, via Settings → Domains).

The public base URL is `https://anvilry.vercel.app` (in `src/app/layout.tsx` `siteUrl`, plus `sitemap.ts`, `robots.ts`, `json-ld.tsx`, `opengraph-image.tsx`) — update those four files if you point a custom domain at the deployment.

---

<sub>Anvilry is the project codename; the deployed site is **[anvilry.vercel.app](https://anvilry.vercel.app)**.</sub>
