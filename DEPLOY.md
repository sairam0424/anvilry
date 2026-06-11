# Deploying Anvilry → Vercel (sairam.dev)

Production deploy guide for the Anvilry portfolio. The site is a Next.js 16 app; the only
runtime dependency beyond the static build is the **"Ask my portfolio" chatbot**, which calls
Claude on **AWS Bedrock**.

---

## 0. Prerequisites
- A GitHub repo (recommended: `github.com/sairam0424/anvilry`) with this code pushed.
- A [Vercel](https://vercel.com) account.
- AWS credentials with **Bedrock InvokeModel** access, and the three Anthropic models
  **enabled in `us-east-1`** (verified live — see §3).

---

## 1. Import the project
1. [vercel.com/new](https://vercel.com/new) → import the GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build/output defaults:
   - Build command: `pnpm build` (runs `velite --clean && next build`)
   - Install command: `pnpm install`
3. Don't deploy yet — add env vars first (§2).

---

## 2. Environment variables (Project → Settings → Environment Variables)

Add these for **Production** (and **Preview** if you want PR previews to have a working chatbot).
Credential values may be **base64-encoded or raw** — the app decodes base64 automatically
(`decodeSecret` in `src/lib/llm.ts`, round-trip check), so paste them in whichever form you keep them.

| Variable | Value | Notes |
|---|---|---|
| `LLM_PROVIDER` | `bedrock` | Default. Use `anthropic` to switch to the direct API. |
| `BEDROCK_ACCESS_KEY_ID` | *(base64 or raw AWS access key)* | **Not** `AWS_ACCESS_KEY_ID` — the `BEDROCK_*` names are deliberate (avoid clashing with the AWS default credential chain). |
| `BEDROCK_SECRET_ACCESS_KEY` | *(base64 or raw AWS secret)* | |
| `AWS_REGION` | `us-east-1` | Must be the region where the Bedrock models are enabled. |
| `BEDROCK_SESSION_TOKEN` | *(optional)* | Only for temporary STS credentials. |

> The chatbot degrades gracefully: if these are absent/invalid, `POST /api/chat` returns
> `503 {"error":"Chat is not configured."}` and the widget shows a "not switched on — email me"
> message. The rest of the site is unaffected.

**Alternative — direct Anthropic API** (no AWS): set `LLM_PROVIDER=anthropic` and
`ANTHROPIC_API_KEY=sk-ant-…` instead of the `BEDROCK_*` vars. Switching providers is an env
change only, no code change.

---

## 3. Verified model chain (tested live against this AWS account, us-east-1)

The chatbot tries these in order, falling through **only** on availability errors
(429 / 404 / 5xx / connection-timeout, or a 400 that means "model unavailable"); deterministic
input errors (malformed prompt, bad creds) fail immediately rather than burning the chain.

| Tier | Bedrock inference-profile ID | Status |
|---|---|---|
| Primary | `us.anthropic.claude-opus-4-6-v1` | ✅ verified (the `-v1` suffix is **required**) |
| Secondary | `us.anthropic.claude-sonnet-4-6` | ✅ verified (bare id, no suffix) |
| Fallback | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | ✅ verified |

If you swap providers to `anthropic`, the chain becomes
`claude-opus-4-7 → claude-sonnet-4-6 → claude-haiku-4-5`.
Model IDs live in `src/lib/llm.ts` (`BEDROCK_CHAIN` / `ANTHROPIC_CHAIN`).

### Minimum AWS IAM policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": [
      "arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-opus-4-6-v1",
      "arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-sonnet-4-6",
      "arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
      "arn:aws:bedrock:*::foundation-model/anthropic.*"
    ]
  }]
}
```
(Cross-region inference profiles fan out to regional foundation models, hence the
`foundation-model/anthropic.*` resource alongside the profiles.)

---

## 4. Custom domain (sairam.dev)
1. Project → Settings → Domains → add `sairam.dev` (and `www.sairam.dev` if desired).
2. Point DNS per Vercel's instructions (A/ALIAS to Vercel, or move nameservers).
3. The base URL is hardcoded as `https://sairam.dev` in `src/app/layout.tsx`, `sitemap.ts`,
   `robots.ts`, and `json-ld.tsx` — update those if you use a different domain.

---

## 5. Deploy & verify
1. Deploy (or push to the production branch).
2. Smoke-check:
   - Home, `/projects`, `/about`, `/resume`, a case study (`/work/pensieve`), a project
     detail (`/projects/mindforge`) all render.
   - **Chatbot:** open "Ask my portfolio", ask *"What did you build at Ascendion?"* → it should
     stream a grounded answer. (Verified locally end-to-end: Opus 4.6 answered in ~8s; the
     Opus→Sonnet fallback also fires cleanly when the primary is unavailable.)
   - `sairam.dev/sitemap.xml`, `/robots.txt`, and the OG image (`/opengraph-image`) resolve.
3. Watch **Functions → /api/chat** logs in Vercel for the `[chat] model … failed` line if a
   fallback ever fires.

---

## 6. Notes & gotchas
- **`/api/chat` runtime:** `nodejs`, `maxDuration = 30`. The Bedrock SDK needs the Node runtime
  (not Edge). A 3-model sequential fallback fits well inside 30s (each attempt has a 15s timeout).
- **Region lock:** the Opus 4.6 `-v1` profile must be enabled in `AWS_REGION`. A wrong region or
  un-enabled model surfaces as a 400 "model identifier is invalid" → the chain treats it as an
  availability error and falls through to Sonnet (so the chatbot stays up even if Opus is
  misconfigured — but check logs).
- **Secrets:** `.env.local` is git-ignored and is **local-dev only**. Production reads from
  Vercel env vars. Never commit real credentials.
- **Prompt caching:** the system prompt (the corpus in `src/lib/corpus.ts`) is cached per model;
  keep it byte-stable to preserve cache hits. A fallback to a different model re-pays the corpus
  input (acceptable for a rare event).
