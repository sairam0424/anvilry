# Deploying Anvilry → Vercel (anvilry.vercel.app)

Production deploy guide for the Anvilry portfolio. The site is a Next.js 16 app; the only
runtime dependency beyond the static build is the **"Ask my portfolio" chatbot**, which calls
Claude on **AWS Bedrock**. Describes Anvilry v3.10.0 (`package.json` 3.10.0), i.e. `main` @ `a929932` plus eleven post-`a929932` behaviour changes (five in v3.7.0, two in v3.8.0: IAM-denied models fall through, and the opt-in Sonnet 5.5 primary; two in v3.9.0: the model line under chat answers and the Konami easter egg are removed; two in v3.10.0: Sonnet 4.6 backs up a 5.x primary and Opus is opt-in, and a neutral AI cue replaces the model line); the code wins.

---

## 0. Prerequisites
- A GitHub repo (recommended: `github.com/sairam0424/anvilry`) with this code pushed.
- A [Vercel](https://vercel.com) account.
- AWS credentials with **Bedrock InvokeModel** access, and the default Anthropic models (Sonnet 4.6, Haiku 4.5; Opus only with `LLM_USE_OPUS_FALLBACK`)
  **enabled in `us-east-1`** (verified live — see §3).

---

## 1. Import the project
1. [vercel.com/new](https://vercel.com/new) → import the GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build/output defaults:
   - Build command: `pnpm build` (runs `velite --clean && vitest run && next build && pagefind --site .next/server/app --output-path public/pagefind`; a failing test aborts the deploy)
   - Install command: `pnpm install`
3. Don't deploy yet — add env vars first (§2).

---

## 2. Environment variables (Project → Settings → Environment Variables)

Add these for **Production** (and **Preview** if you want PR previews to have a working chatbot). Crons, admin and cache variables are in §7.
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
rate limiter (`src/lib/rate-limit.ts`) caps abuse at **8 requests / minute / IP per route class** (`chat`, `voice`, `beacon`) using an
Upstash Redis sliding window — distributed, so it holds across Vercel instances and regions. Each class has its own bucket, so voice traffic (Polly, Google TTS, Transcribe) and the `/api/error` beacon cannot 429 your chat.

> **Fails open by design.** If the two `UPSTASH_*` vars below are absent, the limiter is a
> no-op and the chatbot still works (fine for local dev). It activates automatically once the
> vars are set — no code change to turn it on. In production without them the limiter runs unprotected and logs one `[rate-limit] CRITICAL` warning at startup; an unreachable or quota-exhausted Upstash fails open the same way.

**Setup:**
1. Create a free database at [console.upstash.com](https://console.upstash.com/) → **Redis**:
   - Name e.g. `anvilry-chat-ratelimit`; **Regional** (not Global — a limiter doesn't need it);
     pick the region nearest your Vercel deploy (e.g. **`us-east-1` / N. Virginia** to match Bedrock).
   - **Free** tier is enough for portfolio traffic, but this one database also carries telemetry, the FAQ cache, the visitor counter and cron results, and when its command quota runs out all of them fail open at once (`docs/configuration.md` §3).
2. On the database page, open the **REST API** section (the `UPSTASH_REDIS_REST_*` values — **not**
   the `redis://…` connection string). There's usually a `.env` tab to copy both at once.
3. Add both to **Project → Settings → Environment Variables** (Production, + Preview if desired):

| Variable | Value | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://<db>.upstash.io` | The **REST** URL (not `redis://…`). |
| `UPSTASH_REDIS_REST_TOKEN` | *(long REST token)* | Read+write; keep secret. |

> Window/limit is `Ratelimit.slidingWindow(8, "60 s")` per class (prefixes `anvilry:chat`, `anvilry:voice`, `anvilry:beacon`) in
> `src/lib/rate-limit.ts` — change there if you want a different budget. On limit, `/api/chat`
> returns `429 {"error":"Too many requests — please slow down a moment."}` with a `Retry-After`
> header (the voice routes answer `429 {"error":"Too many requests."}`); the chat UI shows *"That's a lot of questions! Give it a moment and try again."*
>
> **Verified end-to-end** (before the per-class split) against a live Upstash DB: a clean burst on chat returns ~8×200 then `429`
> with `Retry-After`, state persists across server restarts (distributed, not in-memory), the
> window recovers after 60s, and a legitimate first request always succeeds (fail-safe). A request carrying a valid `CRON_SECRET` bearer skips the limiter (the weekly eval cron sends 12 chats in a row).

---

## 3. Verified model chain (tested live against this AWS account, us-east-1)

The chatbot tries these in order (15 s timeout per attempt), falling through **only** on availability errors
(429 / 404 / 5xx / connection-timeout, a 400 that means "model unavailable", or a 403 that names an IAM or model-access deny) and only before any text has
streamed; deterministic errors (malformed prompt, bad or expired creds, 401 / 422, a credential 403) end the chain with the apology tail instead of burning it.

| Tier | Bedrock inference-profile ID | Status |
|---|---|---|
| Primary | `us.anthropic.claude-sonnet-4-6` (or `us.anthropic.claude-sonnet-5` / `global.anthropic.claude-sonnet-5-5` behind the opt-in flags in §7) | ✅ verified (bare id, no suffix) — fast + cost-effective |
| Behind a 5.x primary | `us.anthropic.claude-sonnet-4-6` | ✅ verified — what a failing 5.x falls back to (not listed twice when it is already the primary) |
| Opt-in (`LLM_USE_OPUS_FALLBACK=true`) | `us.anthropic.claude-opus-4-6-v1` | ✅ verified where the account allows it (the `-v1` suffix is **required**; the bare id 400s); **IAM-denied on the reference account**, which is why it is off by default |
| Last resort | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | ✅ verified |

If you swap providers to `anthropic`, the chain becomes
`claude-sonnet-4-6 → claude-haiku-4-5` (with `claude-opus-4-7` right behind the primary when
`LLM_USE_OPUS_FALLBACK=true`).

Both chains are **Sonnet-primary**, not Opus-primary. Opus used to be the second rung; the
reference account IAM-denies it, so it is out of the default chain (every fallback used to spend
a round trip on a guaranteed 403 before Haiku, a weaker model, got the request). Model IDs live in
`src/lib/llm.ts` (`bedrockChain()` / `anthropicChain()`); that file is authoritative if this
table ever disagrees with it.

### Minimum AWS IAM policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": [
      "arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:inference-profile/us.anthropic.claude-opus-4-6-v1",
      "arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:inference-profile/us.anthropic.claude-sonnet-4-6",
      "arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
      "arn:aws:bedrock:*::foundation-model/anthropic.*"
    ]
  }]
}
```
(Cross-region inference profiles fan out to regional foundation models, hence the
`foundation-model/anthropic.*` resource alongside the profiles. Inference-profile ARNs carry your account id; foundation-model ARNs do not. The `us.anthropic.claude-opus-4-6-v1` line is only needed with `LLM_USE_OPUS_FALLBACK=true`.)

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
3. The base URL `https://anvilry.vercel.app` is hardcoded in **24 files / 33 lines** (20 files / 25 lines outside tests) — not
   the four this step used to list. The count moves; find every one with:

   ```bash
   grep -rn 'anvilry\.vercel\.app' src Makefile
   ```

   Tests: `src/lib/mcp-tools.test.ts` asserts that tool output contains the host, and `src/lib/notes-dark.test.ts` classifies note-only articles by the same `…/notes/` prefix — change both with the rest or the suite goes red.
   `src/lib/content.ts` (`OWN_NOTES_URL_PREFIX`) must keep matching the own-`/notes/` URLs in `content/articles/*.mdx`, or the notes-dark filter stops recognising note-only articles.

   `src/components/json-ld.tsx` alone accounts for 6 of the non-test lines. See CLAUDE.md →
   "Environment Variables" → **Custom domain** for the per-directory breakdown. `content/articles/*.mdx` frontmatter carries the host too (14 `canonicalUrl`, 1 `externalUrl`): cross-posted copies canonicalise to your own `/notes/` URLs, so a domain change also means updating those platforms. Run the grep
   rather than trusting any list — it is the only thing that cannot go stale.

---

## 5. Deploy & verify
1. Deploy (or push to the production branch).
2. Smoke-check:
   - Home, `/projects`, `/about`, `/resume`, a case study (`/work/pensieve`), a project
     detail (`/projects/mindforge`) all render.
   - **Chatbot:** open "Ask my portfolio", ask *"What did you build at Ascendion?"* → it should
     stream a grounded answer. (Verified locally end-to-end: Sonnet 4.6 answers in ~4s. The
     fallback chain was exercised with every rung invocable back when Opus was a default rung;
     it is opt-in now — see the Opus caveat in §7.)
   - `anvilry.vercel.app/sitemap.xml`, `/robots.txt`, and the OG image (`/opengraph-image`) resolve.
   - **Views:** the Classic · Play · Chat · Dev switcher works (Voice joins as a fifth pill on desktop
     after hydration; the Resume view is reached via ⌘K or `?view=resume`, not a pill);
     `/?view=gamified` and `/?view=chat` still serve the full Classic HTML to crawlers (view swaps
     client-side), and `rel=canonical` on every page points to the query-less URL.
   - **Rate limit (if Upstash is set):** fire ~10 quick chat messages → the later ones should
     return `429` with the friendly "give it a moment" message, then recover after ~60s.
   - **Crons (once `CRON_SECRET` is set, §7):** `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/health-check`
     returns the health JSON (`status`, per-check results); the same call without the header must answer `401`.
3. Watch **Functions → /api/chat** logs in Vercel for the `[chat] model … failed` line if a
   fallback ever fires.

---

## 6. Notes & gotchas
- **`/api/chat` runtime and budget:** Node.js (Next's default: no route exports `runtime`, because
  `cacheComponents` rejects the export, and the Bedrock SDK needs Node anyway), `maxDuration = 30`.
  Each attempt has a 15s timeout, so two slow attempts already consume the budget: fast failures
  (429 / 5xx) walk the whole chain, but three sequential timeouts (3 × 15s) would hit the platform
  limit before the apology tail is sent.
- **Region var gotcha (real prod incident):** on the first prod deploy, `AWS_REGION` arrived in the
  Lambda corrupted as `s-east-1` (missing `u`) → an invalid Bedrock endpoint → all 3 models failed
  with `Connection error` (status=undefined) → the apology tail. `AWS_REGION` is a Vercel/Lambda
  RESERVED var; the fix is `BEDROCK_REGION` (read first in `src/lib/llm.ts`). If chat returns the
  apology in prod, check the resolved region first.
- **Region lock:** each model's inference-profile must be enabled in the configured region. A wrong
  region or un-enabled model surfaces as a 400 "model identifier is invalid" → the chain treats it
  as an availability error and falls through to the next model (so the chatbot stays up even if a
  model is misconfigured — but check logs). Sonnet 4.6 (primary) resolves with its bare id;
  Opus 4.6 requires the `-v1` suffix.
- **Secrets:** `.env.local` is git-ignored and is **local-dev only**. Production reads from
  Vercel env vars. Never commit real credentials.
- **Node version:** `package.json` `engines.node` is `>=22 <23`, `.nvmrc` is `22` and CI runs Node 22
  (`vercel.json` pins nothing). Keep the Vercel project's Node.js Version setting on 22.x so production
  runs the version CI tests.
- **Rate limiter is optional but cost-protective:** without the `UPSTASH_*` vars it fails open
  (chat works, no limit). With them, it guards Bedrock spend from bots. If you ever exhaust the
  Upstash free-tier command quota the limiter just stops limiting (fails open), and so do the FAQ
  cache, the telemetry sink and the visitor counter — it never blocks legitimate chat.
- **Prompt caching:** `/api/chat` sends two system blocks. The static one (the corpus from
  `src/lib/corpus.ts`) carries `cache_control` with a 1h TTL and is cached per model — keep it
  byte-stable to preserve cache hits. The hourly live GitHub stats are a separate, uncached block
  placed after the breakpoint; keep volatile data out of the static block. A fallback to a different
  model re-pays the corpus input (acceptable for a rare event). Repeat first-turn questions skip
  the model entirely via the FAQ cache (`docs/configuration.md`, "FAQ response cache").

---

## 7. Crons, admin surfaces & optional features

Set these in **Project → Settings → Environment Variables** (Production, plus Preview only if you want them there). Full semantics live in `docs/configuration.md`.

| Variable | Value | Notes |
|---|---|---|
| `CRON_SECRET` | `openssl rand -hex 32` | **Required for the five Vercel crons** in `vercel.json` (health-check, eval, github-sync, seo-audit, content-audit). Unset or wrong → every cron answers `401`, and the dashboard's Site health tile empties 25h after the last good run. Vercel Cron sends it as `Authorization: Bearer …`. |
| `ADMIN_PASSWORD` | *(long random string)* | Unlocks `/admin/telemetry` and `POST /api/admin/faq-cache/purge` (HTTP Basic; any username). Unset → both stay locked (`401`). |
| `TELEMETRY_IP_SALT` | `openssl rand -base64 16` | Optional. Hashes IP and user-agent on telemetry spans; without it the dashboard's Visitors tile shows "—". |
| `LLM_USE_SONNET_5` | `true` | Optional, off by default (the `src/lib/llm.ts` docblock keeps it an explicit opt-in until proven in production). Makes Claude Sonnet 5 the primary rung, with Sonnet 4.6 behind it. |
| `LLM_USE_SONNET_5_5` | `true` | Optional, off by default (an explicit opt-in until proven in production). Makes Claude Sonnet 5.5 the primary rung, with Sonnet 4.6 behind it, and wins over `LLM_USE_SONNET_5`. Bedrock serves it only through the **global** inference profile, so requests may be processed outside the US regions. |
| `LLM_USE_OPUS_FALLBACK` | `true` | Optional, off by default. Adds Opus right behind the primary. Leave it off unless the IAM policy grants the Opus profile: the reference account denies it, so with the rung on every fallback would first spend a round trip on a 403. |
| `LLM_THINKING_EFFORT` | `low` / `medium` | Optional. Overrides the reasoning effort on every thinking-capable rung. Unset → `medium` for Sonnet 5.x (which at `low` did not reason on any of 8 measured questions, so the reasoning panel stayed empty) and `low` for the rest. Anything else, `high` included, is ignored. |
| `FAQ_CACHE_ENABLED` / `FAQ_CACHE_SEMANTIC_MATCH` | `false` / `true` | Optional. The FAQ response cache is on by default (it needs Upstash); the first switches it off, the second adds the semantic (embedding) tier. |

**Extra IAM by feature.** The policy in §3 covers the two default Anthropic profiles (Sonnet 4.6, Haiku 4.5) and the opt-in Opus profile only. Add:
- `LLM_USE_SONNET_5=true` → the `us.anthropic.claude-sonnet-5` inference profile (enable model access for it first).
- `LLM_USE_SONNET_5_5=true` → the **global** inference profile `global.anthropic.claude-sonnet-5-5` (enable model access for Sonnet 5.5 first; there is no `us.` profile). AWS requires three allows for a global profile ([Global cross-Region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html)): the profile `arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:inference-profile/global.anthropic.claude-sonnet-5-5`, the regional model `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-5-5`, and the region-less global model `arn:aws:bedrock:::foundation-model/anthropic.claude-sonnet-5-5` under the condition `aws:RequestedRegion` = `unspecified`. The `arn:aws:bedrock:*::foundation-model/anthropic.*` line in the policy above already covers the last two unless a region condition or an SCP blocks the `unspecified` region. If any is missing, the primary answers 403 and the chain silently falls to Sonnet 4.6 (watch `fell_back` in the `llm.attempt` telemetry after enabling).
- `FAQ_CACHE_SEMANTIC_MATCH=true` → `bedrock:InvokeModel` on the foundation model `amazon.titan-embed-text-v2:0` (`foundation-model/anthropic.*` does not cover it). Without it the semantic tier silently misses; the exact-match tier is unaffected.

**Opus caveat.** The reference AWS account IAM-denies the whole Opus family, so Opus is **not in the default chain**: set `LLM_USE_OPUS_FALLBACK=true` only where the Opus profile is granted. A denied Opus rung used to be skipped (an IAM deny surfaces as a 403 whose message says `is not authorized to perform … with an explicit deny`, which is fallback-eligible), but every fallback paid a round trip on it before Haiku got the request. The same 403 wording still advances the chain for any other denied rung, for example the global Sonnet 5.5 profile when the policy lacks it. A 403 for bad or expired credentials is not eligible and still ends the chain at once with the apology tail.

**Crons and deployment protection.** Schedules (UTC): health-check `0 5 * * *`, eval `0 9 * * 1`, github-sync `0 8 * * *`, seo-audit `0 6 * * 1`, content-audit `0 7 * * 1`. The health check probes `VERCEL_PROJECT_PRODUCTION_URL` (the public alias) and does not follow redirects, so it reports Vercel's SSO wall instead of scoring it healthy. The eval, seo-audit and github-sync crons, and `/api/chat`'s live GitHub-stats fetch, use the per-deployment `VERCEL_URL`; if deployment protection covers that host they can hit the SSO wall and report nothing useful (checked for the eval cron on 2026-10-01: the generated host answers `POST /api/chat` with 401 "Protected by Vercel Authentication", so its 12 requests never reach the app and the "Eval pass rate" tile records 0 of 12 until it is moved to the production alias; not checked for github-sync, seo-audit or the live-stats fetch; only the health check has been moved). Look at the dashboard tiles after the first weekly run.
