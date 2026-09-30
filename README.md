# Anvilry

> **Sairam Ugge** — GenAI & Backend Engineer. Live at **[anvilry.vercel.app](https://anvilry.vercel.app)**.

A recruiter-facing engineering portfolio built as a **beast with four switchable experiences over one canonical content source** — pick the way you want to explore the same verified work:

- **🗂 Classic** — a fast, static (SSG) portfolio. The SEO-indexed default and the recruiter-in-a-hurry path.
- **🎮 Play** — an explorable **WebGL "Build Graph"**: every node is a real project/work system that opens its actual card. Accessible DOM-first index as the mobile / reduced-motion / no-WebGL fallback.
- **💬 Chat** — an **AI concierge console**: a RAG-grounded, first-person chatbot over the real résumé, with streaming markdown answers and generative project/work cards. Optional **voice** — push-to-talk mic input, read-aloud answers, and a hands-free two-way "talk mode" (all opt-in, free, browser-native).
- **⌨️ Developer** — a focused, full-page **keyboard-native terminal** over the same content: 32 commands (28 visible + 4 hidden easter eggs; visible ones include `whoami`, `ls work`, `cat <slug>`, `grep`, `open <slug>`, `tree`, `integrity`) with history, autocomplete, a boot banner, theme cycling, and a fullscreen overlay. Reachable from the nav switcher, ⌘K, the `developer` command, or `?view=developer`.

All four render from **one content layer** — zero duplication, zero fabrication. The honest contribution register (*Co-built / Architected / Owned / Led*) is preserved everywhere, and every metric traces to a source file.

---

## ✨ Highlights

- **View architecture** — a single client `ViewProvider` (a module-level external store) switches between six views without a navigation: the four headline experiences (Classic / Play / Chat / Developer), plus **Voice** (the desktop-only 5th switcher pill) and the **Recruiter** view (`?view=resume` or ⌘K → "Recruiter view"; distinct from the standalone `/resume` page). Classic stays mounted (hidden) so switching back is instant; the Play canvas unmounts on exit, which disposes its WebGL context. `/` stays SSG; `?view=` deep-links collapse to one canonical URL (no duplicate-content SEO hit).
- **AI concierge (AWS Bedrock)** — Claude **Sonnet 4.6 → Opus 4.6 → Haiku 4.5** availability fallback (15 s per attempt; `LLM_USE_SONNET_5=true` / `LLM_USE_SONNET_5_5=true` moves Sonnet 5 / 5.5 into the primary rung) with a streaming byte-gate invariant, in-context RAG grounding, prompt-injection guardrails, a Redis-backed FAQ response cache for repeat first-turn questions, and per-IP rate limiting (Upstash, fails open) with a separate 8 req/min bucket per route class — chat, voice, and error beacons.
- **Generative chat cards** — the model emits only intent tokens: `[[card:work:slug]]` / `[[card:project:slug]]`, plus side-effect-only `[[cmd:view:…]]` / `[[cmd:highlight:…]]`. The client resolves each against build-time allowlists (unknown slugs and views are dropped) and renders the *real* Velite card. Zero fabrication is structural, not prompt-based.
- **Safe streaming markdown** — `react-markdown` + `rehype-sanitize` + `skipHtml` (no raw model HTML, `javascript:` links stripped), with a preprocessor that gracefully renders partial markdown mid-stream.
- **Interactive 3D Build Graph** — R3F scene with clickable/keyboard-focusable nodes, gated behind a WebGL capability probe (graceful DOM fallback), with GL-context disposal on view exit.
- **Anti-drift content layer** — build-time tests assert a bijection between graph nodes and content, and between the Decisions ledger and its frontmatter sources (either fails the deploy on an orphan). A hash-chained **Claims Integrity Ledger** (`data/integrity-chain.json`, verified in CI by `scripts/seal-claims.ts`, shown by the terminal's `integrity` command) makes silent edits to the headline metrics and achievements detectable — tamper-evidence, not certification.
- **Agent-readable surface** — a public, read-only **MCP server** (`/api/mcp/mcp`, Streamable HTTP; 10 tools including `list_decisions`; documented at `/mcp`) plus `llms.txt`, `llms-full.txt`, and an RSS feed, all derived from the same content layer.
- **Decisions ledger** — `/decisions` lists the real architecture trade-offs already living in project frontmatter and work case studies (one derivation, no copy), filterable by category and tag.
- **Voice (opt-in, free-first)** — push-to-talk **mic input**, per-answer **read-aloud**, and a hands-free turn-based **talk mode** (a modal, or the full-page Voice view), all bolted onto the existing `useChat` transport with **zero chat-backend change**. Browser-native (`SpeechRecognition` + `speechSynthesis`) by default; optional **AWS Polly / Transcribe** behind flags using the existing Bedrock creds (no new vendor), plus optional **Google Cloud TTS** (Chirp 3 HD, its own API key). Strictly opt-in, feature-detected (degrades to text on Firefox), with cloud-audio disclosure, a no-double-speak `aria-live` reconciliation, and a wake word that is off by default behind a disclosure + persistent "Listening" banner.
- **WCAG 2.2 AA** — keyboard operability, focus management, `aria-live` announce-on-settle chat, reduced-motion + mobile fallbacks throughout; voice is an addition, never a requirement (text always works).

## 🧱 Stack

| Area | Tech |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** (strict) |
| Styling | **Tailwind v4** — dark-technical design system (`src/app/globals.css`) |
| Content | **Velite** — type-safe MDX content layer (`content/` → `.velite/`) |
| Motion / 3D | **Motion** (reduced-motion aware) · **React Three Fiber** + **three.js** |
| Chat | **AWS Bedrock** (`@anthropic-ai/bedrock-sdk`; direct Anthropic API via `@anthropic-ai/sdk` when `LLM_PROVIDER=anthropic`) · **react-markdown** + **rehype-sanitize** · **Upstash Redis** (per-class rate limiting, FAQ response cache, telemetry) |
| Voice | **Web Speech API** (`SpeechRecognition` + `speechSynthesis`, free, browser-native) · optional **AWS Polly** / **Transcribe** behind flags (existing creds) · optional **Google Cloud TTS** (Chirp 3 HD, `GOOGLE_TTS_API_KEY`) |
| Agents | Read-only **MCP** server (`mcp-handler` + `@modelcontextprotocol/sdk`, Streamable HTTP) · `llms.txt` / `llms-full.txt` · RSS |
| UI | **cmdk** (⌘K command palette) · lucide icons |
| Hosting | **Vercel** — Analytics + Speed Insights · 5 cron routes (`vercel.json`) |
| Tests | **Vitest** (node + happy-dom projects) — content/graph/ledger coverage, chat injection/XSS guards, admin/cron auth and rate-limit tests, chained into `build` · **Playwright** e2e (chromium + mobile-safari) |

## 🚀 Develop

Node 22 (`.nvmrc`; `engines` is `>=22 <23`) and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000  (predev runs Velite once; next.config.ts then keeps it in watch mode)
pnpm build        # velite --clean && vitest run && next build && pagefind  (a failing test blocks the build)
pnpm lint
pnpm test         # vitest run
pnpm e2e          # Playwright (chromium + mobile-safari) against `pnpm start` — run `pnpm build` first
pnpm clean        # wipe .next/.turbo/.velite/node_modules/.cache (run after moving/renaming the folder)
```

## 📇 Content (single source of truth)

All site content is data-driven — no fabrication, mirrors the résumé / LinkedIn / GitHub pack:

- `content/work/*.mdx` — **5 production systems** (Pensieve, AAVA Code, Wireframe Generator, Prompt-to-React, Execution Engine), honest *Co-built / architected* register + real metrics; optional `constraints` / `tradeoffs` feed the Decisions ledger.
- `content/projects/*.mdx` — **11 open-source repos** (architecture + tech + commit counts only); an optional `decisions` frontmatter array records the trade-offs behind each.
- `content/articles/*.mdx` — curated cross-posts (Dev.to, Hashnode, Medium, Substack, LinkedIn) plus native pieces; a cross-post card opens its `externalUrl` (or its `linkedNote` page), native pieces render inline. Live by default (`NEXT_PUBLIC_ARTICLES_ENABLED`).
- `content/notes/*.{md,mdx}` — engineering notes (Inkforge-generated or hand-written). **Ships dark**: unless `NEXT_PUBLIC_NOTES_ENABLED=true`, the data layer returns no notes, so `/notes`, the sitemap, RSS, `llms.txt`, the MCP tools, the chat corpus, and the raw-markdown (`.md`) endpoints all omit them together.
- `src/lib/profile.ts` — identity, headline, impact metrics, skills, achievements, résumé variants.
- `src/lib/game-model.ts` — derives the Play view's nodes/dossiers from the same content (build-time coverage test enforces no drift).
- `src/lib/decisions.ts` — flattens project `decisions` and work `constraints` / `tradeoffs` into one ledger, rendered at `/decisions` and served by the MCP `list_decisions` tool (`decisions.test.ts` enforces two-way coverage).

Edit those files; the home grids, case-study pages, the Build Graph, sitemap, chatbot corpus, and JSON-LD all update automatically.

## 💬 Chatbot configuration

The chat uses **AWS Bedrock** by default (toggle to the direct Anthropic API with `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`). Without credentials it degrades gracefully (`503` → the widget tells visitors to email / check the résumé).

```bash
cp .env.example .env.local
# LLM_PROVIDER=bedrock
# BEDROCK_ACCESS_KEY_ID / BEDROCK_SECRET_ACCESS_KEY   (base64 or raw)
# BEDROCK_REGION=us-east-1                            (NOT AWS_REGION — reserved on Vercel)
# UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (optional: rate limiting, FAQ cache, telemetry)
# LLM_USE_SONNET_5=true                               (optional: Sonnet 5 replaces Sonnet 4.6 as the primary rung; LLM_USE_SONNET_5_5=true for 5.5)
```

The Bedrock chain is Sonnet 4.6 → Opus 4.6 → Haiku 4.5; the direct-API chain is Sonnet 4.6 → Opus 4.7 → Haiku 4.5. Each attempt times out after 15 s, and a fallback only happens before the first answer byte reaches the client. The model chain + streaming fallback live in `src/lib/llm.ts`.

The grounding corpus is built in-context from `src/lib/corpus.ts` (roughly 9–11 KB, depending on whether notes are enabled) — small enough that no vector DB is needed (upgrade path: pgvector + BM25 hybrid retrieval if it outgrows the context window).

**FAQ response cache.** A repeat *first-turn* question is answered from Upstash Redis with zero chat-model spend: exact match on the normalized question (24 h TTL; entries are tagged with the corpus build, so a content deploy invalidates them), plus an opt-in semantic tier (`FAQ_CACHE_SEMANTIC_MATCH=true` — Titan embeddings, cosine ≥ 0.92; one small Bedrock embedding call per exact-tier miss). Only clean `end_turn` completions are stored; `FAQ_CACHE_ENABLED=false` is the kill switch. A hit carries `X-Chat-Cache: hit` and is logged as a `chat.cache` telemetry event; the weekly eval cron bypasses the cache (`X-Chat-Skip-Cache`). A bad cached answer can be removed with the admin-only `POST /api/admin/faq-cache/purge` (HTTP Basic, `{"question": "…"}`).

## 🎙️ Voice (optional, opt-in)

Voice is **progressive enhancement over the text chat** — it attaches to the existing `useChat` transport, so the chat backend is unchanged. Everything defaults **off** and is toggled from the ⌘K palette's **Voice** group (which also opens the voice picker and the voice-settings dialog); the text composer is always the primary channel.

| Feature | How | Cost |
|---|---|---|
| **Mic input** (push-to-talk) | A mic button in the chat composer. Speak → transcript fills the input for review. | **$0** — browser `SpeechRecognition`. |
| **Read-aloud** | A per-answer "Listen" button speaks the reply (per-sentence, starts early). | **$0** — browser `speechSynthesis`. |
| **Talk mode** | Hands-free turn-based loop (listen → think → speak) as a modal, or as the full-page Voice view (5th switcher pill on desktop). One mic at a time: while the Voice view is open, the header orb is disabled and the ⌘K talk entry is hidden. | **$0 extra** — browser STT + TTS; each turn is an ordinary chat request. |
| **Wake word** | Continuous listen for "hey portfolio" (also "hey sairam", "ask my portfolio", "hey anvil"). **Off by default**, behind a disclosure + a persistent "Listening" banner with one-tap kill. | **$0** — browser `SpeechRecognition`. |

**Privacy:** on Chrome/Edge, browser `SpeechRecognition` sends audio to the browser vendor's cloud (Google) — disclosed in-UI before the first listen; nothing is stored server-side. `getUserMedia` runs only on an explicit gesture, with a visible mic indicator and a one-tap stop that releases the mic.

**Browser support:** feature-detected. Chrome/Edge/Safari get full voice; **Firefox** (where `SpeechRecognition` is off-by-default) silently keeps the text composer — or can use the AWS Transcribe path.

**Optional AWS upgrades (flags, no new vendor — reuse the Bedrock creds):**

```bash
# Higher-quality voice output: AWS Polly Neural via /api/tts (else free browser voice).
#   Toggle in-app: ⌘K → "Use higher-quality voice (Polly)"   (offered once read-aloud is on)
# Private speech-to-text: AWS Transcribe via /api/transcribe (audio processed on your
#   own AWS, not Google; also enables voice in Firefox).
#   Toggle in-app: ⌘K → "Mic: use private transcription (AWS)"
```

Both reuse `BEDROCK_*` creds, share a per-IP `voice` rate-limit bucket (8 req/min, separate from chat; Upstash), and **fail closed** — any error degrades to the free browser path, so voice never breaks. Needs IAM `polly:SynthesizeSpeech` / `transcribe:StartStreamTranscription` on the same key (see `DEPLOY.md`).

**Optional Google Cloud TTS** (Chirp 3 HD via `/api/tts-google`) is a third engine and the one that *does* need its own key (`GOOGLE_TTS_API_KEY`; unset → `503` → the client speaks with the free browser voice). Select it in ⌘K → **Voice settings…**, which pairs the curated voice grid with an engine selector (picking a voice there syncs the engine).

📖 **Full reference: [`VOICE.md`](./VOICE.md)** — architecture, the complete feature-flag/settings table, env + IAM + cost, the privacy & a11y model, and developer notes (testing, adding an engine).

## 🌐 Deploy (Vercel)

See **[`DEPLOY.md`](./DEPLOY.md)** for the full guide (env vars, verified Bedrock model chain + IAM policy, rate limiting, the region gotcha). In short:

1. Repo: **[github.com/sairam0424/anvilry](https://github.com/sairam0424/anvilry)**.
2. Import at [vercel.com/new](https://vercel.com/new) — framework auto-detected as Next.js.
3. Add env vars (Production + Preview): `LLM_PROVIDER`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, plus `CRON_SECRET` (the five `vercel.json` cron routes fail closed with `401` without it) and `ADMIN_PASSWORD` (HTTP Basic gate for `/admin/telemetry` and the FAQ-cache purge route; unset locks both out).
4. **Branch model:** `develop` = primary working branch (Preview deploys) · `main` = release branch (Production → the live domain). Hotfixes and Dependabot security PRs have occasionally landed on `main` directly; merge `main` back into `develop` afterwards so the branches don't diverge.
5. Live at **[anvilry.vercel.app](https://anvilry.vercel.app)** (custom domain optional, via Settings → Domains).

The public base URL `https://anvilry.vercel.app` is hard-coded in about two dozen files — `src/app/layout.tsx` `siteUrl`, the sitemap, robots, RSS feed, `llms.txt`, JSON-LD, the OG images and `[slug]` pages, the MCP page and tools, the health-check expectations, the Makefile, and a few tests. Before pointing a custom domain at the deployment, list every site with `grep -rn 'anvilry\.vercel\.app' src Makefile`.

---

<sub>Anvilry is the project codename; the deployed site is **[anvilry.vercel.app](https://anvilry.vercel.app)**.</sub>
