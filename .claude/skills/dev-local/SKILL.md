---
name: dev-local
description: Start, stop, and inspect the Anvilry local dev stack. Triggers on "dev-local up", "start the stack", "bring up Anvilry locally", "start dev server".
user_invocable: true
---

# Anvilry dev-local launcher

One-command local dev stack for Anvilry. Single Next.js app with Velite content processing.

## Service / Port Map

| Service | Port | Notes |
|---------|------|-------|
| Next.js dev server | 3000 | All four views: classic / chat / game / terminal |

## Prerequisites
- Node 22+ and pnpm installed
- `.env.local` exists (run `vercel env pull .env.local` to pull from Vercel)
- `pnpm install` has been run

## Commands

### up — start the dev stack
```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm dev
```
This runs `velite --watch & next dev` — Velite watches MDX content in `content/` and Next.js
serves at `localhost:3000`. The `predev` script runs Velite once synchronously before Next.js
starts so types are ready.

### verify — smoke-test the running stack
```bash
curl -s http://localhost:3000 | grep -q "Sairam" && echo "OK" || echo "FAIL"
curl -s http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}' \
  --max-time 5 | head -c 100
```

### content — regenerate Velite output (when MDX changes not picked up)
```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm content
```

### test — run the test suite
```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm test
```

### build — full production build (Velite + tests + Next.js)
```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

## Notes
- The four views are `?view=classic` (default), `?view=gamified`, `?view=chat`, `?view=developer`
- Chat requires `LLM_PROVIDER`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION` in `.env.local`
- Feature flags: `NEXT_PUBLIC_GRAPH_PHYSICS=true` enables 3D physics, `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS=true` enables file upload
- `.velite/` is gitignored — always run `pnpm content` or `pnpm build` before type-checking
