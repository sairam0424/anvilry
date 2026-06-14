# Deploying Anvilry → Vercel (anvilry.vercel.app)

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
| `BEDROCK_REGION` | `us-east-1` | **Preferred** region var (read first). `AWS_REGION` is RESERVED on Vercel/Lambda and was seen corrupted to `s-east-1` in prod → "Connection error". Use the `BEDROCK_` name. |
| `AWS_REGION` | `us-east-1` | Fallback region (local dev). Code reads `BEDROCK_REGION` → `AWS_REGION` → `us-east-1`. |
| `BEDROCK_SESSION_TOKEN` | *(optional)* | Only for temporary STS credentials. |

> The chatbot degrades gracefully: if these are absent/invalid, `POST /api/chat` returns
> `503 {"error":"Chat is not configured."}` and the widget shows a "not switched on — email me"
> message. The rest of the site is unaffected.

**Alternative — direct Anthropic API** (no AWS): set `LLM_PROVIDER=anthropic` and
`ANTHROPIC_API_KEY=sk-ant-…` instead of the `BEDROCK_*` vars. Switching providers is an env
change only, no code change.

---

## 2b. Chat rate limiting (Upstash Redis) — recommended for production

`POST /api/chat` invokes Bedrock on every message, so each request costs real money. A per-IP
rate limiter (`src/lib/rate-limit.ts`) caps abuse at **8 requests / minute / IP** using an
Upstash Redis sliding window — distributed, so it holds across Vercel instances and regions.

> **Fails open by design.** If the two `UPSTASH_*` vars below are absent, the limiter is a
> no-op and the chatbot still works (fine for local dev). It activates automatically once the
> vars are set — no code change to turn it on.

**Setup:**
1. Create a free database at [console.upstash.com](https://console.upstash.com/) → **Redis**:
   - Name e.g. `anvilry-chat-ratelimit`; **Regional** (not Global — a limiter doesn't need it);
     pick the region nearest your Vercel deploy (e.g. **`us-east-1` / N. Virginia** to match Bedrock).
   - **Free** tier is plenty (~2 Redis commands per chat message).
2. On the database page, open the **REST API** section (the `UPSTASH_REDIS_REST_*` values — **not**
   the `redis://…` connection string). There's usually a `.env` tab to copy both at once.
3. Add both to **Project → Settings → Environment Variables** (Production, + Preview if desired):

| Variable | Value | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://<db>.upstash.io` | The **REST** URL (not `redis://…`). |
| `UPSTASH_REDIS_REST_TOKEN` | *(long REST token)* | Read+write; keep secret. |

> Window/limit is `Ratelimit.slidingWindow(8, "60 s")` with prefix `anvilry:chat` in
> `src/lib/rate-limit.ts` — change there if you want a different budget. On limit, the route
> returns `429 {"error":"Too many requests — please slow down a moment."}` with a `Retry-After`
> header; the chat UI shows *"That's a lot of questions! Give it a moment and try again."*
>
> **Verified end-to-end** against a live Upstash DB: a clean burst returns ~8×200 then `429`
> with `Retry-After`, state persists across server restarts (distributed, not in-memory), the
> window recovers after 60s, and a legitimate first request always succeeds (fail-safe).

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

### Optional: voice upgrades (Polly TTS / Transcribe STT)
Only needed if you turn on the in-app voice flags ("Use higher-quality voice (Polly)"
/ "Mic: use private transcription (AWS)"). They reuse the SAME `BEDROCK_*` key — add
these actions to the policy above. **Both fail closed**: without permission the routes
return non-2xx and the client silently falls back to the free browser voice, so the
site works fine without them.
```json
{
  "Effect": "Allow",
  "Action": ["polly:SynthesizeSpeech", "transcribe:StartStreamTranscription"],
  "Resource": "*"
}
```
Cost: browser voice is free. Polly Neural is free for 1M chars/mo for the first 12
months, then ~$16/1M (answers are cached + per-IP rate-limited); Transcribe streaming
is ~$0.024/min. Both stay negligible at recruiter traffic and are off by default.

---

## 4. Custom domain (optional)
1. Project → Settings → Domains → add your domain (e.g. `example.com` and `www.example.com`).
2. Point DNS per Vercel's instructions (A/ALIAS to Vercel, or move nameservers).
3. The base URL is hardcoded as `https://anvilry.vercel.app` in `src/app/layout.tsx`, `sitemap.ts`,
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
   - `anvilry.vercel.app/sitemap.xml`, `/robots.txt`, and the OG image (`/opengraph-image`) resolve.
   - **Four views:** the Classic · Play · Chat · Developer switcher works; `/?view=gamified` and
     `/?view=chat` still serve the full Classic HTML to crawlers (view swaps client-side), and
     `rel=canonical` on every page points to the query-less URL.
   - **Rate limit (if Upstash is set):** fire ~10 quick chat messages → the later ones should
     return `429` with the friendly "give it a moment" message, then recover after ~60s.
3. Watch **Functions → /api/chat** logs in Vercel for the `[chat] model … failed` line if a
   fallback ever fires.

---

## 6. Notes & gotchas
- **`/api/chat` runtime:** `nodejs`, `maxDuration = 30`. The Bedrock SDK needs the Node runtime
  (not Edge). A 3-model sequential fallback fits well inside 30s (each attempt has a 15s timeout).
- **Region var gotcha (real prod incident):** on the first prod deploy, `AWS_REGION` arrived in the
  Lambda corrupted as `s-east-1` (missing `u`) → an invalid Bedrock endpoint → all 3 models failed
  with `Connection error` (status=undefined) → the apology tail. `AWS_REGION` is a Vercel/Lambda
  RESERVED var; the fix is `BEDROCK_REGION` (read first in `src/lib/llm.ts`). If chat returns the
  apology in prod, check the resolved region first.
- **Region lock:** the Opus 4.6 `-v1` profile must be enabled in the configured region. A wrong region or
  un-enabled model surfaces as a 400 "model identifier is invalid" → the chain treats it as an
  availability error and falls through to Sonnet (so the chatbot stays up even if Opus is
  misconfigured — but check logs).
- **Secrets:** `.env.local` is git-ignored and is **local-dev only**. Production reads from
  Vercel env vars. Never commit real credentials.
- **Rate limiter is optional but cost-protective:** without the `UPSTASH_*` vars it fails open
  (chat works, no limit). With them, it guards Bedrock spend from bots. The Upstash free tier is
  ample; if you ever hit its daily command cap the limiter just stops limiting (fails open) — it
  never blocks legitimate chat.
- **Prompt caching:** the system prompt (the corpus in `src/lib/corpus.ts`) is cached per model;
  keep it byte-stable to preserve cache hits. A fallback to a different model re-pays the corpus
  input (acceptable for a rare event).
