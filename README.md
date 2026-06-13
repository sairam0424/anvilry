# Anvilry

> **Sairam Ugge** — GenAI & Backend Engineer. Live at **[sairam.dev](https://sairam.dev)**.

A recruiter-facing engineering portfolio built as a **beast with three switchable experiences over one canonical content source** — pick the way you want to explore the same verified work:

- **🗂 Classic** — a fast, static (SSG) portfolio. The SEO-indexed default and the recruiter-in-a-hurry path.
- **🎮 Play** — an explorable **WebGL "Build Graph" + terminal**: every node is a real project/work system that opens its actual card. Accessible DOM-first index as the mobile / reduced-motion / no-JS fallback.
- **💬 Chat** — an **AI concierge console**: a RAG-grounded, first-person chatbot over the real résumé, with streaming markdown answers and generative project/work cards.

All three render from **one content layer** — zero duplication, zero fabrication. The honest contribution register (*Co-built / architected / Owned / Led*) is preserved everywhere, and every metric traces to a source file.

---

## ✨ Highlights

- **3-view architecture** — a single client `ViewProvider` switches Classic / Play / Chat without a navigation, so the WebGL context and chat transcript survive a switch. `/` stays SSG; `?view=` deep-links collapse to one canonical URL (no duplicate-content SEO hit).
- **AI concierge (AWS Bedrock)** — Claude **Opus 4.6 → Sonnet 4.6 → Haiku 4.5** availability fallback with a streaming byte-gate invariant, in-context RAG grounding, prompt-injection guardrails, and per-IP rate limiting (Upstash, fails open).
- **Generative chat cards** — the model emits only a `[[card:work:slug]]` intent token; the client resolves it against a build-time slug allowlist and renders the *real* Velite card. Zero fabrication is structural, not prompt-based.
- **Safe streaming markdown** — `react-markdown` + `rehype-sanitize` + `skipHtml` (no raw model HTML, `javascript:` links stripped), with a preprocessor that gracefully renders partial markdown mid-stream.
- **Interactive 3D Build Graph** — R3F scene with clickable/keyboard-focusable nodes, gated behind a WebGL capability probe (graceful DOM fallback), with GL-context disposal on view exit.
- **Anti-drift content layer** — a build-time test asserts a bijection between graph nodes and content (fails the deploy on an orphaned node).
- **WCAG 2.2 AA** — keyboard operability, focus management, `aria-live` announce-on-settle chat, reduced-motion + mobile fallbacks throughout.

## 🧱 Stack

| Area | Tech |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** (strict) |
| Styling | **Tailwind v4** — dark-technical design system (`src/app/globals.css`) |
| Content | **Velite** — type-safe MDX content layer (`content/` → `.velite/`) |
| Motion / 3D | **Motion** (reduced-motion aware) · **React Three Fiber** + **three.js** |
| Chat | **AWS Bedrock** (`@anthropic-ai/bedrock-sdk`) · **react-markdown** · **Upstash** rate limiting |
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

## 🌐 Deploy (Vercel)

See **[`DEPLOY.md`](./DEPLOY.md)** for the full guide (env vars, verified Bedrock model chain + IAM policy, rate limiting, the region gotcha). In short:

1. Repo: **[github.com/sairam0424/anvilry](https://github.com/sairam0424/anvilry)**.
2. Import at [vercel.com/new](https://vercel.com/new) — framework auto-detected as Next.js.
3. Add env vars (Production + Preview): `LLM_PROVIDER`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
4. **Branch model:** `develop` = primary working branch (Preview deploys) · `main` = release branch (Production → the live domain).
5. Custom domain **[sairam.dev](https://sairam.dev)** is live (Settings → Domains).

The base URL is `https://sairam.dev` in `src/app/layout.tsx`, `sitemap.ts`, `robots.ts`, and `json-ld.tsx` — update those if the domain changes.

---

<sub>Anvilry is the project codename; the public site is **sairam.dev**.</sub>
