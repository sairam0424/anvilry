# Anvilry

> The works where the Forges converge — Sairam Ugge's portfolio, live at **[sairam.dev]([https://sairam.dev](https://anvilry.vercel.app/))**.

Recruiter-facing portfolio for **Sairam Ugge** — GenAI & Backend Engineer. A fast, content-first
Next.js site with a WebGL knowledge-graph hero, a ⌘K command palette, and an "Ask my portfolio"
RAG chatbot grounded in real work. *(Anvilry is the project codename; the public site is sairam.dev.)*

## Stack

- **Next.js 16 (App Router)** + TypeScript (strict)
- **Tailwind v4** — dark-technical design system (`src/app/globals.css`)
- **Velite** — type-safe MDX content layer (`content/` → `.velite/`)
- **Motion** — scroll reveals, `prefers-reduced-motion` honored app-wide
- **React Three Fiber** — instanced knowledge-graph hero (lazy, demand-rendered, mobile/reduced-motion fallbacks)
- **cmdk** — terminal-styled command palette
- **Anthropic SDK** (`claude-opus-4-7`) — grounded first-person chatbot
- **Vercel** — hosting + Analytics + Speed Insights

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000  (Velite runs in watch mode)
pnpm build        # velite --clean && next build
pnpm lint
pnpm clean        # wipe .next/.turbo/.velite caches — run after moving/renaming the project
                  # folder (Turbopack bakes absolute paths into .next and will panic otherwise)
```

## Content (single source of truth)

All site content is data-driven — no fabrication, mirrors the résumé/LinkedIn/GitHub pack:

- `content/work/*.mdx` — production case studies (Pensieve, AAVA Code), honest "Co-built / architected" register
- `content/projects/*.mdx` — 8 open-source repos (architecture + tech + commit counts only)
- `src/lib/profile.ts` — identity, headline, skills, achievements, résumé variants

Edit those files; the home grids, case-study pages, sitemap, chatbot corpus, and JSON-LD all update automatically.

## Chatbot

The "Ask my portfolio" widget needs an Anthropic API key. Without it, the widget degrades gracefully
(tells visitors to email / check the résumé).

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
```

The corpus is built in-context from `src/lib/corpus.ts` (the whole portfolio is small enough — no vector DB).
Upgrade path: move to pgvector + BM25 hybrid retrieval if the corpus grows (e.g. blog posts).

## Deploy (Vercel + sairam.dev)

1. Push to GitHub (`github.com/sairam0424/portfolio`).
2. Import the repo at [vercel.com/new](https://vercel.com/new) — framework auto-detected as Next.js.
3. Add env var **`ANTHROPIC_API_KEY`** in Project Settings → Environment Variables (Production + Preview).
4. Add the custom domain **sairam.dev** under Project Settings → Domains; point DNS per Vercel's instructions.
5. Every push to `main` deploys to production; PRs get preview URLs.

The base URL is hardcoded as `https://sairam.dev` in `src/app/layout.tsx`, `sitemap.ts`, `robots.ts`,
and `json-ld.tsx` — update those if the domain changes.
