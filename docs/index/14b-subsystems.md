---
kind: doc
title: Cross-cutting subsystem maps (part 2 of 2)
domain: [content]
status: current
version: v3.11.0
---

# Cross-cutting subsystem maps — part 2 of 2

> Part of the Anvilry v3.11.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
> **Baseline:** describes Anvilry v3.11.0 (`package.json` 3.11.0), i.e. `main` at a929932 (`package.json` 3.6.0, 297 commits past the v3.6.0 tag) plus five
> post-a929932 fixes, each described by behaviour — notes are hidden at the data layer when `NOTES_ENABLED` is
> off; rate limiting has per-class buckets (`chat` / `voice` / `beacon`) with an eval-cron bypass, built on
> `src/lib/cron-auth.ts`; admin auth goes through the shared `isAdminAuthorized` (`src/proxy.ts`,
> `requireAdmin`, the telemetry page); overlay voice entry points are gated by `isVoiceViewActive`; the
> bundle-budget gate asserts `MIN_ROUTES = 17` and verified-dead components were removed (`article-card.tsx`,
> `ui/button.tsx`, `ui/empty-state.tsx`, `ArticleJsonLd` in `json-ld.tsx`).
> Continues [`14-subsystems.md`](./14-subsystems.md), which maps subsystems 1–6 (content pipeline · view
> system · chat/LLM · voice · MCP · telemetry).

**Scope:** the "how the parts connect" layer — **subsystems 7–10 of 10** (auth & security surface · feature
flags · 3D / WebGL · build & deploy), plus the cross-subsystem coupling table, the entry-point cheat sheet,
and the UNVERIFIED / carried-forward ledger covering **both** parts. Every fact below is sourced from
sections 01–13 of this index (each of which cites its own reads) or from a direct read recorded inline.
**Files indexed:** none — this is a synthesis pass; it maps flows, entry/exit points, failure modes and the
flag/env surface that alters each one, and adds no new file inventory.

**Reading convention.** `A → B → C` is data/control flow. `path:line` citations point at the exact
construct. "Entry point" is where an external actor (visitor, crawler, agent, cron, CI) first touches the
subsystem; "exit point" is the last thing the subsystem produces before something else owns the result.

## At a glance

| # | Subsystem | Entry point | Exit point |
|---|---|---|---|
| 7 | Auth & security surface | Two credential schemes: HTTP Basic (`ADMIN_PASSWORD`) on `/admin/*` (`src/proxy.ts`, Node runtime, `config.matcher = ["/admin/:path*"]`, re-checked by the telemetry page) and on `POST /api/admin/faq-cache/purge` (route-level `requireAdmin`, outside the matcher); `Bearer ${CRON_SECRET}` on all five `/api/cron/*` routes (`unauthorizedUnlessCron`) | `401`, `notFound()` (the page re-check) or `NextResponse.next()`; everything else is public, guarded only by the enforced CSP + six other headers, three per-class rate-limit buckets (plus a separate `/api/visit` limiter), and nine sanitisation boundaries |
| 8 | Feature flags | Two mechanisms: build-time `NEXT_PUBLIC_*` reads (30 flags, a redeploy to change) and the Vercel Flags SDK when `FLAG_DRIVER=vercel` (seconds, exactly one migrated flag) | A boolean at each read site — for the one SDK flag, awaited in `RootLayout` (`src/app/layout.tsx:82-86`) and threaded as a prop into `<Providers>` and `<CommandPalette>` — plus one `[flags]` log line per resolution |
| 9 | 3D / WebGL | Mounting `<Hero>` on `/` (both hero slots), entering the gamified view (`BuildGraph`), opening any voice surface (`VoiceOrb`), or the 404 page with `NEXT_PUBLIC_404_ORB=true` | Pixels in a `<canvas>`; the hero, avatar, voice-orb and 404-orb wrappers are `aria-hidden` and decorative, the Build Graph canvas is a pointer-driven enhancement, and the accessible content is elsewhere |
| 10 | Build & deploy | `git push` (CI runs on `branches: ["**"]`), a PR into `develop` or `main`, or a manual `make deploy-preview` / `make deploy-prod` | A Vercel Preview URL (from `develop`) or the production deployment (from `main`) whose build also emits the Pagefind index, five live cron schedules, and one `[config]` cold-start line per server process |

## Coverage

**Mapped in this file (4 of 10):** 7. auth & security surface · 8. feature flags · 9. 3D / WebGL ·
10. build & deploy — followed by the cross-subsystem coupling table (23 multi-site contracts), the
entry-point cheat sheet ("if you want to change X, start at file Y", ~47 tasks), and the UNVERIFIED /
carried-forward ledger for both parts.
**Subsystems 1–6 are in [`14-subsystems.md`](./14-subsystems.md):** content pipeline · view system ·
chat/LLM request path · voice pipeline · MCP server · telemetry & observability.
**Synthesized from** sections [01](./01-routes-pages.md)–[13](./13-dependencies-and-versions.md) (each cites
its own reads), plus direct reads recorded where they are used: a `force-static` / segment-config grep across
`src/` (no `force-static`; no `runtime` / `revalidate` / `dynamic` export, only comments recording their removal), the Next 16 Proxy runtime note (`file-conventions/proxy.md`, § Runtime, in the docs bundled under `node_modules/next/dist/docs/`),
and — for subsystem 10's bundle gate — `node_modules/next/dist/lib/bundler.js:142-144`,
`node_modules/next/dist/build/index.js:2843-2844` and `node_modules/@next/bundle-analyzer/index.js:7-14`
(all re-read against the installed Next 16.3.5).

---

## 7. Auth & security surface

There are two credential schemes and no user accounts. **HTTP Basic** (one shared `ADMIN_PASSWORD`, no
username semantics) guards `/admin/*` twice — the Proxy and the page itself — and separately guards
`POST /api/admin/faq-cache/purge`, which sits outside the Proxy matcher and calls `requireAdmin` itself.
**`Bearer ${CRON_SECRET}`** guards the five `/api/cron/*` routes and doubles as the rate-limiter bypass for
the eval cron. Everything else is public. The rest of the security posture is headers, per-class rate
limiting, and nine sanitisation boundaries. Both auth predicates live in Node-only modules
(`src/lib/admin-auth.ts`, `src/lib/cron-auth.ts`) and compare SHA-256 digests with `timingSafeEqual`.

### Flow — the `/admin` gate

```
GET /admin/telemetry
   → src/proxy.ts  (Next 16 Proxy — NODE runtime by default; config.matcher = ["/admin/:path*"], :21-23)
        isAdminAuthorized(req.headers.get("Authorization")) is false
             → 401 "Unauthorized" + WWW-Authenticate: Basic realm="anvilry"                     :26-31
        otherwise → NextResponse.next()                                                          :34
   → src/lib/admin-auth.ts  isAdminAuthorized(header)                                            :24-44
        ADMIN_PASSWORD unset          → false + console.warn (never tells the client why)        :26-31
        header not "Basic "           → false                                                    :33
        Buffer.from(b64,"base64").toString("utf-8") — never throws, garbage just fails compare   :35-37
        supplied = everything after the FIRST ":" (or the whole value when there is no colon)    :39-41
        constantTimeEqual(supplied, ADMIN_PASSWORD) = SHA-256 both sides + timingSafeEqual       :43,:52-59
   → src/app/admin/telemetry/page.tsx  re-runs the SAME predicate on (await headers())           :470
        false → notFound() before any Redis read (a page cannot emit a 401 challenge)            :465-470
        then `await connection()` (request-time, required by cacheComponents)                    :478
```

One predicate, three callers: `proxy()` (`src/proxy.ts:25-31`), `requireAdmin(req)` (`admin-auth.ts:48-50`, whose deny
response adds `WWW-Authenticate` + `Cache-Control: no-store`, `:61-69`), and the telemetry page (`:470`). The
Proxy docblock (`proxy.ts:6-19`) states the runtime and the layering plainly: Node by default (the Next docs
say `runtime` is not configurable in Proxy files — `file-conventions/proxy.md`, § Runtime, in the docs bundled under `node_modules/next/dist/docs/`),
and the Proxy is "the first filter, not the only gate" — the page re-checks, so the dashboard stays protected
if the matcher is ever bypassed or edited. Guards: `src/proxy.test.ts` (unset password, missing header, wrong
same-length credential, malformed base64, both credential forms), `src/lib/admin-auth.test.ts`,
`src/app/admin/telemetry/page.test.tsx` (`notFound()` and no Redis read without credentials; renders and reads
Redis with them). All of these pin allow/deny **outcomes** only — nothing asserts that the compare is actually
constant-time (no spy on `timingSafeEqual`; the header of `admin-auth.test.ts` claims it at `:4-9`, but swapping
`constantTimeEqual` for `===` would leave the suite green), and `cron-auth.test.ts` has the same gap.

### The purge route — the one authenticated API

`POST /api/admin/faq-cache/purge` (`src/app/api/admin/faq-cache/purge/route.ts`, `maxDuration = 10` at `:4`)
is **outside** the Proxy matcher, so it authenticates itself: `requireAdmin(req)` at `:32`, then a declared
`Content-Length` ceiling of 4 KB (`:29,:36-38`), a post-parse `JSON.stringify(body).length` backstop
(`:51-53`), and a `question` that must be a non-blank string of at most 2000 characters (`:58-67`) before
`faqCachePurge(question)` (`chat-cache.ts:368`) removes that one cached answer. It is deliberately **not**
rate-limited (`:16-18`) — it is the operator remediation path for a cached answer that finished cleanly but
should not be replayed (§ The sanitisation boundaries, FAQ cache row). `route.test.ts` covers the three 401
paths (`:52-73` — no credential, wrong credential, unset `ADMIN_PASSWORD`; the first two also assert Redis is
never touched) and the authenticated contract (`:75-122` — `purged`, `not_found` answered with 200, 503 when
Redis throws, 400 for a blank or missing `question`, 413 for a declared oversize body). A new `/api/admin/*`
route inherits **no** protection from `proxy.ts`; nothing (test, lint) enforces that it calls `requireAdmin`.

### Flow — the cron gate

All five routes call one helper (`src/lib/cron-auth.ts`):

```ts
export function hasValidCronSecret(req: Request): boolean {           // :15-20
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader === null) return false;
  return timingSafeEqual(digest(authHeader), digest(`Bearer ${secret}`));
}
export function unauthorizedUnlessCron(req: Request): Response | null { // :23-26
  // null when authorised, else Response.json({ error: "Unauthorized" }, { status: 401 })
}
```

Call sites (each is `const denied = unauthorizedUnlessCron(req); if (denied) return denied;`):
`eval/route.ts:102`, `health-check/route.ts:151-153` (the `GET` signature, then the two-line guard),
`github-sync/route.ts:19`, `seo-audit/route.ts:17`, `content-audit/route.ts:20`. Properties exactly as implemented: **fail-closed** (unset or empty `CRON_SECRET`
⇒ 401, never open — `cron-auth.ts:11-12`), **constant-time** (both sides hashed to 32 bytes first, so length
never leaks and `timingSafeEqual` never throws, `:3-6,:19`), the `Bearer ` scheme is matched exactly (no
case tolerance, no trimming), no `x-vercel-*` alternative. Schedules live in `vercel.json:3-7`; all five fire
regardless and immediately 401 when the secret is unset. Guards: `src/lib/cron-auth.test.ts` (the helper) and
`src/app/api/cron/cron-auth.routes.test.ts` (the route wiring).

The same predicate is the **rate-limiter bypass**: `checkRateLimit` returns `{ ok: true }` for any request that
passes `hasValidCronSecret` (`src/lib/rate-limit.ts:100`). The eval cron relies on it — it fires 12 sequential
`/api/chat` calls carrying `Authorization: Bearer ${CRON_SECRET}` and `X-Chat-Skip-Cache: 1`
(`eval/route.ts:121-127`; `src/app/api/cron/eval/route.test.ts` asserts the bearer on all 12 calls) and would
otherwise self-throttle against the 8/min budget.

### Headers and CSP

Defined in `next.config.ts`; applied to `/:path*` at `:234`, with a `/resume` + `/resume/:path*` variant at
`:236-237`. Seven headers in total (`securityHeaders`, `:89-115`).

| Header | Value | Cite |
|---|---|---|
| `Content-Security-Policy` | **ENFORCED** (the header key at `:114` is the enforcing one, not Report-Only) | `next.config.ts:37-85,114` |
| `X-Frame-Options` | `DENY` → `SAMEORIGIN` on `/resume*` | `:90`, `:219-220` |
| `X-Content-Type-Options` | `nosniff` | `:91` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `:92` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `:97` |
| `Cross-Origin-Resource-Policy` | `same-origin` | `:98` |
| `Permissions-Policy` | `microphone=(self), camera=(), geolocation=(), browsing-topics=()` | `:100-103` |
| HSTS | **intentionally absent** — set by Vercel's platform default | `:87-88` |

Four CSP entries are load-bearing and non-obvious:

- **`'unsafe-eval'` in `script-src` is required in BOTH dev and prod** (`:43-51`). `MDXContent` evaluates
  Velite's serialized `code` string client-side with `new Function(code)`
  (`src/components/mdx-content.tsx:14-17`) on every page with an MDX body. Removing it crashes every
  project/work/note page with a React error boundary. The trust boundary is stated at
  `mdx-content.tsx:9-12`: `code` must only ever be build-time Velite output.
- **Three speech hosts in `connect-src`** (`:56-67`): `wss://speech.googleapis.com` (Chrome/Chromium Edge
  `SpeechRecognition`, subject to `connect-src` since Chrome 63 — without it every attempt fails
  `onerror.error === "network"`), `wss://speech.platform.bing.com` (Edge on Windows),
  `https://www.gstatic.com` (Chrome's online `SpeechSynthesis` voices). Recorded blind spot at `:60-61`:
  the Playwright zero-violation sweep never exercised live mic input.
- **The `/resume` override is a literal string replace** of `frame-ancestors 'none'` → `'self'`
  (`:224-227`). Editing `next.config.ts:41` (reorder or requote) silently makes the override a no-op and
  the résumé PDF iframe stops rendering.
- **`upgrade-insecure-requests` is conditional on `process.env.VERCEL`** (`:84`, rationale `:70-83`): unlike
  Chromium, WebKit obeys it on `localhost`, rewriting every sub-resource to `https://localhost:PORT` and
  breaking all client JS locally — which is what made the `mobile-safari` Playwright project fail before it
  was gated. Production's policy string is unchanged. `img-src` also allow-lists `https://img.shields.io`
  (`:53`, paired with `images.remotePatterns` at `:205-211`).

The docblock at `next.config.ts:19-20` still says the CSP is "shipped as Report-Only first"; the code at
`:104-114` (comment and header key) is the truth — enforced.

### Rate limiting

Three route classes, each with **its own** Upstash sliding window of 8 requests / 60 s per IP
(`REQUESTS_PER_WINDOW = 8`, `WINDOW = "60 s"`, `src/lib/rate-limit.ts:21-23`), prefixes `anvilry:chat` /
`anvilry:voice` / `anvilry:beacon` (`:25-29`), all built once at module load (`:33-48`, `analytics: false`
at `:42`). `checkRateLimit(req, cls)` **requires** the class (`:95-98`), so a route cannot silently share
another class's bucket. The key is the **raw** client IP, not the salted hash telemetry stores —
`x-vercel-forwarded-for`, else the LAST `x-forwarded-for` segment, else `x-real-ip`, else the literal
`anonymous` (`clientIp`, `:74-80`) — so requests carrying none of those headers all share one `anonymous`
bucket. Route → class: `/api/chat` → `chat` (`chat/route.ts:142`); `/api/tts`, `/api/tts-google`,
`/api/transcribe` → `voice` (`tts/route.ts:69`, `tts-google/route.ts:67`, `transcribe/route.ts:63`);
`/api/error` → `beacon` (`error/route.ts:101`). A burst of per-sentence TTS or error beacons therefore no
longer 429s the visitor's chat — but each class is still only an 8/min per-IP budget. All five call sites are
pinned by tests: `src/app/api/voice-rate-limit-class.test.ts` (the three voice routes charge `voice`,
`:35-46`), `src/app/api/chat/route.test.ts:131-137` (`chat`) and `src/app/api/error/route.test.ts:198-204`
(`beacon`); `src/lib/rate-limit.test.ts` pins the mechanics (`:121` one limiter per class with separate
prefixes, `:226-253` per-class isolation, `:255-` cron bypass).

It **fails open** on both paths: `{ ok: true }` when unconfigured (`:99`) and on any Upstash throw
(`:106-109`), with a production-only module-load warning as the sole signal (`:62-68`, which still names only
chat / tts / transcribe). `/api/visit` has its **own** limiter — `slidingWindow(1, "30 m")`, prefix
`anvilry:visit` (`api/visit/route.ts:38-45`) — and on denial returns the current total with `today: 0`
rather than a 429 (`:54-60`). The MCP endpoint, `/api/github/stats`, `/api/md/*` and the purge route have no
limiter.

### The sanitisation boundaries

| Boundary | What it enforces | Cite |
|---|---|---|
| **Inbound chat payload** | Declared `Content-Length` ≤ 2 MB (header only — no post-read backstop); 12 messages max, 600 chars per string block, image mediatype allowlist, `application/pdf` only, 10000-char cap on `"[PDF:"` text blocks, last message must be `user` | `src/app/api/chat/route.ts:21-22,155-158,167-252` |
| **Model output → card tokens** | Locked `[a-z0-9-]+` slug charset; resolution against the build-time Velite allowlist; unresolved tokens **dropped**, never echoed | `src/components/chat/parse-cards.ts:29-33,54-68`; gate `parse-cards.test.ts:40-75` |
| **Model output → markdown** | react-markdown vdom (never `dangerouslySetInnerHTML`) + `skipHtml` + default `urlTransform` + `rehype-sanitize` as defense-in-depth. Markdown **images are not stripped** — the component map has no `img` override and rehype-sanitize's default schema keeps `<img src="http(s)…">` — so the CSP `img-src` allowlist (`next.config.ts:53`) is the only barrier to a model-emitted image beacon. No test exercises this pipeline: `markdown-message.test.ts` covers only `closeOpenMarkdown` | `src/components/chat/markdown-message.tsx:9-16,47-84,88-95` |
| **Telemetry egress** | `redact()` on `message` and `stack` before `emit()`; salted 16-hex IP/UA hashes; transcript text and prompt text never emitted | `src/lib/telemetry/schema.ts:88-111,129-136`; `api/error/route.ts:150-166`; `api/transcribe/route.ts:105-112` |
| **External redirect** | `/articles/<slug>` redirects only after asserting an `https://` or `http://` prefix, else `notFound()` — the open-redirect guard | `src/app/articles/[slug]/page.tsx:75-81` |
| **JSON-LD** | `safeJsonLd` = `JSON.stringify(data).replace(/<\//g, "<\\/")`, because `JSON.stringify` alone does not escape `</script>` | `src/components/json-ld.tsx:4-10` |
| **Voice engine params** | `validateVoiceForEngine` rejects unknown ids, engine mismatches, and tier disagreements server-side; no `tier` field is accepted from the client | `src/lib/voice-catalog.ts:346-367`; `api/tts/route.ts:103-108`, `api/tts-google/route.ts:101-106` |
| **Analytics** | `commandEventName` returns the registered command word or the literal `"unknown"` — never raw input or args | `src/components/game/terminal/commands.ts:755-758` |
| **FAQ cache write** | Only a clean `end_turn` completion from the primary rung is cached (a `fell_back` answer never is), after control-byte stripping and a 1–4000-character bound; first-turn string questions only; 24 h TTL; entries are tagged with the corpus build stamp, so a content deploy invalidates them. It checks completion *cleanliness*, not content safety — a jailbreak that finishes cleanly would be cached, which is why the purge route exists | `src/lib/chat-cache.ts:23-50,63,79,265-282`; `chat/route.ts:276-286` |

### Failure modes

| Failure | Mechanism |
|---|---|
| `/admin` open | Both `src/proxy.ts` not executing (matcher edited, file moved) **and** the page's own re-check removed (`admin/telemetry/page.tsx:470`). Either alone still denies; with only the page check, an unauthorised request gets a `404`, not a `401` challenge. |
| A new `/api/admin/*` route is open | It is outside the matcher (`proxy.ts:21-23`); only an explicit `requireAdmin(req)` (as at `purge/route.ts:32`) protects it, and no test or lint rule catches a missing call. |
| `/admin` locked out entirely | `ADMIN_PASSWORD` unset — deliberate (`admin-auth.ts:26-31`); the client sees a bare 401 challenge, the server logs `[admin-auth]`. |
| All five crons 401 | `CRON_SECRET` unset — deliberate fail-closed (`cron-auth.ts:11-12`). Nothing then refreshes the health result, whose Redis key `anvilry:health:latest` expires 90,000 s (25 h) after the last run that reached the write (`health-check/route.ts:220-221`), so the dashboard's "Site health" tile falls back to its "run /api/cron/health-check to populate" placeholder (`admin/telemetry/page.tsx:829-842`) about a day later. |
| Eval cron self-throttles | The `CRON_SECRET` bearer removed from the eval cron's `/api/chat` calls (`eval/route.ts:124-126`), or `hasValidCronSecret` dropped from `checkRateLimit` (`rate-limit.ts:100`) — 12 sequential chats then hit the 8/min chat bucket. Both halves are pinned (`eval/route.test.ts`: the bearer on all 12 calls; `rate-limit.test.ts:255-`: the bypass). A separate budget risk remains: each call is bounded by `AbortSignal.timeout(25_000)` (`eval/route.ts:131`) inside `maxDuration = 60` (`:5`), so a slow chain can outlive the function before the Redis write (`:176`). |
| Wrong bucket charged | A route calling `checkRateLimit` with the wrong class — TypeScript demands *a* class but cannot tell which is right. The five existing call sites are each pinned by a test (voice ×3 in `voice-rate-limit-class.test.ts`; `chat` in `chat/route.test.ts:131-137`; `beacon` in `error/route.test.ts:198-204`); a **new** route is pinned by nothing. |
| Every MDX page crashes | `'unsafe-eval'` removed from `script-src`. |
| Voice permanently broken in production | The Chrome speech WebSocket host removed from `connect-src`. |
| Résumé PDF iframe blank | The `frame-ancestors` string replace no longer matching `next.config.ts:41`. |
| Local WebKit runs no client JS | `upgrade-insecure-requests` made unconditional (`next.config.ts:84`). |
| Unbounded AWS spend | Rate limiting fails open in both failure modes; `/api/chat` is the cost-bearing endpoint. `x-chat-skip-cache` is a presence-only header any client can send to bypass the FAQ cache (`chat/route.ts:276`) — it forfeits the saving for that request but is still limited; the one exception is a request carrying the valid `CRON_SECRET` bearer, which skips the limiter altogether (`rate-limit.ts:100`). |
| A bad answer replayed for 24 h | A jailbreak that finishes with `end_turn` passes the FAQ write gate (`chat-cache.ts:278`); remediate with the purge route. |
| `/admin/*` crawled | `src/app/robots.ts:3-17` is allow-all (`userAgent: "*"`, `allow: "/"`) with **no** `disallow` entries; the protection is the Proxy, not robots. |

### Flags / env that alter it

`ADMIN_PASSWORD`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`/`_TOKEN` (whether rate limiting and the FAQ cache
exist at all), `FAQ_CACHE_ENABLED` (kill switch, default on, `chat-cache.ts:129-131`) and
`FAQ_CACHE_SEMANTIC_MATCH` (embedding tier, default off, `:121-123`), `TELEMETRY_IP_SALT`,
`TELEMETRY_ENABLED` (honoured by `/api/error` only, `error/route.ts:92`), `FLAGS_SECRET` (what
`verifyAccess` validates on `/.well-known/vercel/flags`, `src/app/.well-known/vercel/flags/route.ts:6-7`).
No `NEXT_PUBLIC_*` flag gates any security control.

---

## 8. Feature flags

### The two mechanisms

```
MECHANISM A — build-time NEXT_PUBLIC_* env  (latency: a redeploy)
  Vercel dashboard / .env.local
    → inlined by Next at build time
    → read as `process.env.NEXT_PUBLIC_X === "true"` in the module or function that needs it
    → 30 flags: writing-flags.ts (10), enabled-views.ts (1), voice-picker-mode.ts (1), llm-sdk-mode.ts (1),
      flags.ts (1, the build-time fallback of DISCOVERY_BADGES) and 16 component-local reads
      (a 31st name, NEXT_PUBLIC_BUILD_YEAR, is a build-time constant written by next.config.ts, not a flag)

MECHANISM B — Vercel Flags SDK  (latency: seconds)
  FLAG_DRIVER=vercel  (read ONCE at module load, src/lib/flags.ts:13)
    → flag<boolean>({ key: "NEXT_PUBLIC_DISCOVERY_BADGES", defaultValue: false, decide: () => false })
      declared at src/lib/flags.ts:17-29 — the SDK checks the override cookie BEFORE decide(),
      which is why decide() returning false does not defeat a dashboard override (:25-28)
    → awaited server-side in getDiscoveryBadgesEnabled()  (:41-55)
    → /.well-known/vercel/flags exposes exactly this ONE flag (route.ts:9-24), verifyAccess-gated (:6-7)
```

### The resolver

```
getDiscoveryBadgesEnabled()                                     src/lib/flags.ts:41
  ├─ useVercelDriver (captured at module load, :13)
  │     true  → await the Flags SDK declaration        → logs [flags] {driver, value, flags_secret_present}   :42-55
  │     false → process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true"   (:58)
  │             → logs [flags] {driver, value, source: "env_var" | "default_false"}   (:59-70)
  ▼
src/app/layout.tsx:82-86  RootLayout awaits it server-side (the await is :85)
  ▼
threaded as a PROP into <Providers discoveryBadgesEnabled>       layout.tsx:132
                    and into <CommandPalette discoveryBadgesEnabled>   layout.tsx:143
  ▼
src/components/providers.tsx:60  mounts <DiscoveryBadge> only when true
src/components/command-palette-content.tsx:230-244  adds the "Unlock all discoveries" action only when true
```

`flags.ts` migrated **exactly one** flag. Its docblock (`:7-8`) states that all other beast-mode flags
remain plain `NEXT_PUBLIC_` reads in their own files. `DiscoveryBadge` itself never reads the flag
(`src/components/game/discovery-badge.tsx`).

### Every flag, and what it gates

**`src/lib/writing-flags.ts` — 9 booleans + 1 enum, all build-time**

| Flag | Export | Default | Predicate | Gates |
|---|---|---|---|---|
| `NEXT_PUBLIC_ARTICLES_ENABLED` | `ARTICLES_ENABLED` | **true** | `!== "false"` (the only opt-out) `:19-20` | `/articles` subtree via `articles/layout.tsx:12`; nav link (`site-nav.tsx:45`); sitemap (`sitemap.ts:68`); `WritingPreview` (`home/writing-preview.tsx:11`) |
| `NEXT_PUBLIC_NOTES_ENABLED` | `NOTES_ENABLED` | false | `=== "true"` `:22` | **The data layer:** `allNotes` is `[]` while off (`lib/content.ts:56`), so llms.txt, the RSS feed, the MCP tools, the chat corpus and both `.md` handler sets publish no notes, and articles whose only destination is a note are dropped (`content.ts:82`). Route layer: `/notes` via `notes/page.tsx:21`; `/notes/[slug]` via `notFound()` at `notes/[slug]/page.tsx:51` (its `generateStaticParams` still prerenders every *published* slug as a 404, `:16-26`); article `linkedNote` redirects (`articles/[slug]/page.tsx:71`); nav (`site-nav.tsx:48`); sitemap (`sitemap.ts:41`). The `linkedNote` → `/notes/<slug>` link is chosen only while the flag is on in `article-group-card.tsx:21`, `related-writing.tsx:13`, `articles/page.tsx:199,272` and `llms-txt.ts:29` (otherwise the entry uses `externalUrl`). Two older per-surface filters for note-only articles remain (`sitemap.ts:64-66`, `articles/[slug]/page.tsx:43`, with a matching guard at `:84`) and are now subsumed by `allArticles`. Pinned by `src/lib/notes-dark.test.ts` |
| `NEXT_PUBLIC_OPEN_TO_WORK` | `OPEN_TO_WORK` | false | `:24` | `OpenToWorkBanner`, gated in the caller (`layout.tsx:134`); the chat and developer views also subtract the banner's height (`OPEN_TO_WORK_BANNER_HEIGHT_REM`, `:34`) from their exact-height `<main>` (`chat-view.tsx:79-81`, `developer-view.tsx:39-41`) |
| `NEXT_PUBLIC_STATS_ENABLED` | `STATS_ENABLED` | false | `:38` | **Nav + sitemap only** (`site-nav.tsx:53`, `sitemap.ts:87`) — `/stats` still renders and prerenders |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `SEARCH_ENABLED` | false | `:40` | **Nav + sitemap only** (`site-nav.tsx:54`, `sitemap.ts:97`) — same as `/stats` |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `TESTIMONIALS_ENABLED` | false | `:44-45` | `home/testimonials.tsx:13` — the only gate; with the flag on and an empty `testimonials` array it renders a "recommendations coming soon" card (`:15-36`). (`hasTestimonials` is consumed by the chat corpus, `corpus.ts:69`, not by this component.) |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `INKFORGE_ARTICLES_ENABLED` | false | `:49-50` | `articles/page.tsx:44` (`visibleInkforge`) |
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `GITHUB_STATS_ENABLED` | false | `:54-55` | `GithubStatsStrip` on `/`, mounted from `home/hero.tsx:159-165` |
| `NEXT_PUBLIC_CHROME_TTS_BANNER` | `CHROME_TTS_BANNER_ENABLED` | false | `:92-93` | Chrome TTS advisory in `talk-mode.tsx:349-351` |
| `NEXT_PUBLIC_ARTICLE_DEDUP_KEY` | `ARTICLE_DEDUP_KEY` | `"linkedNote"` | enum `:76-80` | `article-grouping.ts:30` `DEFAULT_CONFIG.primaryKey`; only matters for articles with **both** `linkedNote` and `canonicalUrl` |

**`src/lib/enabled-views.ts`**

`NEXT_PUBLIC_ENABLED_VIEWS` — comma list intersected with `ALL_OPTIONAL = ["gamified","chat","developer","voice","resume"]`
(`:20-21`). **Unset ⇒ all on; empty string ⇒ every toggleable view off**, distinguished at `:28`. `classic` and
`resume` are unconditionally true (`ALWAYS_OPTIONAL`, `:20`; `isViewEnabled`, `:38`). Unknown entries are
silently dropped (`:33`). Gates `view-router.tsx:62-69` and `view-switcher.tsx:101-104`.

**Component-local reads**

| Flag | Read at | Gates |
|---|---|---|
| `NEXT_PUBLIC_ANVIL_ORB_MODE` | `header-orb-trigger.tsx:36` | `inplace \| modal \| off`, default `inplace` (`:35-40`) |
| `NEXT_PUBLIC_ENABLE_ANVIL_ORB` | `header-orb-trigger.tsx:38` | legacy `"false"` → `off` |
| `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE` | `header-orb-trigger.tsx:46` | `core \| classic` panel chrome |
| `NEXT_PUBLIC_VOICE_PICKER_MODE` | `voice-picker-mode.ts:20` | `descriptor` (default) \| `gender` layout |
| `NEXT_PUBLIC_VOICE_TEST_AUDIO` | `talk-mode.tsx:494` | the "🔊 Test audio" button |
| `NEXT_PUBLIC_ORB_POSTPROCESSING` | `voice-orb-3d.tsx:300` | Fluid/Bloom/Vignette/Noise/CA — **and** `getDeviceTier() === "high"` (`:301,:327`) |
| `NEXT_PUBLIC_INK_TRANSITION` | `view-context.tsx:123-126` (read at `:125`) | WebGL2 ink-burn view-transition path |
| `NEXT_PUBLIC_SKILL_TREE` | `game-view.tsx:57` | the SVG skill tree in the Play view |
| `NEXT_PUBLIC_404_ORB` | `not-found.tsx:34` (module scope) | distressed orb on the 404 page |
| `NEXT_PUBLIC_VISITOR_COUNTER` | `site-footer.tsx:118` | footer visitor badge (client-side gate only; `/api/visit` has no flag check, `api/visit/route.ts:14-16`) |
| `NEXT_PUBLIC_RESUME_VARIANTS` | `resume/page.tsx:29`, `home/resume-view.tsx:46`, `command-palette-content.tsx:365`, `game/terminal/commands.ts:297` | all `resumeVariants` vs only `resumeVariants[0]` — **currently a no-op**: `resumeVariants` (`src/lib/profile.ts:136-142`) has exactly one entry, so both branches yield the single master PDF. `developer-rail.tsx:45` is not gated at all; it maps the same one-entry list. |
| `NEXT_PUBLIC_HERO_MODE` | `home/hero.tsx:25` (branched `:30`), re-checked `hero-avatar/index.tsx:50` | `"avatar"` → `HeroAvatar`, else `HeroGraph` |
| `NEXT_PUBLIC_AVATAR_POSITION` | `hero-avatar/index.tsx:51` | `hero-side` (default) \| `hero-split` \| `hero-top`; unknown values fall through to `hero-top` |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | `hero-graph/index.tsx:10` (**module scope**) | `./scene-physics` vs `./scene` |
| `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` | `chat-view.tsx:259` | the file picker |
| `NEXT_PUBLIC_PDF_ATTACHMENTS` | `file-picker-button.tsx:7` | `application/pdf` in the accept list |
| `NEXT_PUBLIC_EXTENDED_THINKING` | `chat-messages.tsx:165` | the thinking block (`!== "false"`, default ON) |
| `NEXT_PUBLIC_LLM_SDK` | `llm-sdk-mode.ts:26` | **nothing** — `llm-sdk-mode.ts` has zero importers (only its test); the `aws-sdk-bedrock` branch is unbuilt (`:13-15`) |
| `NEXT_PUBLIC_BUILD_YEAR` | written `next.config.ts:127`, read `site-footer.tsx:239` | the footer copyright year (an in-render `new Date()` fails the prerender under `cacheComponents`) — a constant, not a flag |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | `flags.ts:58,65` | the ★ N/4 badge — the one flag on Mechanism B |

**Server-side, non-prefixed**

`EXTENDED_THINKING` (`api/chat/route.ts:339`, default ON) is the server half of the pair whose client half is
`NEXT_PUBLIC_EXTENDED_THINKING` above — one decides whether the model is asked to think, the other whether the
block renders, and they are independent; `LLM_USE_SONNET_5` (`llm.ts:45-47`, default OFF — swaps the primary
rung of both model chains to Sonnet 5); `LLM_USE_SONNET_5_5` (default OFF, the same swap to Sonnet 5.5, which wins over it); `LLM_USE_OPUS_FALLBACK` (`llm.ts:75-77`, default OFF — puts Opus 4.6 back as a rung behind the primary); `LLM_THINKING_EFFORT` (`llm.ts:182-189`, exactly one of `low`, `medium`, `high`, `xhigh`, `max`, with `xhigh` sent as `max` off Sonnet 5.x; unset → `medium` on Sonnet 5.x, `low` elsewhere); `FAQ_CACHE_ENABLED` (default ON) and `FAQ_CACHE_SEMANTIC_MATCH`
(default OFF) (`chat-cache.ts:121-131`); `TELEMETRY_ENABLED` (`api/error/route.ts:92`); `FLAG_DRIVER`, `FLAGS`,
`FLAGS_SECRET`.

**Runtime, not env** — the scroll A/B pair: `?scroll=` > `localStorage["anvilry.scroll.engine"]` >
`DEFAULT_ENGINE = "custom"`, and `?scrollmode=` > `localStorage["anvilry.scroll.mode"]` >
`DEFAULT_MODE = "bottom-pin"` (`src/lib/scroll/scroll-flags.tsx:21-25`, resolver
`src/lib/scroll/resolve-flag.ts:12-21`). Described in-file as dev/bake-off conveniences, not user
settings (`scroll-flags.tsx:15`).

### Failure modes

| Failure | Mechanism |
|---|---|
| Flag change has no effect | Every `NEXT_PUBLIC_*` value is inlined at build time — a redeploy is required (`writing-flags.ts:16`). |
| `FLAG_DRIVER` change has no effect | Captured once at module load (`flags.ts:12-13`); needs a process restart. |
| All toggleable views vanish | Setting `NEXT_PUBLIC_ENABLED_VIEWS=""` (empty ≠ unset, `enabled-views.ts:28`). |
| A view silently disappears | A typo in the comma list — unknown entries are dropped by the `ALL_OPTIONAL.includes(v)` filter (`:33`). |
| A section's default flips | Mixing the two polarity conventions: `ARTICLES_ENABLED` is `!== "false"`; every other boolean is `=== "true"`. |
| Notes leak on one surface while dark | Reading `publishedNotes` (raw) instead of `allNotes` on a public surface — only the `/notes` route files may (`content.ts:47-49`), because `cacheComponents` needs `generateStaticParams` to return ≥1 slug even while the section is dark. `notes-dark.test.ts` guards llms.txt, the feed, MCP, the corpus and both `.md` handlers. |
| `vi.stubEnv` stops working in tests | Hoisting a flag read from inside a function body to module scope. Deliberately inside the body at `resume/page.tsx:28-29`, `home/resume-view.tsx:45-47`, `command-palette-content.tsx:363-366`, `commands.ts:296-299`, `hero.tsx:24-25`, `hero-avatar/index.tsx:49-51`. |
| Route renders despite its flag being off | `/stats` and `/search` are not route-gated — only unlinked and un-sitemapped. |
| Discovery badge never appears | The flag is resolved server-side and threaded as a prop; `providers.tsx:60` is the gate, not the component. |
| Client shows a thinking block the server never requested (or vice versa) | `EXTENDED_THINKING` (server) and `NEXT_PUBLIC_EXTENDED_THINKING` (client) flipped independently. |

---

## 9. 3D / WebGL

Four independent canvas mount points exist (hero slot, build graph, voice orb, 404 orb); the gates aim at
one live GL context per surface — at most one hero canvas and one orb canvas are live at a time.

### Flow

```
GATE (evaluated in a client component, before any import resolves)
  hero graph :  isDesktop(min-width:768px) && !reduced && webglOk && !webglFailed && view === "classic"
                                                                  hero-graph/index.tsx:63-64
  hero avatar:  heroMode === "avatar" && isDesktop && !reduced && view === "classic"
                (no WebGL probe, no onFail latch)                 hero-avatar/index.tsx:54,:56
  build graph:  isDesktop && !reduced && webglOk && !webglFailed && !talkOpen   game/build-graph.tsx:50
                (talkOpen ORs all three voice stores, :38 → exactly one live context)
  voice orb  :  isDesktop && webgl && !reduced && !glFailed       chat/voice-orb.tsx:42
        │  false on ANY term → CSS glow fallback / 2D canvas orb / DOM index; no WebGL at all
        ▼
LAZY BOUNDARY   next/dynamic(..., { ssr: false })
  hero-graph/index.tsx:18-23   → ./scene-physics  OR  ./scene   (target fixed at module eval, :10)
  hero-avatar/index.tsx:10-13  → ./avatar-scene
  game/build-graph.tsx:16      → ./build-graph-scene
  chat/voice-orb.tsx:13-16     → ./voice-orb-3d        (app/not-found.tsx:29-32 imports the same module)
        ▼
ERROR CONTAINMENT
  <WebGLBoundary> wraps: hero-graph/index.tsx:79 · hero-avatar/index.tsx:59 · build-graph.tsx:60 ·
                         voice-orb.tsx:46 · not-found.tsx:47
  onFail latch passed by: hero-graph, build-graph, voice-orb (each flips to its fallback);
                          NOT by hero-avatar or the 404 orb
  render() returns null on failure; console.warn hardcoded "[build-graph]"   webgl-boundary.tsx:25,:30
  Boundaries catch only SYNC throws — R3F context-creation failure is an async unhandled rejection,
  which is why useWebGLSupported() probes proactively (use-media-query.ts:21-47).
  That probe is used by hero-graph/index.tsx:54, build-graph.tsx:29 and voice-orb.tsx:38 — NOT by
  hero-avatar/index.tsx. hero-graph/index.tsx:38-49 records the residual gap: a context that fails
  ASYNCHRONOUSLY after the probe passes leaves the canvas mounted broken and onFail never runs.
        ▼
BARREL      src/lib/r3f.ts  — named re-exports only; `export * as THREE from "three"` (:21)
            ONE module-graph node for the whole R3F universe → one shared chunk
            next.config.ts:169: "The src/lib/r3f.ts barrel stays — it is load-bearing for the single-copy outcome"
            EXCEPTIONS: hero-graph/scene-physics.tsx:4-6 imports @react-three/fiber + three DIRECTLY;
                        chat/voice-orb-3d.tsx:5-6 imports `postprocessing` (BlendFunction) and
                        `@whatisjery/react-fluid-distortion` (Fluid) DIRECTLY
        ▼
CANVAS      hero graph  frameloop="demand"   scene.tsx:136
            avatar      frameloop="demand"   avatar-scene.tsx:22
            physics     frameloop="always"   scene-physics.tsx:20
            build graph frameloop="demand"   build-graph-scene.tsx:155
            voice orb   errorMode ? "demand" : "always"   voice-orb-3d.tsx:306
            all: dpr={[1, 1.75]} · gl={{antialias:true, alpha:true, powerPreference:"high-performance"}} ·
                 resize={{offsetSize:true}} on every canvas except the voice orb
        ▼
SCENE       hero graph : 1 instancedMesh for all graphNodes + 1 lineSegments for all edges
                         + Rig eases rotation toward a module-level `ptr` singleton;
                         node/edge colours come from useThemeColors() + resolveKindColor(), so they follow the theme
            avatar     : useGLTF("/avatar/sairam.glb") → resolveRig(scene) → one useFrame loop
                         driving head/neck bones, 8 ARKit eye morphs, chest/spine breathing
            build graph: one mesh PER node (hover/click needs it) + one lineSegments + OrbitControls
            voice orb  : 5-octave fBm domain-warped icosahedron + inverted-fresnel halo shell
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/use-media-query.ts:7-17,19-47` | `useMediaQuery` (server snapshot `false`, `:15`) and the memoized `useWebGLSupported` probe (`webgl2` → `webgl` → `experimental-webgl`, any throw ⇒ false, `:32-44`). |
| 2 | `src/lib/use-reduced-motion.ts:8-22` | The native hook, written to avoid importing `motion/react` for this alone. The hero gates use it; `build-graph.tsx:5` and `voice-orb.tsx:5` still import `useReducedMotion` from `motion/react`. |
| 3 | `src/components/home/hero.tsx:25,30` | The sole mount point for both hero slots. |
| 4 | `src/components/hero-graph/index.tsx:10-23,51-64,71-85` | Flag-fixed dynamic target; the five-term gate (desktop, reduced motion, WebGL probe, boundary `onFail` latch, classic view); the always-rendered CSS glow fallback + radial mask + scrim. Guarded by `index.dom.test.tsx`. |
| 5 | `src/components/hero-avatar/index.tsx:49-62,64-110` | Flags read **inside** the function body (for `vi.stubEnv`); `WebGLBoundary` (no probe, no `onFail`); three layout wrappers. Guarded by `index.dom.test.tsx`. |
| 6 | `src/components/game/build-graph.tsx:26-50` | The five-term gate incl. the three voice stores (`:35-38`). |
| 7 | `src/components/chat/voice-orb.tsx:36-51` | Capability tiering with a permanent flip to the 2D orb on failure. |
| 8 | `src/components/game/webgl-boundary.tsx:13-33` | The only WebGL error boundary; class component because only class boundaries catch descendant render errors (`:10-12`); optional `onFail` callback (`:14,:26`). |
| 9 | `src/lib/r3f.ts:16-27` | The barrel. Also the **only** import site for `@react-three/drei` and `@react-three/postprocessing` in the repo. |
| 10 | `src/components/hero-graph/scene.tsx:8-9,16,20-59,62-88,91-109,133-148,151-153` | `SCALE = 1.6`; the `idx` map; the module-level `ptr` singleton; instanced nodes (geometry/material disposed on unmount, `:49-56`); batched edges; `Rig` with the `\|delta\| > 0.0006` settle threshold (`:106`); `HeroGraphInner` (`:151`) is what the physics variant embeds. |
| 11 | `src/components/hero-graph/scene-physics.tsx:17-52` | `frameloop="always"` (`:20`); `DriftWrapper` **sets** (never accumulates) sinusoidal position (`:42-44`); reduced motion handled inside the frame callback (`:38`); embeds `HeroGraphInner` from `./scene` (`:8,:49`) inside its own `Canvas`. |
| 12 | `src/components/hero-avatar/avatar-scene.tsx:17-34` | Owns `controlsRef` (`:18`) — the only channel between input and animation, never React state. |
| 13 | `src/components/hero-avatar/avatar-mesh.tsx:10,27,29-42,44-56,61-115` | Module-scope `useGLTF.preload` (a real network fetch on import); the one lazily-initialised rig ref; a dispose-on-unmount traversal of geometries and materials (the 13 WebP textures are never disposed individually); the single frame loop. |
| 14 | `src/components/hero-avatar/rig.ts:1-4,31-67` | Pure single-traversal bone/morph resolver; type-only `three` import to stay off the runtime graph (`:1-4`). |
| 15 | `src/components/hero-avatar/use-avatar-gaze.ts:16-36,42-54` / `use-avatar-idle.ts:13-16,21-31` | Pure signal generators (`computeGaze`, `computeIdle`) returning refs; `useAvatarIdle` calls `invalidate()` **every** frame (`:27`). |
| 16 | `src/components/hero-avatar/avatar-controls.tsx:21-52` | Window-level `mousemove`/`touchmove` (`:43-44`; the canvas is `pointer-events: none`) → ref + `invalidate()`; renders `null`. |
| 17 | `src/components/game/build-graph-scene.tsx:11,49-123,148-174` | `SCALE = 1.6`; per-node meshes (`:81-99`); hover lerp with a `> 0.005` invalidate threshold (`:76`); OrbitControls with pan/zoom disabled (`:165-171`). |
| 18 | `src/components/chat/voice-orb-3d.tsx:46-98,168-190,255-280,300-348` | GLSL simplex noise + 5-octave fBm (`:46-98`); the halo shell (`:168-190`, mesh `:256`); the double-gated post-processing chain (`postFx` `:300` **and** `tier === "high"` `:327`). |
| 19 | `public/avatar/sairam.glb` | 1,105,768 B glTF 2.0, `glTF-Transform v4.4.2`, meshopt + WebP + quantized, 13 images all `image/webp`, 5 skins, 57 nodes (parsed directly from the GLB JSON chunk). |
| 20 | `src/lib/avatar-glb.test.ts` | The build-blocking asset invariant suite. |

### Entry point

Mounting `<Hero>` on `/` (both hero slots), entering the gamified view (`BuildGraph`), opening any voice
surface (`VoiceOrb`), or rendering the 404 page with `NEXT_PUBLIC_404_ORB=true`.

### Exit point

Pixels in a `<canvas>`. The hero graph, hero avatar, voice orb and 404 orb sit in `aria-hidden` wrappers
(`hero-graph/index.tsx:68`, `hero-avatar/index.tsx:68,88,104`, `voice-orb-3d.tsx:304`, `not-found.tsx:46`) and
are decorative; the Build Graph canvas is **not** `aria-hidden` but is a pointer-driven enhancement — the
accessible content is elsewhere (`GraphIndex` for the graph, the visible caption + live region for the orb).

### Perf decisions, concretely

| Decision | Value | Cite |
|---|---|---|
| DPR clamp | `[1, 1.75]` on all hero/graph canvases | `scene.tsx:141`, `scene-physics.tsx:23`, `avatar-scene.tsx:25`, `build-graph-scene.tsx:160`; voice orb `voice-orb-3d.tsx:309` |
| Mobile cutoff | `(min-width: 768px)` — the whole WebGL layer is skipped below it | `hero-graph/index.tsx:53`, `hero-avatar/index.tsx:46`, `build-graph.tsx:28`, `voice-orb.tsx:37` |
| Draw-call batching (hero) | one `instancedMesh` for all nodes, one `lineSegments` for all edges | `scene.tsx:58,79` |
| Demand-loop settle | re-`invalidate()` only while `\|delta\| > 0.0006` | `scene.tsx:106` |
| Resize race fix | `resize={{ offsetSize: true }}` — fixes "canvas stuck at 300×150" when the ResizeObserver reports 0 on first measure | `scene.tsx:139` (rationale in the comment at `:137-138`) |
| Chunk dedup | the `src/lib/r3f.ts` barrel; `three`/`fiber`/`drei` deliberately **excluded** from `optimizePackageImports` (which is `["lucide-react","motion"]`) | `next.config.ts:146-151,166-170` |
| Recorded chunk measurement | 16.2.9: 2036 KB / 5 chunks (two 876 KB copies) → 16.3.0: 1160 KB / 4 chunks (one copy), −876 KB | `next.config.ts:153-164` |
| Live perf contract | exactly 1 three.js copy (`grep -l WebGLRenderer \| wc -l` must be 1 — the `react-three` grep returns 5 and is **not** the copy count), 1248 KB across R3F chunks, 113/113 static pages — recorded on 2026-08-15 (post-#121/#123/#124, before the 3.6.0 cut) and **not re-measured** for a929932 (no build was made for this index) | `domains/performance/README.md:85-91` |
| Enforced in CI | the same `WebGLRenderer` marker, asserted mechanically: the chunk carrying it (897,249 B per the script's comment) must appear in **zero** routes' first-load sets, and no route may exceed `MAX_FIRST_LOAD_BYTES = 1_336_000`. Runs on the `e2e` job's existing build, reading `.next/diagnostics/route-bundle-stats.json` | `scripts/bundle-budget.mjs:72,76-83,84,146-154`; step at `.github/workflows/ci.yml:190-191`; § 10 The bundle budget gate |
| Asset budget | `MAX_BYTES = 1.5 * 1024 * 1024`; current asset 1,105,768 B | `src/lib/avatar-glb.test.ts:21,58-61` |
| LOD | **none exists** — no `<Detailed>`, no `THREE.LOD`, no distance swap (re-grepped `src/`). The only quality knobs are the dpr clamp and the 768 px cutoff. | verified absence |
| Worker offload | **not present in source.** `@react-three/offscreen` was declared but imported by no file in `src/`, and was **removed from `package.json` in v3.5.0** (re-grep of `src/` for `OffscreenCanvas` / `new Worker`: none). | verified absence, section 13 |
| Physics engine | **not present in source.** `@react-three/rapier` was imported by no file and was **removed from `package.json` in v3.5.0**; `scene-physics.tsx:12-13` states "No RigidBody / Rapier needed for this effect". The mount-side comment agrees: `hero-graph/index.tsx:14-17` says there is no physics engine, that rapier "was declared in package.json but imported nowhere, and was removed in v3.5.0", and that the flag and filename are historical residue. (`@dimforge/rapier3d-compat` remains in `pnpm-lock.yaml` as a transitive dependency.) | section 07, section 13 |

### The reduced-motion path

| Surface | Behaviour under `prefers-reduced-motion: reduce` |
|---|---|
| Hero graph | Never mounts; the two blurred CSS circles are the visual (`hero-graph/index.tsx:63-64,72-73`) |
| Hero avatar | Never mounts; `GlowFallback` duplicates those same two circles so switching hero modes causes no layout shift (`hero-avatar/index.tsx:19-26`) |
| Build graph | Never mounts; `GraphIndex` (the accessible DOM-first list) is the whole experience (`build-graph.tsx:50`) |
| Voice orb | 3D skipped; `VoiceOrbCanvas` draws **one static ring** and returns early with no rAF loop (`voice-orb-canvas.tsx:53-62`) |
| Physics variant | The `useFrame` callback early-returns, but `frameloop="always"` still renders every frame — a static scene, continuously drawn (`scene-physics.tsx:37-38`) |
| View transitions | JS snap branch (`view-context.tsx:105-117`) **and** a CSS `animation: none !important` kill switch (`globals.css:396-402`) |
| Global CSS | **Ten** separate `@media (prefers-reduced-motion: reduce)` blocks in `globals.css` (`:107,124,131,139,208,319,396,418,449,483`); the orb block deliberately keeps `blur(1.4px) contrast(4.5)` because dropping the filter shatters the metaballs (`:208-218`) |
| Skill tree | Injects an **unscoped** global `* { animation: none !important; transition: none !important }` from inside the SVG (`skill-tree.tsx:664-666`) |

### Failure modes

| Failure | Mechanism |
|---|---|
| Two live WebGL contexts on low-end mobile | Dropping the `view === "classic"` term from the hero gates (`hero-graph/index.tsx:64`; the rationale is stated at `:26-29`), or changing the gamified branch in `view-router.tsx` from unmount to `hidden`. |
| Uncatchable crash on a GL-less client | Relying on `WebGLBoundary` alone: R3F surfaces context-creation failure as an async unhandled rejection (`use-media-query.ts:21-26`). `hero-avatar/index.tsx` neither probes nor passes `onFail` (the graph, build graph and voice orb do both), and the 404 orb wraps a boundary with no probe (`not-found.tsx:45-55`). |
| Demand loop becomes a perpetual loop | Removing the `> 0.0006` invalidate threshold (`scene.tsx:106`). Note the avatar's demand loop already never settles: `useAvatarIdle` invalidates unconditionally (`use-avatar-idle.ts:27`). |
| Avatar freezes between mouse moves | Removing `useAvatarIdle`'s `invalidate()` — it is one of only two wake sources on the avatar's demand loop (`avatar-scene.tsx:22`, `avatar-controls.tsx`). |
| Twin three.js chunks return (−876 KB lost) | Deleting `src/lib/r3f.ts`, or re-adding `three`/`@react-three/*` to `optimizePackageImports` (`next.config.ts:166-170`). **Still unguarded by CI:** `scripts/bundle-budget.mjs` asserts three.js stays *off the first-load critical path*, not that only one copy exists — two lazy copies change no route's first-load bytes and pass the gate. The barrel is the only defence. |
| three.js dragged onto the first-load critical path (+876 KB on every route) | An eager `import * as THREE` (or an R3F import outside a `next/dynamic(..., { ssr: false })` boundary) in anything a route renders on first load. **This one is guarded:** the `Bundle budget` step fails the `e2e` job, naming the offending chunks (`scripts/bundle-budget.mjs:146-154`, step at `ci.yml:190-191`). |
| Node unit tests fail `ECONNREFUSED` | Importing `avatar-mesh.tsx` from a node test — `useGLTF.preload` at module scope (`avatar-mesh.tsx:10`) fires a real fetch. This is why `resolveRig` lives in `rig.ts` (`rig.ts:19-22`). |
| Avatar loads but never moves | Renaming a bone: `resolveRig` matches lowercased substrings `head`/`neck`/`chest`\|`spine1`/`spine`-not-`spine1` (`rig.ts:43-52`). No error anywhere. Pinned by `avatar-glb.test.ts:98-130`. |
| Eye gaze silently inert (**current state**) | `rig.morph` requires a `SkinnedMesh` whose name contains `"head"` **and** has a `morphTargetDictionary` (`rig.ts:57-63`). `sairam.glb` is an Avaturn export (`avaturn_body`, `avaturn_hair_0`, …) with **zero** morph targets, so all 8 ARKit `setMorph()` calls (`avatar-mesh.tsx:102-109`) are skipped. Asserted deliberately at `avatar-glb.test.ts:132-157`; shipping a blendshape avatar requires flipping `:148` to `toBeGreaterThan(0)` or the build fails. (`avatar-mesh.tsx:13` still calls it a "ReadyPlayerMe GLB".) |
| Uncatchable unhandled rejection offline | drei/troika `<Text>` without a local `font` prop fetches font metadata from `cdn.jsdelivr.net` — which is why the 3D hover label is commented out (`build-graph-scene.tsx:100-120`) while `Node` still takes an unused `label` prop (`:51,:59`). |
| Skill tree throws at render | `skills.find(s => s.group === groupName)!` is a non-null assertion against six hardcoded group names (`skill-tree.tsx:61-62,169`); renaming a group in `src/lib/profile.ts:72-121` throws. |
| Build fails on an avatar re-export | Re-exporting without meshopt/quantization, or with PNG/JPEG textures, or above 1.5 MB — `avatar-glb.test.ts` runs inside `pnpm build` (`:58-96`). |
| Wrong scene named in the console | `WebGLBoundary` hardcodes a `[build-graph]` prefix (`webgl-boundary.tsx:25`) even when the failing surface is the hero graph, the hero avatar, the voice orb, or the 404 orb. |
| Nodes clip out of frustum | `graph-data.ts:77` records the budget: camera z=7, fov=45 ⇒ visible half-height ≈ 2.9 / SCALE 1.6 ≈ 1.8 units. |

### Flags / env that alter it

`NEXT_PUBLIC_HERO_MODE`, `NEXT_PUBLIC_AVATAR_POSITION`, `NEXT_PUBLIC_GRAPH_PHYSICS`,
`NEXT_PUBLIC_ORB_POSTPROCESSING`, `NEXT_PUBLIC_SKILL_TREE`, `NEXT_PUBLIC_404_ORB`,
`NEXT_PUBLIC_INK_TRANSITION` (its own raw WebGL2 canvas, `src/components/ui/ink-transition.tsx`), and
`NEXT_PUBLIC_ENABLED_VIEWS` (whether the gamified view is reachable at all). Plus two non-env inputs:
the `(min-width: 768px)` media query and `prefers-reduced-motion`.

---

## 10. Build & deploy

### Flow

```
DEVELOPER
  pnpm install
  pnpm dev  →  predev (velite, one-shot, NO --clean)  →  next dev
                  ⤷ next.config.ts:12-16 ALSO starts velite { watch:true, clean:false } when
                    process.argv includes "dev", guarded once by VELITE_STARTED
        │
        ▼  git push (any branch)   [ci.yml:3-7: push on "**" AND pull_request → develop/main; no concurrency group]
CI  .github/workflows/ci.yml   — 5 jobs; only claims-integrity-autocommit has a `needs:` (on ci); the rest run in parallel
   job `ci`   : pnpm install → pnpm audit (report only, continue-on-error) → pnpm content → pnpm lint
                             → npx tsc --noEmit → pnpm test
                             → node scripts/check-index-citations.mjs   (ci.yml:76-77)
                             → npx tsx scripts/seal-claims.ts           (ci.yml:83-84)
                ↑ the ONLY place `pnpm lint` and `tsc --noEmit` run; neither command is in pnpm build
                  (Next 16's `next build` no longer lints, but it still type-checks — nothing sets
                  `typescript.ignoreBuildErrors`)
                ↑ the index-citation check and the claims-chain check are deliberately CI steps and NOT in
                  `pnpm build`, so a stale doc or a drifted ledger fails the PR instead of blocking a
                  production deploy (ci.yml:66-72,79-82)
   job `claims-integrity-autocommit` : opt-in — runs only when repo variable SEAL_CLAIMS_AUTO_COMMIT == 'true'
                             (needs: ci); re-seals data/integrity-chain.json and pushes with [skip ci]   (ci.yml:86-135)
   job `e2e`  : pnpm install → playwright install --with-deps chromium webkit → pnpm build
                             → node scripts/bundle-budget.mjs (ci.yml:190-191) → pnpm e2e
                ↑ pnpm build re-runs vitest, so tests execute TWICE per CI run (once in `ci`, once here)
                ↑ playwright.config.ts webServer runs `pnpm start`, which needs a prior build
                ↑ the budget rides on THAT build — no second compile. It reads
                  .next/diagnostics/route-bundle-stats.json, which only Turbopack writes.
                  NO continue-on-error: unmeasurable is red (§ The bundle budget gate)
   job `install-pnpm-11` : pnpm 11 `install --frozen-lockfile`; fails if pnpm modified a tracked file; then runs
                             src/lib/pnpm-build-allowlist-consistency.test.ts   (ci.yml:204-253)
   job `security-alerts` : continue-on-error: true; reports open Dependabot alerts only when SECURITY_ALERTS_TOKEN is set (ci.yml:255-331)
  - bundle-analysis.yml: DELETED (absent from .github/workflows/). 222 runs, 211 green, ZERO artifacts — it never
    measured anything; the `Bundle budget` step above replaces it (§ The bundle budget gate)
  + codeql.yml ("CodeQL Advanced": develop AND main, + weekly cron 35 1 * * 1, codeql.yml:33-39) — main added so a hotfix
                                     pushed straight to main cannot deploy unscanned
  + dependency-review.yml (PRs → develop/main): fail-on-severity high, fail-on-scopes runtime (dependency-review.yml:26-29)
  + gitleaks.yml (push + PRs on develop/main, full-history checkout) · scorecard.yml (OSSF Scorecard: push to main,
                                     weekly cron, manual)
  every third-party `uses:` in all five workflows is SHA-pinned with a `# vX` comment; Dependabot's github-actions
  ecosystem moves the pins (.github/dependabot.yml:103-116)
        │
        ▼  PR: feature → develop  (make pr)      Vercel PREVIEW deploy
        ▼  PR: develop → main    (make pr-prod)  Vercel PRODUCTION deploy
VERCEL BUILD
  pnpm build  =  velite --clean  &&  vitest run  &&  next build  &&  pagefind --site .next/server/app --output-path public/pagefind
                 └─ 1. generate .velite  └─ 2. TEST GATE  └─ 3. compile  └─ 4. search index (package.json:11)
                 a non-zero exit anywhere in the chain never reaches the next step
                 ↑ the Bundle budget gate does NOT run here — like the index-citation check it is a
                   MERGE gate, not a deploy gate; a bundle regression fails the PR, not the deploy
  no buildCommand / framework / regions / functions keys in vercel.json — auto-detection + this script
        ▼
RUNTIME
  vercel.json crons: health-check 0 5 * * * · github-sync 0 8 * * * · seo-audit 0 6 * * 1
                     content-audit 0 7 * * 1 · eval 0 9 * * 1     (all GET, all Bearer CRON_SECRET)
LOCAL RE-RUN OF THE LAST BUILD STEP
  make search-index → pnpm pagefind --site .next/server/app --output-path public/pagefind
                      (Makefile:65-66 — "without a full rebuild"; public/pagefind/ is gitignored, .gitignore:50)
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `package.json:5-7,9-21` | **13** scripts. `predev` = bare `velite` (`:9`); `dev` = plain `next dev` (`:10`); `build` = the four-step chain (`:11`); `analyze` (`:12`); `seal-claims` (`:18`); `clean` deletes `.next .turbo node_modules/.cache .velite` (`:19`). `engines.node` is `">=22 <23"` (`:5-7`), matching `.nvmrc` (`22`). |
| 2 | `velite.config.ts` | Content compile step 1; `output.clean: false` by default (`:153`), the `build`/`content` scripts pass `--clean` explicitly. |
| 3 | `vitest.config.ts:17,26-45` | Two projects (`node` / `dom`); `resolve.tsconfigPaths`; `env: { NODE_ENV: "test" }`. 96 test files (63 node + 33 dom), 1064 tests, all passing at this tree (vitest 5.0.0, ~12 s). |
| 4 | `next.config.ts` | Headers/CSP, `cacheComponents`, `inlineCss`, Turbopack root pin, 4 `.md` rewrites, `NEXT_PUBLIC_BUILD_YEAR`, the dev-only Velite watcher, `withBundleAnalyzer` (`:5-7` — still wrapping, but now reachable only through `pnpm analyze`; see § The bundle budget gate). |
| 5 | `.github/workflows/ci.yml` | The merge gate: five jobs (above). `pnpm/action-setup` is pinned to `ea17c68…` (v6.1.0) in four jobs; `ci`, `e2e` and the opt-in job use `version: 10`, `install-pnpm-11` uses `version: 11` (`:24,:108,:155,:230`). Also carries the `Bundle budget` step (`:190-191`). |
| 6 | `scripts/bundle-budget.mjs` | The bundle gate that replaced `bundle-analysis.yml`. Reads `.next/diagnostics/route-bundle-stats.json` (`:37`); asserts a per-route first-load ceiling (`:72`), a route-count floor (`:40`), and that three.js stays off the first-load critical path (marker `:84`, checked at `:146-154`). Exits 1 when the artifact is unreadable (`:95-99`) or its shape has changed (`:102-113`). |
| 7 | `playwright.config.ts:15-24,37-44` | **Two** projects — `chromium` (Desktop Chrome) and `mobile-safari` (iPhone 13, which launches webkit); `baseURL http://localhost:3000` (`:11`); `retries: 2` and `workers: 1` in CI (`:7-8`); `webServer.command = "pnpm start"`, `reuseExistingServer: !CI` (`:37-44`). |
| 8 | `vercel.json:3-7` | The five cron schedules — the file's only key. |
| 9 | `Makefile` | 36 targets, all `.PHONY`, `.DEFAULT_GOAL := help` (`:9`): `pr`/`pr-prod`, `deploy-preview`/`deploy-prod`/`rollback`, `logs`/`logs-llm`/`logs-flags`, `trace`, `health`, `admin`, `env-check`/`env-setup`/`env-vercel`, `flags-show`, four `new-*` scaffolds, `search-index`. |
| 10 | `.github/dependabot.yml` | Two ecosystems (`npm`, `github-actions`), weekly Monday 09:00 America/Chicago, `target-branch: develop`. The `npm` block has five version-update groups (first-match-wins ordering, `:14-16`) plus a `security-patches` group with `applies-to: security-updates` (`:68-71`), and 3 `ignore` rules (`@react-three/postprocessing` `3.0.5`, `typescript` major, `eslint` major, `:82-101`). |
| 11 | `pnpm-workspace.yaml:18-44,49-54,70-84` + `pnpm-lock.yaml:7-24` | The **12** security `overrides` (`:18-44`), the `@react-three/fiber@9.7.0` patch (`:49-54`, `patches/@react-three__fiber@9.7.0.patch`), and the build-script allowlist (`allowBuilds` `:81-84`; legacy `onlyBuiltDependencies` / `ignoredBuiltDependencies` `:70-76`). **No longer in `package.json`** — the whole `pnpm` field moved to `pnpm-workspace.yaml` in v3.5.0 because pnpm 11 stopped reading that field, which had silently disarmed the v3.4.2 overrides on any pnpm-11 install (rationale at `:1-12`). |
| 12 | `scripts/seal-claims.ts` + `data/integrity-chain.json` + `src/lib/claims-integrity.ts` | The Claims Integrity Ledger: verify mode (the `ci` job's last step) fails if `impactMetrics` / `achievements` in `profile.ts` no longer match the chain head or the chain's own linkage is broken; `--write` appends a new sealed entry. Unit-tested by `claims-integrity.test.ts`, which does run inside `pnpm build`. |

### Entry point

`git push` (CI runs on `branches: ["**"]`), a PR into `develop` or `main`, or a manual
`make deploy-preview` / `make deploy-prod`.

### Exit point

A Vercel Preview URL (from `develop`) or the production deployment (from `main`) whose build also emits
`public/pagefind/`, plus five live cron schedules and a `[config]` cold-start log line per server process.

### Tests as a gate — what that actually means

`pnpm build` is `velite --clean && vitest run && next build && pagefind …` (`package.json:11`). The `&&` chain
is the gate: a failing Vitest assertion aborts before `next build`, so every one of the 96 test files
(1064 tests) is a deploy blocker on the Vercel build path. Concretely, these invariants block a deploy:

- graph↔content bijection — `src/lib/game-model.test.ts:22-58`
- the decisions ledger ↔ content coverage and anti-fabrication gate — `src/lib/decisions.test.ts`
- the 1.5 MB avatar budget + compression/rig assertions — `src/lib/avatar-glb.test.ts:21,58-130`
- snake_case Anthropic usage keys — `src/lib/llm.test.ts:308-318`
- card-token fail-closed behaviour — `src/components/chat/parse-cards.test.ts:40-75`
- redact-before-emit — `src/app/api/error/route.test.ts:225-264`
- the auth surface — `src/proxy.test.ts`, `src/lib/admin-auth.test.ts`, `src/app/admin/telemetry/page.test.tsx`,
  `src/lib/cron-auth.test.ts`, `src/app/api/cron/cron-auth.routes.test.ts`,
  `src/app/api/admin/faq-cache/purge/route.test.ts`
- per-class rate limiting and the eval bypass — `src/lib/rate-limit.test.ts` (mechanics), the route-to-class
  pins in `src/app/api/voice-rate-limit-class.test.ts`, `src/app/api/chat/route.test.ts` and
  `src/app/api/error/route.test.ts`, and `src/app/api/cron/eval/route.test.ts` (bearer on all 12 chat calls)
- notes dark on every public surface — `src/lib/notes-dark.test.ts`
- MCP tool table documented — `src/app/mcp/tools-documented.test.ts`
- last-XFF-segment IP derivation — `src/lib/telemetry/with-trace.test.ts:220-230`, and, across **all
  three** `clientIp` copies, `src/lib/client-ip-consistency.test.ts` (`:26-30` the enumerated copies —
  `rate-limit.ts`, `telemetry/with-trace.ts`, `api/visit/route.ts`; `:101` a discovery check that fails
  if a fourth copy appears unguarded; `:140` "takes the LAST x-forwarded-for segment, never the
  first"). `api/visit/route.ts` takes `xff.split(",").pop()!.trim()` (`:34`).
- SSR-is-always-Classic — `src/components/view-context.test.ts:30-35`
- two tests read `node_modules` rather than source, so a dependency bump can red a production deploy:
  `src/lib/pnpm-build-allowlist-consistency.test.ts` (every dependency with an install script must have an
  `allowBuilds` decision) and `src/lib/health-expectations.test.ts:160-185` (pins the installed `mcp-handler`
  version and asserts its GET branch is still unconditional)

**Playwright is a separate CI job and does *not* block `pnpm build`** (`ci.yml:137-202`).
`agent-trace.test.ts` is a **consistency** check, not a ship block: `expect(traceApproved).toBe(!hasSentinel)`
(`src/lib/agent-trace.test.ts:56`) passes in both states. The sentinel is currently present, so
`traceApproved === false` and `src/components/game/glass-box-demo.tsx:40` returns `null` — the demo is
dark and nothing is blocked. The file's header banner says so outright (`src/lib/agent-trace.ts:13-16`),
which agrees with the docblock at `:114-119` (the phrase at `:118`), the declaration at `:120`, and what the
test actually asserts.

### The bundle budget gate — what replaced `bundle-analysis.yml`

`.github/workflows/bundle-analysis.yml` is **deleted**. A `Bundle budget` step inside the existing `e2e` job
took over (`ci.yml:190-191` → `scripts/bundle-budget.mjs`), riding on the `pnpm build` at `ci.yml:176-177`,
so CI still compiles exactly once.

**Why the old workflow was deleted rather than repaired.** Its run history (`gh run list`, not inspectable
from the working tree; recorded at `scripts/bundle-budget.mjs:5-21` and `ci.yml:184-189`) is 222 runs — 211
green, 11 red — and **zero** artifacts across the 25 most recent. Its install/build failures did go red
(9 of the 11); what it could never do was fail on a bundle *size*, because it had no threshold. Three
independent causes, each sufficient on its own:

| Cause | Mechanism |
|---|---|
| `next build` in Next 16 is **Turbopack**, not webpack | Nothing here configures a bundler, and `node_modules/next/dist/lib/bundler.js:142-144` — "The default is turbopack when nothing is configured" — sets `TURBOPACK='auto'`. `@next/bundle-analyzer` then no-ops: `node_modules/@next/bundle-analyzer/index.js:7-14` is `if (process.env.TURBOPACK) { console.warn(…); return nextConfig }`, warning "not compatible with Turbopack builds, no report will be generated" and handing back the **untouched** config, so the `webpack()` hook at `:20` is never added. The `ANALYZE=true` build therefore produced **nothing**. The workflow's own comment asserted the opposite — that comment is the origin of the false claim this index carried (see the Resolved ledger below). |
| The `compare` step read a Pages-Router manifest | `nextjs-bundle-analysis` (last published 2023) reads `build-manifest.json.pages`, which is `{"/_app": []}` in this App Router app. Even fully wired it emits `{"raw":0,"gzip":0}` — "this PR introduced no changes to the JavaScript bundle", on every PR, forever. It was also never wired: its eleven steps (now readable only in git history, at the revision before the deletion) went from the analyse build (via an artifact upload and a base-artifact download) to `compare`, skipping the `report` step that writes `__bundle_analysis.json`, and `package.json` still has no `nextBundleAnalysis` block — checkable today. |
| A missing measurement was invisible | `if-no-files-found: warn` on the upload plus `continue-on-error: true` on the compare. |

No status check is required on `develop` or `main` (a live GitHub read: an active repository ruleset requires PRs and blocks deletion and force-push but has no `required_status_checks` rule — see the Resolved ledger), so no required check disappeared with it.

**What the replacement measures.** `next build` writes `.next/diagnostics/route-bundle-stats.json` with no
flag and no second build — but **only** under Turbopack (`node_modules/next/dist/build/index.js:2843-2844`
gates `writeRouteBundleStats` on `bundler === Bundler.Turbopack`). So it describes exactly what ships.
Records are `{ route, firstLoadUncompressedJsBytes, firstLoadChunkPaths }` (`scripts/bundle-budget.mjs:108-113`);
the floor is 17 = the 16 `page.tsx` routes plus `/_not-found` (`:39-40`), and a local
`.next/diagnostics/route-bundle-stats.json` of unknown provenance (built 19 Sep, Next 16.3.5) does hold 17
records.

| Assertion | Value | Cite |
|---|---|---|
| Per-route first-load ceiling | `MAX_FIRST_LOAD_BYTES = 1_336_000`, raised four times since the gate landed at 1,285,000. The in-file rule (`:69-71`) is one commit per raise, quoting measured before/after bytes, but only one of the four (`61c9cb8`) was a standalone commit — `2b08f83`, `338effd` and `d412aac` moved the constant inside code changes. The in-file comment measures `/` at 1,333,521 B after the last raise (~2,479 B headroom, `:57-67`) but also opens with a different figure (1,322,132 B, `:43`), and the local artifact above shows `/` at 1,184,096 B — headroom depends entirely on which baseline you use, so no percentage is quoted here | `scripts/bundle-budget.mjs:72` |
| Route-count floor | `MIN_ROUTES = 17`; fewer means the artifact's shape changed and the gate is lying about coverage. (The script's header still quotes an older measurement — "16 routes; … `/` is 1220794", `:27` — while the `MIN_ROUTES` docblock at `:39` says 17; the assertion uses the constant.) | `:40,:102-107` |
| three.js off the first-load critical path | exactly **1** chunk contains `WebGLRenderer` — 897,249 B (876.2 KiB), i.e. the single "876 KB" copy recorded at `next.config.ts:153-164` — and it appears in **0** of the routes' first-load sets | `:76-77` (comment), `:84` (marker), `:146-154` (check) |
| Every first-load chunk path exists on disk | otherwise the artifact and the build output disagree and the measurement is untrustworthy | `:137-144` |
| Missing or malformed artifact ⇒ exit 1 | by design; the predecessor's defining flaw was reporting success while measuring nothing | `:30-31`, `:95-99`, `:102-113` |

**What it deliberately does not do.** No `continue-on-error`, no `if-no-files-found` — the two settings
that made the predecessor unable to fail on a missing measurement; the rationale is recorded inline at
`ci.yml:179-189`. It also does **not** assert total emitted bytes, so a three.js *twin-chunk* return (two
copies, both still lazy) passes it untouched — that regression is still guarded only by the barrel, per the
twin-chunk row in § 9's failure table. And like the index-citation check it is a **merge** gate, not a
**deploy** gate: Vercel runs `pnpm build` alone, so a bundle regression fails the PR rather than blocking a
production deploy. Three references in the script — comments at `bundle-budget.mjs:70` and `:75`, and the
failure message at `:152` — cite lines 127–149 of `next.config.ts` for the three.js chunk record; that block is now
`next.config.ts:153-169`.

**`@next/bundle-analyzer` survives as a local attribution tool.** It is still a devDependency
(`package.json:61`) and `next.config.ts:5-7` still wraps the config with it, but the only thing that sets
`ANALYZE` is now the `pnpm analyze` script — `package.json:12`, which is
`velite --clean && ANALYZE=true next build --webpack`, and the explicit `--webpack` is what makes the
plugin do anything at all; it writes `.next/analyze/{client,edge,nodejs}.html`.
The consequence is deliberate and one-directional: a `--webpack`
build emits no `route-bundle-stats.json`, so `scripts/bundle-budget.mjs` fails after `pnpm analyze` and
names `--webpack` as the cause (`:97`). Re-run `pnpm build` before the gate. The plugin says as much
itself: its Turbopack warning ends "To run this analysis pass the `--webpack` flag to `next build`", and it
suggests a Turbopack-native analyzer (`node_modules/@next/bundle-analyzer/index.js:10,12`). The plugin's
wording for that alternative — `next experimental-analyze` — is real: 16.3.5 ships it as a subcommand that
analyses without producing an application build (`node_modules/next/dist/bin/next:142`, documented in the
bundled `01-app/02-guides/package-bundling.md`), and separately as a `next build --experimental-analyze`
**flag** (`bin/next:109`) that is refused under any non-Turbopack bundler
(`node_modules/next/dist/cli/next-build.js:57-58`). Nothing in `package.json` or the
`Makefile` wires either up, so it remains an unexplored alternative to the `--webpack` path, not a live one.

### Branch model

`develop` is the integration branch (all feature work targets it; Vercel Preview). `main` is the release
branch, normally merged from `develop` (Vercel Production) — a convention, not an enforced rule: its first-parent
history also holds PRs that targeted `main` directly (the hotfix #109, `afd6df7`, and Dependabot #239/#240,
`8a61e5e`/`2f1f088`), and the active ruleset (§ Resolved ledger) requires a pull request but does not restrict
where it comes from. `make pr` opens feature → `develop`;
`make pr-prod` opens `develop` → `main`. Two consequences recorded in the repo: `codeql.yml` runs on
`develop` **and `main`** pushes/PRs plus a weekly cron (`main` added because a hotfix straight to `main`
would otherwise deploy unscanned); and Dependabot reads `dependabot.yml` from the
**default branch only**, so the `typescript`/`eslint` ignores were inert while they lived on `develop`
(`CHANGELOG.md:594-595`).

### The Pagefind search-index step

`/search` loads `/pagefind/pagefind-ui.css` and `/pagefind/pagefind-ui.js` at runtime by injected tag
(`src/app/search/page.tsx:20-46`). Those files are written by the **last step of `pnpm build`**
(`package.json:11`), whose `--site .next/server/app` input only exists after `next build`; `make search-index`
(`Makefile:65-66`) re-runs just that step. **There is no `pnpm search-index` script** — `package.json` has 13
scripts (`:9-21`) and none is named that. `public/pagefind/` is gitignored (`.gitignore:50`), so it is absent
from a fresh checkout and `/search` 404s its Pagefind assets until a build (or `make search-index` against
one) has run. The page's own header comment (`search/page.tsx:6`) still says the bundle is "generated
post-build by `make search-index`". The index is rebuilt on **every** `pnpm build` even though
`SEARCH_ENABLED` defaults off (it does not gate the route — only the nav link and the sitemap entry), and a
pagefind failure fails the Vercel build.

### Failure modes

| Failure | Mechanism |
|---|---|
| Module resolution failure in vitest and next build | `pnpm content` / `velite --clean` skipped; `.velite/` is gitignored. |
| "React.act is not a function" ⇒ every DOM test fails ⇒ deploy fails | Removing `env: { NODE_ENV: "test" }` (`vitest.config.ts:26`). Vitest only defaults `NODE_ENV=test` when unset, but the Vercel build shell sets `production`, which makes React load its prod bundle without `act` (`:19-25`). |
| Every DOM suite runs twice, once without happy-dom globals | Removing the `node` project's `exclude: ["**/*.dom.test.{ts,tsx}", …]` (`vitest.config.ts:34`) — `src/x.dom.test.ts` also matches `src/**/*.test.ts`. |
| "Failing test blocks deployment" property lost | Reordering or splitting the `build` chain into independent commands. |
| Playwright tests a stale build | Without the `webServer` block, a leftover process on :3000 is silently tested — recorded as having produced 5 phantom failures during a release audit (`playwright.config.ts:25-36`). |
| `Executable doesn't exist at .../chromium_headless_shell-<rev>` (or the same for `webkit-<rev>/pw_run.sh` now that `playwright.config.ts` has the `mobile-safari` project) | Installing browsers with anything other than `pnpm exec playwright install --with-deps chromium webkit`, which pins to the installed `@playwright/test` (`ci.yml:166-173`). Omitting `webkit` here installs cleanly and passes silently — it only breaks the instant a `mobile-safari` spec actually runs. |
| Dev server dies with "Can't resolve './projects.json'" | Passing `--clean` to Velite in dev, or setting `clean: true` in `velite.config.ts:153` (rationale `:149-152`). |
| Prerender fails "encountered the unstable value `Date.now()`" | An in-render `new Date()`/`Date.now()` under `cacheComponents`. Two live workarounds: the build-time `NEXT_PUBLIC_BUILD_YEAR` (`next.config.ts:127` → `site-footer.tsx:239`) and `/admin/telemetry`'s `export const instant = false` (`:13`) **plus** `await connection()` (`:478`) — the comment at `:471-474` records that `instant=false` alone does **not** clear it. |
| Build fails with "26 errors" | Re-adding any `export const runtime`, `revalidate`, or `dynamic` segment config under `cacheComponents: true` (`next.config.ts:175-194,203`). The RSC transform rejects the mere *presence* of `runtime`, so `"nodejs"` and `"edge"` are indistinguishable to it. `maxDuration` and `preferredRegion` are **not** rejected. (A grep of `src/` for `export const (runtime\|revalidate\|dynamic)` finds no actual export — only comments recording their removal.) |
| Build fails on an empty `generateStaticParams` | `cacheComponents` requires ≥1 result — which is why `src/app/notes/[slug]/page.tsx:16-26` no longer short-circuits on `!NOTES_ENABLED` and instead prerenders every *published* note slug (`publishedNotes`, `lib/content.ts:47-52`) as a 404 via `notFound()` at `:51`. |
| GitHub polling cadence silently changes | `/api/github/stats` has no segment `revalidate`; the 1-hour cadence lives only in two fetch options (`api/github/stats/route.ts:31` and `src/lib/github.ts:114`, recorded at `route.ts:3-7` — whose text still says line 101 of `github.ts`). |
| `security-alerts` reports nothing while showing green | The default `GITHUB_TOKEN` cannot read the Dependabot alerts API even with `security-events: read` — the restriction is on token **type**; a fine-grained PAT stored as `SECURITY_ALERTS_TOKEN` is required (`ci.yml:266-273`). |
| **CI red immediately after the build step**, "cannot read .next/diagnostics/route-bundle-stats.json" | Only Turbopack writes that artifact (`node_modules/next/dist/build/index.js:2843-2844`), so any build that opted into webpack — `pnpm analyze`, or a `--webpack` flag added to `pnpm build` — leaves the gate nothing to read. It exits 1 and names `--webpack` (`scripts/bundle-budget.mjs:95-99`). This is the intended behaviour, not a false positive: unmeasurable must be red. |
| First-load JS grows past the ceiling, or three.js lands on the critical path | `scripts/bundle-budget.mjs` fails the `e2e` job (`ci.yml:190-191`). Raising `MAX_FIRST_LOAD_BYTES` (`:72`) is allowed but must be its own commit quoting measured before/after bytes (`:69-71`); an eager `import * as THREE` in a shell component is the failure the byte ceiling alone would miss, because the bytes were always shipped — they just stopped being deferred (`:79-82`). |
| A bundle regression ships green again | Re-adding `continue-on-error` / `if-no-files-found` to the budget step, which is exactly how `bundle-analysis.yml` ran 222 times (211 green, 11 red) and produced zero artifacts, ever (`ci.yml:179-189`). |
| CI runs twice on every PR branch | `push` on `"**"` and `pull_request` both trigger `ci.yml`, with no `concurrency` group (`ci.yml:3-7`). |
| A docs edit reds the PR | Editing or deleting a line the index cites: `node scripts/check-index-citations.mjs` (`ci.yml:76-77`) fails on stale **text** (the cited text is gone from its file, or is duplicated and matches no line shift seen elsewhere in that file), an unresolvable file or line, an inverted range, or a citation on an empty line; a pure relocation from inserted lines is only a warning. Re-fingerprint with `--write` once the prose is re-pointed (`ci.yml:74-75`). |
| The `@react-three/postprocessing` types regression returns | `package.json:34` is now the exact pin `3.1.1`, past the broken `3.0.5`; the version-scoped Dependabot `ignore` for `["3.0.5"]` (`dependabot.yml:82-84`) is still there and its comment (`:80`) still says "Pinned to 3.0.4". Loosening the pin, or dropping the `ignore` while the pin moves back, re-opens it — verify against the `3.0.5` regression before treating the pair as removable. |
| eslint chain breaks | Collapsing the two `brace-expansion` overrides (`@1` → `^1.1.16`, `@>=3` → `^5.0.7`, `pnpm-workspace.yaml:30-31`) into one blanket pin, which forces `minimatch@3` onto 5.x (`CHANGELOG.md:565-567`). |
| Dependabot cannot move a transitive advisory | `@modelcontextprotocol/sdk` is exact-pinned to `1.26.0` (`package.json:29`; `mcp-handler`'s literal peer, `pnpm-lock.yaml:3712`), producing `security_update_not_possible` (`CHANGELOG.md:575-577`) — the situation the `pnpm-workspace.yaml` overrides work around. |
| `three` bump breaks a peer | `postprocessing@6.39.5` declares `three: >= 0.168.0 < 0.187.0` (`pnpm-lock.yaml:4128`) against a declared `^0.186.0` — only the 0.186.x line satisfies both. |

### Flags / env that alter it

`ANALYZE` (`next.config.ts:6`; nothing in CI sets it any more — its one setter is the local `pnpm analyze`
script, `package.json:12`, and without that script's explicit `--webpack` it is inert under Turbopack),
`VELITE_STARTED` (internal re-entrancy guard, `next.config.ts:13-14`),
`VERCEL` (gates the CSP's `upgrade-insecure-requests`, `next.config.ts:84`),
`CI` (`playwright.config.ts:6-8,40`), `NODE_ENV` (forced to `test` for
the Vitest worker), `NEXT_PUBLIC_BUILD_YEAR` (written by the config), `VERCEL_URL`/
`VERCEL_PROJECT_PRODUCTION_URL` (the alias the health cron must probe, `health-expectations.ts:51-59`)/
`VERCEL_ENV`/`VERCEL_REGION`/`VERCEL_GIT_COMMIT_SHA`/`NEXT_RUNTIME` (platform-set), `CRON_SECRET` (whether the five
schedules do anything), `SECURITY_ALERTS_TOKEN` (repo secret), `SEAL_CLAIMS_AUTO_COMMIT` (repo variable,
read by the `if:` guard of the opt-in job, `ci.yml:90-99`). Note on version pinning: `engines.node` is `">=22 <23"` (`package.json:5-7`) and `.nvmrc` holds the
single line `22`; CI runs Node 22 (`ci.yml:29,113,160,235`) with pnpm 10, plus the `install-pnpm-11` job.
Still absent: **no `packageManager`** and **no `.npmrc`**.
The `packageManager` omission is deliberate — commit `ceae0d1` records that adding it would make every
local command resolve a specific pnpm through corepack, judged a separate workflow decision rather than
part of that fix. A gitignored `.vercel/project.json` on the linked primary checkout (absent from this
worktree; read 2026-09-29) records `"nodeVersion": "24.x"`, which — if it reflects the live project setting,
not checked here — would put production on a different major than the repo's `>=22 <23` range.

---

## Cross-subsystem coupling points

Places where one subsystem's change breaks another, gathered from all ten maps — subsystems 1–6 in
[`14-subsystems.md`](./14-subsystems.md), 7–10 above.

| Coupling | Sites that must agree |
|---|---|
| Project group names (3 copies) | `velite.config.ts:4-8` · `src/lib/content.ts:31-35` · `src/lib/game-model.ts:177-181` |
| Graph node ↔ content slug | `src/lib/graph-data.ts:18-81` (`graphNodes`, 16 entries) · `src/lib/game-model.ts:28-50` (`NODE_CONTENT`) · gate `src/lib/game-model.test.ts:22-58` |
| Base URL `https://anvilry.vercel.app` (**20 non-test files / 25 lines** at this tree, prose and comments included; 24 files / 33 lines with tests) | The per-file table in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url) is the single authority; re-verify with `grep -rn 'anvilry\.vercel\.app' src Makefile \| grep -v '\.test\.'`. Densest site: `src/components/json-ld.tsx:29,143,171,207,220,266` (6 lines, one of them inside FAQ prose at `:266`). One site is **functional, not cosmetic**: `OWN_NOTES_URL_PREFIX` (`src/lib/content.ts:69`) is how `isNoteOnlyArticle` recognises an article whose `externalUrl` is one of its own note URLs — change the domain without it and note-only articles stop being dropped while notes are dark (`content.ts:82`). `src/lib/mcp-tools.test.ts:86,99` asserts against the same host |
| Error dedupe flag string | `src/app/error.tsx:39` · `src/app/global-error.tsx:34` · `src/instrumentation-client.ts:68-69` |
| Beacon `source` enum | `src/lib/telemetry/beacon.ts:42` · `src/app/api/error/route.ts:83` (declared source of truth) |
| Telemetry kind union (8 kinds) | `src/lib/telemetry/schema.ts:37-50` · `src/app/admin/telemetry/page.tsx:47` (fetch loop over `KIND_LITERALS`) and its render switches (`:384,:414-416`) · `scripts/replay-trace.mjs:47-55` (**hardcoded copy with 7 kinds — `chat.cache` is missing**, so `make trace` never replays FAQ-cache spans) · the union is pinned by `schema.test.ts:138-155`. Three of the eight — `tts.request`, `transcribe.request`, `budget.tick` — have **no emitter** anywhere in `src/` (TTS/STT failures are emitted as `server.error`), so the dashboard's four voice-latency tiles (`page.tsx:729-762`) stay on their empty placeholders |
| Redis key literals | `src/app/admin/telemetry/page.tsx:29,244,278,281,284,287,293` · the five `api/cron/*` writers (`eval/route.ts:176`, `health-check/route.ts:208-221`, `github-sync/route.ts:27,53`, `seo-audit/route.ts:66`, `content-audit/route.ts:43`) · `src/lib/telemetry/emit.ts:70` · `src/instrumentation.ts:97` and `src/lib/chat-cache.ts:52-54` (the corpus stamp and the FAQ-cache entry/index keys) · rate-limit prefixes `rate-limit.ts:25-29` and `api/visit/route.ts:42` |
| Nav height `3.5rem` / `h-14`, and the open-to-work banner height `2.3125rem` | `src/components/site-nav.tsx:67,70` · `src/components/ui/skeleton.tsx:106` (`SkeletonViewTransition`) · `chat-view.tsx:79-81` · `game/developer-view.tsx:38-41` · `globals.css:94-97` (`scroll-padding-top`) · the banner literal in `chat-view.tsx:80` / `developer-view.tsx:40` must equal `OPEN_TO_WORK_BANNER_HEIGHT_REM` (exported from `src/lib/writing-flags.ts`, `:34`) — spelled out as literal Tailwind classes because the JIT scanner cannot see interpolated ones |
| View-transition names | `view-router.tsx:56` (`view-body`) · `site-nav.tsx:68` (`site-header`) · `globals.css:360-402`; direction is stamped on `<html data-view-dir>` at `view-context.tsx:207-210` and consumed at `globals.css:373-385` |
| Résumé label / variants | `src/lib/profile.ts:136-142` (`resumeVariants`, one entry) · `src/lib/mcp-tools.ts:24` (`RESUME_ROLES`) and `:28-34` (`ROLE_TO_LABEL`) · the PDF `public/resume/Sairam_Resume_MX_E.pdf` — re-adding a role is a three-place edit or `get_resume_variant` returns `notFound` (`mcp-tools.ts:30-32`) |
| Article `source` enum | `velite.config.ts:123-130` · `src/components/platform-badge.tsx:5-23` (`ArticleSource`, `SOURCE_CONFIG`) · `src/app/articles/page.tsx:34-41` (`SOURCE_LABELS`) · `src/app/articles/[slug]/page.tsx:30-37` (its own `SOURCE_LABELS`, rendered at `:108`) · `articles/[slug]/opengraph-image.tsx:20-27` (`SOURCE_LABEL`). **All four maps are keyed by `ArticleSource` (`platform-badge.tsx:5-11`), so adding a source to the Velite enum without adding it everywhere is a `tsc` error.** `opengraph-image.tsx` was the exception — `Record<string, string>` with a `?? "> article"` fallback — and it had silently drifted two members behind (`devto` and `hashnode` missing; the file's own comment counts 8 of 14 published articles, 9 of 15 files, rendering the generic `> article`). Widening any of these back to `Record<string, …>` re-opens the hole, because the fallback then absorbs the omission instead of failing the build |
| Terminal command visibility filter | `src/components/game/terminal/commands.ts:745-747` (`COMMAND_NAMES`) · `terminal.tsx:17-19` (independent re-filter for the fuzzy dropdown) |
| Terminal input selector | `terminal.tsx:302` (`aria-label="Terminal command input"`) · `terminal-overlay.tsx:40-42` (queries that exact string) |
| CSP `frame-ancestors` string | `next.config.ts:41` (the literal) · `:224-227` (the replace that depends on it) |
| Palette `value` pinning | `command-palette-content.tsx:361` (`copy-email`), `:478` (`voice-tts`), plus six other voice actions (`voice-pick` `:415`, `voice-settings` `:429`, `voice-engine` `:506`, `voice-stt-engine` `:534`, `voice-surface` `:563`, `voice-wake` `:588`) — cmdk re-scores when a label mutates |
| `MDXContent` ↔ CSP | `src/components/mdx-content.tsx:14-17` · `next.config.ts:43-51` (`'unsafe-eval'`) |
| `.md` passthrough (two implementations) | `next.config.ts:240-248` (4 rewrites → `/api/md/*`) · `src/app/<collection>/[slug].md/route.ts` (4 filesystem handlers) and `src/app/api/md/<collection>/[slug]/route.ts` (the rewrite targets). Same helpers (frontmatter strip, `content/` read from disk, 404 when the slug is not in the content layer); resolution order not exercised. In all eight handlers the collection lookup (`api/md/*/[slug]/route.ts:28`, `<collection>/[slug].md/route.ts:33`) runs before the `readFileSync`, which is the only path-traversal guard — convention, not tested. |
| Admin credential predicate | `src/lib/admin-auth.ts:24` (`isAdminAuthorized`) is the single implementation; callers `proxy()` (`src/proxy.ts:25-31`), `src/app/admin/telemetry/page.tsx:470`, and `requireAdmin` (`admin-auth.ts:48`) → `api/admin/faq-cache/purge/route.ts:32`. The matcher (`proxy.ts:21-23`) covers only `/admin/:path*`, so every `/api/admin/*` route must call `requireAdmin` itself |
| Cron secret predicate | `src/lib/cron-auth.ts:15` (`hasValidCronSecret`) ← the five cron routes via `unauthorizedUnlessCron` **and** `rate-limit.ts:100` (limiter bypass); the eval cron's outbound `Authorization` + `X-Chat-Skip-Cache` headers (`eval/route.ts:123,126`) are what the bypass and `chat/route.ts:276` read. `cron-auth.routes.test.ts:19-25` lists the routes it covers |
| Rate-limit class ↔ route | `src/lib/rate-limit.ts` (`RateLimitClass` at `:19`, prefixes `:25-29`) ↔ callers `chat/route.ts:142`, `tts/route.ts:69`, `tts-google/route.ts:67`, `transcribe/route.ts:63`, `error/route.ts:101`; each pairing is pinned by a test — the three voice routes by `voice-rate-limit-class.test.ts`, `chat` by `chat/route.test.ts:131-137`, `beacon` by `error/route.test.ts:198-204` — but a new route is pinned by nothing |
| Voice surfaces ↔ BuildGraph gate | `voice-surface-mutex.ts:31` (`VoiceSurfaceId`: `modal` \| `inline` \| `core`) ↔ the three stores (`talk-overlay-store.ts`, `anvil-inline-store.ts`, `anvil-core-store.ts`) ↔ `game/build-graph.tsx:35-38` (ORs the same three "open" hooks so only one GL context is live) ↔ `header-orb-trigger.tsx:68-79` and `command-palette-content.tsx:437-439` (both gated by `isVoiceViewActive`, `voice-surface-mutex.ts:27`; the palette gate is pinned by `command-palette-content.dom.test.tsx:123-140`, the orb gate by no test). A fourth surface must be added to all of them |
| Dark notes | `src/lib/content.ts:47-56` (`publishedNotes` raw vs `allNotes` gated) ↔ the `/notes` route files, the only readers of `publishedNotes` (`notes/[slug]/page.tsx:25`, `notes/[slug]/opengraph-image.tsx:13`) ↔ `src/lib/notes-dark.test.ts` (llms.txt, feed, MCP, corpus, `.md` handlers) |
| Decisions ledger | Velite fields (`decisions` on Project, `constraints` / `tradeoffs` on Work — `velite.config.ts:40,68-69`) → `src/lib/decisions.ts:23-65` (`allDecisions`, one flat typed ledger) → the `/decisions` client page (`src/app/decisions/page.tsx:7,33-34`) and MCP `list_decisions` (`mcp-tools.ts:214-226`, registered at `api/mcp/[transport]/route.ts:109-118`); gate `src/lib/decisions.test.ts:15-93` — every populated source field has an entry, every entry matches its source verbatim, hrefs match `/^\/(work\|projects)\/[a-z0-9-]+$/`, ids are unique — and it is build-blocking |

---

## Entry-point cheat sheet

"If you want to change X, start at file Y." All paths are repo-relative to the repository root (the
`Anvilry` checkout).

| If you want to change… | Start at | Then also touch / be aware of |
|---|---|---|
| Add or edit a case study / OSS project / note / article | `content/<collection>/<slug>.mdx` (or `make new-work SLUG=…`) | Run `pnpm content`. A new work/project **requires** a matching node in `src/lib/graph-data.ts:18` (`graphNodes`) and an entry in `src/lib/game-model.ts:28` or `game-model.test.ts:22-58` fails `pnpm build`. A new project also moves `impactMetrics` (`profile.ts:65` is `allProjects.length`), so `npx tsx scripts/seal-claims.ts` fails in CI until `--write` re-seals `data/integrity-chain.json`. |
| Add or change a content **field** | `velite.config.ts` (the relevant `defineCollection`) | Make it `.optional()` or every existing file fails validation at once. Then `src/lib/content.ts`, plus any projection that should surface it. |
| Change how content is sorted / filtered / subsetted | `src/lib/content.ts:19-86` | `pinned` without `pinRank` is dropped (`:27-29`); notes/articles sort by ISO **string** compare (`:52,:83`). Notes are hidden here, at the data layer: `allNotes` is `[]` while `NOTES_ENABLED` is off (`:56`) and note-only articles are dropped (`:82`). |
| Change what the chatbot knows | `src/lib/corpus.ts:13-96` | Guarded by `src/lib/corpus.test.ts`. `register` flows verbatim from `:17`. Also feeds `/llms-full.txt` and the terminal `grep` (`commands.ts:180`). |
| Change the LLM model chain, provider, or credentials | `src/lib/llm.ts:45-47` (the `LLM_USE_SONNET_5` toggle, with `isSonnet55PrimaryEnabled()` right after it and `isOpusFallbackEnabled()` at `:75-77`), `:102-137` (`buildChain()` and both chains), `:182-222` (`thinkingEffort()`, `adaptiveThinking()`), `:244-246` (provider), `:255-282` (creds/region) | `src/lib/llm.test.ts` pins model ids across both providers and both toggle states (`describe("LLM_USE_SONNET_5 toggle")`, `:1171`). Add a row to `PRICES` (`src/lib/llm-pricing.ts:57-95`) for any new Bedrock id: without one `llm-pricing.test.ts` fails, and at runtime the event omits `cost_usd` instead of guessing. |
| Change the streaming fallback rule | `src/lib/llm.ts:741-743` (`goingToApology = emittedAny \|\| isLast \|\| !isFallbackEligible(err)`; `isFallbackEligible` `:337`) | `emittedAny` (declared `:468`, set `:676`) also gates trace-frame emission (`:714`), the FAQ-cache `answerText` (`:708`) and the thinking sentinel (`:586`). Pinned by `src/lib/llm.test.ts`'s "emittedAny invariant (load-bearing)" (`:478`), "v1.8 usage capture" (`:154`) and "extended thinking" (`:635`) describe blocks. |
| Change chat request limits / validation | `src/app/api/chat/route.ts:21-22,155-158,167-252` | `MAX_MESSAGES`, `MAX_CHARS`, the 2 MB declared-length ceiling (header only), the 10000-char PDF-block cap, the mediatype allowlists. |
| Change the FAQ response cache | `src/lib/chat-cache.ts` (TTL `:63`, index cap `:66`, answer bound `:79`, semantic threshold `:223`, kill switch `:129-131`) | Lookup `chat/route.ts:276-332` (first-turn string questions only; hit frame carries `cacheHit: true`, header `X-Chat-Cache: hit`), write-through `:423-443` (skipped for an answer from a fallback rung); embeddings in `src/lib/faq-embeddings.ts` (Titan v2, 512 dims); emits telemetry kind `chat.cache`; `chat-cache.test.ts`. The eval cron bypasses it with `X-Chat-Skip-Cache`. |
| Purge a bad cached answer | `POST /api/admin/faq-cache/purge` with Basic auth and `{ "question": "…" }` (`purge/route.ts:31-74`) | Removes the entry (and its index member) keyed by the normalised question (`chat-cache.ts:105-119`); returns 503 when Redis errors or is not configured, 200 `not_found` when nothing matched (`chat-cache.ts:368-388`). |
| Change the chat wire protocol | `src/lib/llm-trace.ts:19-25` | Pinned byte-for-byte by `src/lib/llm-trace.test.ts`. `use-chat.ts:59-116` parses it; `api/cron/eval/route.ts:138` parses a complete body with `answerFromBody` (`llm-trace.ts:67-75`). |
| Add a card or command token the model can emit | `src/components/chat/parse-cards.ts:29-33` (grammar) + `:54-68` (resolution) | Charset is locked to `[a-z0-9-]`. Dispatch lives in `chat-messages.tsx:323-338`. Gate: `parse-cards.test.ts`. |
| Change markdown rendering of assistant text | `src/components/chat/markdown-message.tsx:47-95` | Do not remove `skipHtml` or override `urlTransform` — that is the XSS posture (`:9-16`). |
| Add or reorder a **view** | `src/components/view-context.tsx:24-45` (union, `VIEWS`, `VIEW_ORDER`) | Then `view-router.tsx:62-69`, `enabled-views.ts:20-21`, `view-switcher.tsx:25-59,101-104`, and `parse-cards.ts:60-63` (which validates `cmd:view` against `VIEWS`). `view-context.test.ts` pins the SSR default. |
| Change the view-transition animation | `src/app/globals.css:360-402` | The named groups come from `view-router.tsx:56` and `site-nav.tsx:68`; direction from `view-context.tsx:207-210`. |
| Change SSR/first-paint view behaviour | `src/components/view-context.tsx:90-91` | `getServerSnapshot` must stay `DEFAULT_VIEW` — `view-context.test.ts:30-35` is the guard. |
| Add or change a voice engine | `src/lib/voice-catalog.ts` (add to `CURATED_VOICES` `:134` / `EXTENDED_VOICES` `:283`) | Three lookup Maps build at module load (`:298-312`); adding a voice anywhere else leaves it un-lookupable and un-allowlisted. Then `use-speech-synthesis.ts` and, for a new server engine, a new `api/tts-*` route + cache and a `voice`-class `checkRateLimit` call. |
| Change voice defaults or add a persisted setting | `src/lib/voice-settings-context.tsx:77-88` (`DEFAULTS`) + `:129-158` (`parse`) | Every capability must stay default-OFF; `voice-settings-context.test.ts` asserts it. `parse` must never throw. |
| Add a voice surface | `src/components/chat/voice-surface-mutex.ts:31` (`VoiceSurfaceId`) | Create a store that calls `registerVoiceSurface` at module scope and `claimVoiceSurface` at the top of `open*()` (as `talk-overlay-store.ts:31,46` does); route to it from `header-orb-trigger.tsx:70-79`; add its open hook to the `talkOpen` OR in `game/build-graph.tsx:35-38`. |
| Change how the mic opens | `src/components/chat/use-speech-recognition.ts:162` | `continuous = false` is load-bearing for the whole half-duplex loop (`use-voice-session.ts:26-31`). `mic-button.tsx:59-64` is the consent gate. |
| Add an MCP tool | `src/lib/mcp-tools.ts` (impl + Zod raw-shape schema) | Then register it in `src/app/api/mcp/[transport]/route.ts`, via `T.wrapToolResult()`. Also update the hand-written `TOOLS` table at `src/app/mcp/page.tsx:40-60`. The count has drifted and been fixed twice: 7→9 (`list_all_content`/`get_content_item` were live but undocumented), then 9→10 (`list_decisions` shipped the same way). The page now documents all ten and `route.ts:12` says 10 too. It is enforced, not just corrected — `src/app/mcp/tools-documented.test.ts` reads both the page's `TOOLS` block and the route's `registerTool` calls from source and fails the build if they disagree (helpers `:25-42`, assertions `:52-`), so it cannot silently drift again. If the new tool's data function returns an array, `wrapToolResult` wraps it in `{ items }` automatically — a bare array fails the MCP SDK's `structuredContent` validation. Never import `personal.ts` (`mcp-tools.test.ts:24-46`). |
| Change the MCP not-found contract | `src/lib/mcp-tools.ts:59-71` | `mcp-tools.ts:241` (`wrapToolResult`, moved here from the route file) keys `isError` on the literal `notFound` property (`:242,:249`); renaming it turns errors into successes. |
| Add a telemetry span kind | `src/lib/telemetry/schema.ts:37-50` | The dashboard fetches every kind in `KIND_LITERALS` (`page.tsx:47`) but colours/summarises through switches (`:384,:414-416`), and `scripts/replay-trace.mjs:47-55` has its own hardcoded `KINDS` (already missing `chat.cache`). `schema.test.ts:138-155` pins the 8-kind union. |
| Change what is redacted from telemetry | `src/lib/telemetry/schema.ts:88-111` | Order is load-bearing (email → 32-char token → 12–19 digit run). Callers must redact **before** `emit` — `emit` does none (`emit.ts:30-35`). |
| Change telemetry retention | `src/lib/telemetry/emit.ts:42` (`SEVEN_DAYS_MS`) | The trim itself runs on only 1-in-20 writes (`TRIM_SAMPLE_EVERY`, `:54`; trim at `:85-94`). Also `scripts/replay-trace.mjs:64`, which computes its own `since` from the same window. |
| Add a dashboard tile | `src/app/admin/telemetry/page.tsx` | Add the Redis read to the `Promise.all` at `:493-`; every fetch helper must stay fail-soft (`:22-41,229-239,290-298`). Warn thresholds are inline magic numbers (`:548,598,620,742,761,772`). |
| Change `/admin` auth | `src/lib/admin-auth.ts:24-59` (the predicate) | One predicate, three callers: `proxy()` (`src/proxy.ts:25-31`), `requireAdmin`, and the telemetry page (`:470`) — edit the predicate, not the callers. Guards: `proxy.test.ts`, `admin-auth.test.ts`, `admin/telemetry/page.test.tsx`. |
| Add an authenticated route | `/admin/*` page: nothing to do — `src/proxy.ts:21-23` (`config.matcher = ["/admin/:path*"]`) already covers it (and re-check in the page as `telemetry/page.tsx:470` does). `/api/admin/*` route: call `requireAdmin(req)` first (`purge/route.ts:32`). | The matcher does **not** cover `/api/admin/*`; nothing enforces the call. |
| Add a cron job | `vercel.json:3-7` + a new `src/app/api/cron/<name>/route.ts` | Start the handler with `const denied = unauthorizedUnlessCron(req); if (denied) return denied;` (e.g. `github-sync/route.ts:19-20`), add the route to `cron-auth.routes.test.ts:19-25`, and set `maxDuration`. All five existing crons are fail-closed on `CRON_SECRET`. |
| Change the CSP or a security header | `next.config.ts:37-115` | `'unsafe-eval'` is required by `MDXContent`; the three speech WebSocket hosts keep voice working in Chrome/Edge; the `/resume` override is a literal string replace of `:41` (at `:224-227`). HSTS is deliberately absent. |
| Change rate limits | `src/lib/rate-limit.ts:21-29` (budget, classes, prefixes) | A new route calls `checkRateLimit(req, cls)` with the right class **and** gets a test pinning it, as each of the five existing routes has. `/api/visit` has its own (`api/visit/route.ts:38-45`). Both fail-open paths are deliberate (`:99,:106-109`); a valid `CRON_SECRET` bearer bypasses (`:100`). |
| Add a build-time feature flag | `src/lib/writing-flags.ts` (or a component-local read) | Match the `=== "true"` convention (only `ARTICLES_ENABLED` is `!== "false"`). Read it **inside** a function body if a test needs `vi.stubEnv`. Then `.env.example`, `docs/configuration.md`, and `Makefile:155-180` (`flags-show`). |
| Migrate a flag to runtime toggling | `src/lib/flags.ts:17-29` | Also declare it in `src/app/.well-known/vercel/flags/route.ts:9-24`; requires `FLAG_DRIVER=vercel` + `FLAGS_SECRET`. `FLAG_DRIVER` is captured at module load (`:13`). |
| Gate which views exist in a build | `src/lib/enabled-views.ts:20-43` | Unset ⇒ all on; empty string ⇒ every toggleable view off. `classic` and `resume` cannot be disabled. |
| Change a 3D scene | `src/components/hero-graph/scene.tsx` · `hero-avatar/avatar-scene.tsx` · `game/build-graph-scene.tsx` · `chat/voice-orb-3d.tsx` | Import from `@/lib/r3f`, never directly (`scene-physics.tsx:4-6` and `voice-orb-3d.tsx:5-6` are the exceptions). On a demand frameloop something must call `invalidate()`. |
| Change when 3D mounts at all | `src/components/hero-graph/index.tsx:63-64` · `hero-avatar/index.tsx:56` · `game/build-graph.tsx:50` · `chat/voice-orb.tsx:42` | All four gates include the desktop + reduced-motion terms; the hero gates also include `view === "classic"`; hero-graph, build-graph and voice-orb also include the WebGL probe and an `onFail` latch. |
| Swap the avatar model | `public/avatar/sairam.glb` + `src/components/hero-avatar/avatar-mesh.tsx:10,27,54` (path in 3 places) | `src/lib/avatar-glb.test.ts` blocks the build on size (<1.5 MB), glTF 2.0, meshopt+quantization+WebP, named bones, and the current **zero** morph targets (`:132-157`). |
| Add a terminal command | `src/components/game/terminal/commands.ts:689-722` (registry) | 32 entries today (28 visible + 4 hidden eggs: `secret`, `personal`, `uses`, `now`). Keep `COMMAND_NAMES` `!hidden`-filtered (`:745-747`) **and** the independent re-filter at `terminal.tsx:17-19`. Return a `NavAction`; never import the router. |
| Change build ordering or add a build step | `package.json:11` | The `&&` chain is the deploy gate (velite → vitest → next build → pagefind). `lint` and `tsc --noEmit` are CI-only (`ci.yml:57-61`), as is the bundle budget (`ci.yml:190-191`). Do **not** add `--webpack` to `build`: it silently stops `.next/diagnostics/route-bundle-stats.json` being written and the budget gate then fails by design (`scripts/bundle-budget.mjs:95-99`). |
| Raise the first-load JS budget, or profile what is in a chunk | `scripts/bundle-budget.mjs:72` (`MAX_FIRST_LOAD_BYTES`) · `pnpm analyze` (`package.json:12`) for attribution | Raise the constant in its **own** commit quoting measured before/after bytes (`:69-71`) — never by adding `continue-on-error` to the step. `pnpm analyze` is local-only, needs the explicit `--webpack`, and writes `.next/analyze/{client,edge,nodejs}.html`; re-run `pnpm build` afterwards or the gate has no artifact to read. |
| Change the test runner setup | `vitest.config.ts` | Do not remove `env: { NODE_ENV: "test" }` (`:26`) or the `node` project's `dom` exclude (`:34`). |
| Change E2E coverage | `e2e/views.spec.ts` · `e2e/resume.spec.ts` · `playwright.config.ts` | `webServer` runs `pnpm start`, so CI builds first (`ci.yml:175-177`); both a `chromium` and a `mobile-safari` project run. E2E does not block `pnpm build`. |
| Point a custom domain at the deployment | `src/app/layout.tsx:35` (`siteUrl`) | Then the rest of the base-URL set (20 non-test files / 25 lines; plus `src/lib/mcp-tools.test.ts:86,99` and the `next.config.ts:215` comment) — the enumerated table in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url) is the single authority — and `content.ts:69`, which is functional (coupling table above). |
| Regenerate the search index | `pnpm build` (last step, `package.json:11`) or `make search-index` (`Makefile:65-66`) | The index needs `.next/server/app`, so it can only follow `next build`; `pnpm search-index` does not exist. Output goes to the untracked `public/pagefind/`. |
| Add or bump a dependency | `package.json:23-79` (35 prod + 18 dev) | Respect the exact pins (`next` `16.3.5` / `eslint-config-next` `16.3.4`, `react`/`react-dom` `19.3.0`, `@modelcontextprotocol/sdk` `1.26.0`, `@react-three/postprocessing` `3.1.1`), the `three < 0.187.0` ceiling from `postprocessing` (`pnpm-lock.yaml:4128`), and the 12 overrides — which live in `pnpm-workspace.yaml:18-44`, **not** a `pnpm` field in `package.json`. A new dependency with an install script needs an `allowBuilds` decision (`pnpm-workspace.yaml:81-84`) or `pnpm-build-allowlist-consistency.test.ts` fails the deploy. |
| Add a Dependabot hold | `.github/dependabot.yml` | It is read from the **default branch only** — on any other branch it is inert. `ignore` entries accept a version-scoped `versions: ["x.y.z"]` form as well as a bare package name. |
| Replay one request end to end | `make trace TRACE_ID=…` → `scripts/replay-trace.mjs` | The id comes from the `x-anvilry-trace-id` response header (`with-trace.ts:207`). Needs both Upstash vars; window is 7 days; FAQ-cache spans are not replayed (see the coupling table). |
| Audit which env vars are set | `make env-check` / `make flags-show` | Both read the **process** environment, not `.env.local`, so they under-report locally (`Makefile:289-321,155-180`). |

---

## UNVERIFIED / carried forward

Every item below was left open by the section it came from, or is a limitation of this two-part synthesis
(subsystems 1–6 are in [`14-subsystems.md`](./14-subsystems.md)). Two prior open questions were resolved
and are recorded in the subsystem maps themselves — subsystem 4 and subsystem 6, both in part 1 — rather
than here.

**Resolved**

The first two were resolved while writing this section. The rest were resolved afterwards — by reading more
source, by the fix branches, by the v3.5.0 dependency removals, or by the a929932 refresh; those entries
record the outcome rather than the original open question.

- `budget.tick` has **no producer** in `src/` — declared at `src/lib/telemetry/schema.ts:44`, asserted at
  `schema.test.ts:151`, styled by the dashboard's `kindBadge` at `src/app/admin/telemetry/page.tsx:414`, and
  emitted nowhere (grep of `src/` for `budget.tick` returns only those sites plus a mention in the
  `schema.ts:60` comment). Section 04 left this open. The same grep shows `tts.request` and
  `transcribe.request` are also declared (`schema.ts:40-41`) and consumed (`fetchKind` at `page.tsx:495-496`,
  `kindBadge` at `:414`) but never emitted: TTS/STT failures surface as `server.error` (`tts/route.ts:191`,
  `tts-google/route.ts:171,222`, `transcribe/route.ts:121`) and no success-path event exists, so the dashboard's
  four voice-latency tiles never leave their "no TTS requests yet" / "no transcribe yet" state.
- `getDefaultVoiceId()` returns the literal `"polly-neural-joanna"` for any non-`"male"` argument:
  `return JOANNA.id` (`src/lib/voice-catalog.ts:317-320`) and `id: "polly-neural-joanna"` (`:62`).
  Section 02 asserted this from a comment; it is now read from source.
- **A bare `GET /api/mcp/mcp` returns 405, not 200.** This index recorded the cron as probing that
  endpoint "expecting 200" and left the real GET behaviour unexercised. A later reading called that a
  standing false *negative* — the blanket `!== 200` gate failing `mcp_get` on every run. **That was
  backwards, and the correction is the more interesting bug.** The cron derived its base from
  `VERCEL_URL`, the per-**deployment** host, which this project's deployment protection 302s to Vercel
  SSO; `fetch` follows redirects by default, so the probe read **200 with ~478 KB of
  `vercel.com/login` HTML**. `mcp_get` was therefore **falsely PASSING** — it never saw a 405 to fail
  on — and so were 10 others: **11 of the 13 checks scored the login page as healthy**. Only
  `github_stats_api` and `resume_json_api` failed, and only because `res.json()` threw on the login
  HTML rather than because the status was wrong; the two
  `llms*.txt` body-length checks passed too, since 478 KB clears their 1000-char floor. The cron was
  scoring an auth wall as a healthy app. **Fixed on two axes.** (1) The base now comes from
  `probeBase()`, which prefers `VERCEL_PROJECT_PRODUCTION_URL` — the production alias, exempt from
  protection — over `VERCEL_URL` (`src/lib/health-expectations.ts:51-59`); the route no longer reads
  `VERCEL_URL` at all, and `health-expectations.test.ts:140-146` fails if it does again. `probe()`
  also sets `redirect: "manual"` (`src/app/api/cron/health-check/route.ts:79`) and fails **any** 3xx,
  naming Vercel SSO when the `location` matches (`:85-99`), so a redirect can never be silently
  followed to a healthy-looking 200. (2) Expectations are per-check, with `mcp_get: 405` in
  `EXPECTED_STATUS_OVERRIDES` (`health-expectations.ts:30-32`), applied via
  `isExpectedStatus` at `src/app/api/cron/health-check/route.ts:109`; the probed row itself is
  `route.ts:62`. The 405 is mcp-handler's own unconditional JSON-RPC reply on the Streamable-HTTP
  endpoint — verified live, alongside `GET /api/mcp/sse → 404` and a POSTed `initialize → 200` — so it
  still proves the route is mounted and the handler is alive; the reasoning and the upgrade caveat are
  at `health-expectations.ts:1-29`, guarded behaviourally by `src/lib/health-expectations.test.ts`
  (`:27` the 405 expectation, `:73` the `probeBase` alias-over-deployment suite, `:160-185` the
  mcp-handler version pin and the "405 branch is still unconditional" check). The route's own comment
  (`route.ts:100-106`) now tells the same story — that `mcp_get` was falsely passing — rather than the
  old "failed on every single run" reading. The old `EXPECTED_STATUS` map and its source-grep guard
  `expected-status.test.ts` are **deleted**, and the caveat comment names `health-expectations.test.ts`
  as what pins the mcp-handler version (`health-expectations.ts:26`). **Not fixed elsewhere:** four other
  fetches still derive their base from `VERCEL_URL` — the chat route's live-stats fetch
  (`chat/route.ts:34-35`) and the `eval`, `github-sync` and `seo-audit` crons (`eval/route.ts:105-106`,
  `github-sync/route.ts:32-33`, `seo-audit/route.ts:21`, each the `https://${process.env.VERCEL_URL}` ternary) —
  see *Still open*.
- **`/mcp` as `(force-static)`** — the documentation/source mismatch this index recorded is gone.
  `src/app/mcp/page.tsx` exports only `metadata` (`:9`) and a grep for `force-static` (and for
  `export const runtime | revalidate | dynamic`) across `src/` still finds no segment-config export — only
  comments that say one was removed (re-verified for a929932 plus the five fixes).
- **Whether `next build` still uses webpack by default in Next 16 — it does NOT, and the claim this index
  carried was FALSE.** It is **Turbopack**. The claim's only source was the now-deleted
  `bundle-analysis.yml`'s own comment ("`next build` uses webpack by default in Next.js 16 (Turbopack is
  opt-in via --turbopack flag, dev-only)"), which this index recorded as the repo's own claim rather than
  as fact — correctly cautious, and the caution was warranted. Nothing in this repo configures a bundler,
  and `node_modules/next/dist/lib/bundler.js:142-144` — "The default is turbopack when nothing is
  configured" — sets `process.env.TURBOPACK = 'auto'`; a local `.next/diagnostics/framework.json` reports
  Next.js 16.3.5 next to a `route-bundle-stats.json` — an artifact only Turbopack writes
  (`node_modules/next/dist/build/index.js:2843-2844`) — so a default build there was Turbopack. `next dev`
  resolves its bundler through the same function (`node_modules/next/dist/cli/next-dev.js:173`). Two
  consequences, both recorded in § 10 The bundle budget gate: the deleted workflow's `ANALYZE=true` build
  could never emit a report, because `@next/bundle-analyzer` is webpack-only; and the artifact the
  replacement gate reads exists *because* the build is Turbopack. **What does not change:** the 876 KB
  single-chunk three.js result at `next.config.ts:153-164` was always a **Turbopack** measurement — its
  own text says the flag "does NOT collapse the R3F twin-chunk in Turbopack" (`:148-149`) — and
  `scripts/bundle-budget.mjs:76` re-measures the same chunk at 897,249 B. That invariant and
  `src/lib/r3f.ts`'s load-bearing role both stand; only the bundler attribution was wrong.
- **Whether `@react-three/offscreen` and `@react-three/rapier` were retained intentionally** — answered by
  deletion. Neither was imported anywhere in the repo, and **both were removed from `package.json` in
  v3.5.0** (prod dependency count 35 → 33 at that release; `package.json` lists 35 prod + 18 dev today
  after unrelated additions). `docs/superpowers/plans/2026-06-23-c4-r3f-physics.md:5,7,9` is
  the origin of the rapier install and never said why it stayed after the physics variant shipped without
  it; the answer is that it should not have. The two absence observations this index recorded still hold and
  are now permanent rather than provisional: there is no worker/OffscreenCanvas path
  (see [§ Perf decisions](#perf-decisions-concretely)), and `NEXT_PUBLIC_GRAPH_PHYSICS` gates a sinusoidal
  drift variant, not a physics engine. One artefact outlives the packages and is **not** cleaned up: the
  CSP still carries `worker-src 'self' blob:` (`next.config.ts:68`) for a worker that never existed. The
  mount-side comment (`hero-graph/index.tsx:14-17`) has since been brought in line with the removal.
- **That `src/proxy.ts` executes on the Edge runtime — it does NOT.** The old docblock (and this index, and
  the project docs) asserted Edge and justified a hand-rolled Web-Crypto twin of the admin check with it.
  Next 16's Proxy defaults to the Node.js runtime and rejects a `runtime` option in Proxy files
  (`file-conventions/proxy.md`, § Runtime, in the docs bundled under `node_modules/next/dist/docs/`); `src/proxy.ts`
  now says so (`:6-9`) and imports the Node-only `isAdminAuthorized` (`:4`, `admin-auth.ts:1` imports
  `node:crypto`), which is what makes a constant-time compare possible at the first gate. See § 7.
- **Whether the E2E CI job is a required check, and whether `develop` is branch-protected — read live, not
  from the tree.** A GitHub API read on 2026-09-29 shows classic branch protection absent on both branches
  (`GET …/branches/<b>/protection` → 404) but an **active repository ruleset**, "anvilry protected branches -
  core", covering `refs/heads/main` and `refs/heads/develop` with no bypass actors and exactly three rules:
  `deletion`, `non_fast_forward` and `pull_request` (0 required approvals). It has **no**
  `required_status_checks` rule, so no CI job — E2E included — is a required check on either branch, and no
  required check disappeared when `bundle-analysis.yml` was deleted. (Earlier text, including this index and
  `CHANGELOG.md:427`, recorded `protected: false` from the classic endpoint; the ruleset is why the branches
  API now reports `protected: true`.)
- **What generates `public/static/`, and the manifest screenshots defect.** `public/static/` is Velite's asset
  output directory (`velite.config.ts:145-147`: `assets: "public/static"`, `base: "/static/"`), untracked (git does not
  track empty directories) and empty because no MDX references an asset; the only other references are
  `src/lib/case-study-depth.test.ts:24-27` (the `diagram` frontmatter path convention) and
  `eslint.config.mjs:19` (ignore). The related defect this index recorded — `manifest.ts` declaring PWA
  screenshots at `/static/screenshot-{desktop,mobile}.png` with no such file, so both URLs 404 — is **fixed**:
  `src/app/manifest.ts` no longer has a `screenshots` key (`icons` at `:15-19` is the last entry) and the comment
  at `:20-25` records what was dropped, why, and how to re-add it. `src/app/manifest.test.ts` pins the current
  shape (`:66-72` asserts zero screenshots) and walks whatever *is* declared, so a re-added screenshot with no
  file behind it fails the build.

**Still open**

- **Which `.md` implementation serves a live request.** `next.config.ts:240-248` returns the bare-array
  (afterFiles) `rewrites()` form pointing at `/api/md/<collection>/:slug`, and filesystem handlers also
  exist at `src/app/<collection>/[slug].md/route.ts`. Resolution order was not exercised against a running
  server; the two sets share their helpers' logic. Both read `content/*.md(x)` from disk at request time
  (`readFileSync(join(process.cwd(), "content", …))`), and `next.config.ts` has no `outputFileTracingIncludes`,
  so whether `content/` ships inside the deployed function bundle is not established from the tree.
- **That Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}` automatically.** The claim comes from
  the route docstring (`src/app/api/cron/eval/route.ts:14-15`) and is assumed by the other four crons;
  platform behaviour was not verified.
- **Whether Vercel deployment protection also blocks the four `VERCEL_URL`-derived fetches** (chat live stats,
  `eval`, `github-sync`, `seo-audit` — listed above). Only `health-check` was moved to `probeBase()`; the SSO-wall
  effect on `eval` was observed on 2026-10-01 (the generated host answers `POST /api/chat` with 401 while the alias reaches the app), and on the other three is inferred from the health-check finding, not observed.
- **Runtime cache/CDN behaviour of the statically-eligible routes** (`/llms.txt`, `/llms-full.txt`,
  `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/api/resume.json`). None sets `Cache-Control` and none reads
  the request, so all are prerenderable under `cacheComponents`, but no build manifest was inspected to
  confirm each was actually prerendered.
- **Render-mode / revalidate / prerendered-slug values** in section 01's route matrix came from a local,
  gitignored build and reflect that machine's `.env.local` flag values (notably whether
  `NEXT_PUBLIC_NOTES_ENABLED` was on). A production build with different `NEXT_PUBLIC_*` values prerenders
  a different slug set. Segment-config columns are read from source and are env-independent.
- **Whether `/articles/<slug>` routes that `redirect()` emit a prerendered page artifact.** Several slugs
  present in `generateStaticParams` have an `opengraph-image` manifest entry but no page entry — consistent
  with the redirect path, not proven.
- **Whether the CSP was ever actually deployed as `Content-Security-Policy-Report-Only`,** and the contents
  of the Playwright zero-violation sweep referenced at `next.config.ts:104-113`. No such audit script or spec
  was located in `e2e/` (`resume.spec.ts`, `views.spec.ts`).
- **Whether `SECURITY_ALERTS_TOKEN` is configured** (not inspectable from the working tree), so whether
  `ci.yml`'s `security-alerts` job reports anything today is unknown.
- **Whether Vercel sets HSTS by platform default** (`next.config.ts:87-88`) — asserted in a comment, not
  verifiable from this repo.
- **Whether the Vercel build shell sets `NODE_ENV=production`** (the stated reason for
  `vitest.config.ts:26`) — taken from the config comment.
- **Actual PDF text extraction under `pdfjs-dist` 6.2.108** (`package.json:48` declares `^6.2.108`). Commit
  `2f309d2` flags it as NOT VERIFIED (needs a real browser upload); build and typecheck pass but the
  extraction path was never exercised post-bump.
- **Whether migrating `zod` from `^3.25.76` to v4 breaks the raw-shape schema handoff** to `mcp-handler`'s
  `registerTool` (`src/lib/mcp-tools.ts:37-54`, and `:205,:228`). The one constraining peer — `@modelcontextprotocol/sdk`
  — already permits v4 (`zod: ^3.25 || ^4.0`, `pnpm-lock.yaml:1007`; `mcp-handler@1.1.0` declares no `zod` peer,
  `:3708-3715`), but nothing in the repo exercises v4.
- **Whether `eslint.config.mjs`'s `globalIgnores` replaces or merges with `eslint-config-next`'s built-in
  ignores.** The comment at `:8` says "Override default ignores" and the list (`:9-22`) re-declares the four
  defaults (`:11-14`) before adding generated/build paths, implying replace; flat-config merge semantics were
  not verified against the installed package.
- **Runtime bundle boundaries** are inferred from `use client` directives, `dynamic()/ssr:false` wrappers,
  and route-handler placement — not from reading `.next/` chunk manifests. Narrowed: the first-load surface
  is no longer inferred at all, because `scripts/bundle-budget.mjs` reads Next's own per-route artifact in
  CI (`MIN_ROUTES = 17`, ceiling 1,336,000 B, three.js in 0 routes' first-load sets) — but that gate
  reports first-load bytes and chunk paths, not which module put them there, so *why* a boundary falls
  where it does is still inference. The three.js single-chunk figure is measured twice over:
  `next.config.ts:153-164`'s recorded build and `scripts/bundle-budget.mjs:76`'s 897,249 B. **Neither was
  re-measured for a929932** — no build was made for this refresh.
- **What was actually run for this refresh (a929932 + five fixes).** Read-only `grep`/`sed`/`find` over the
  worktree and `node_modules`; `git diff a929932..HEAD` over the source tree (the five fixes);
  `node scripts/check-index-citations.mjs`; a stdlib parse of the `.glb`'s glTF JSON chunk (size, nodes, skins,
  images, morph targets); `git rev-list --count v3.6.0..a929932` (297); read-only GitHub API GETs on 2026-09-29
  (branch protection, the ruleset, the base branches of PRs #109/#239/#240); a read of one local
  `.next/diagnostics/route-bundle-stats.json` and `framework.json`. `pnpm build`, `pnpm test`, `pnpm lint`,
  `tsc --noEmit`, `pnpm e2e` and `node scripts/bundle-budget.mjs` were **not** run by this pass; the totals quoted (93 test files, 817
  tests, all passing under vitest 5.0.0) come from a full `vitest run` recorded in the refresh's shared
  measurements. All other behaviour described is read from source, not observed at runtime.
- **Stale-comment / doc-drift items carried forward** (each re-checked against a929932 plus the five fixes and
  still true; none fixed by this index): the `highlight-store.ts:6-9` claim that `project-card.tsx` can
  subscribe — in fact `useHighlightedSlug` (`highlight-store.ts:49`) has **no importer**, only `highlightProject` is called
  (`chat-messages.tsx:334`), so the `[[cmd:highlight:<slug>]]` token drives a store nothing reads;
  `open-to-work-banner.tsx:6-8` "Hidden via CSS (h-0) when the flag is off" (the banner has no such CSS; the
  caller gates it, `layout.tsx:134`); `home/resume-view.tsx:13-16` "ViewEscapeHatch auto-rendered by
  view-router" (`view-router.tsx` never renders it; the non-classic views mount it themselves — `chat-view.tsx:85`,
  `anvil-view.tsx:35`, `developer-view.tsx:45`, `game-view.tsx:32` — and `resume-view.tsx` does not);
  `anvil-core-surface.tsx:26` "~200px reactive orb"; `use-trace-runner.ts:69-70` "Reset when the scenario changes";
  the ReadyPlayerMe wording in `avatar-mesh.tsx:13,94` and `rig.ts:47,54` (the shipped asset is an Avaturn
  export); `avatar-mesh.tsx:19-21` ("only runs when invalidate() is called (mousemove or touchmove from
  AvatarControls)" — `useAvatarIdle` also invalidates every frame, `use-avatar-idle.ts:27`);
  `.env.example:128-129`
  (an unset `GOOGLE_TTS_API_KEY` "hides" the Google engine option from settings — nothing client-side reads the
  key, `voice-settings-dialog.tsx` lists every `TtsEngine`, and `tts-google/route.ts:39` only turns the request
  into a 503); the `github-sync/route.ts:6-17` docstring ("Hourly GitHub stats cache warm", "1 GitHub API call per hour") against
  `vercel.json:5` (daily, `0 8 * * *`) and the 5400 s key TTL (`github-sync/route.ts:53`) — the idempotency
  skip (`github-sync/route.ts:26-30`) can only fire for a manual or duplicate invocation within 90 minutes of a
  run, never on the next scheduled one. (The `.env.example` comments for `TELEMETRY_ENABLED` ("disables all event
  emission") and `ADMIN_PASSWORD` ("renders auth instructions"), and the matching `Makefile` `env-check` message,
  used to head this list; they were corrected together with this index and now describe the real behaviour —
  `TELEMETRY_ENABLED` only gates the `/api/error` beacon, `error/route.ts:92`; an unset `ADMIN_PASSWORD` is a bare
  401, `admin-auth.ts:26-31`.)
- **Stale in-file comments found in this refresh:** `next.config.ts:19-20` ("shipped as Report-Only first" —
  the header at `:114` is enforced); `src/app/search/page.tsx:6` (bundle "generated post-build by
  `make search-index`" — it is the last step of `pnpm build`); `scripts/bundle-budget.mjs:27` (the header's
  "16 routes" measurement, against `MIN_ROUTES = 17`) and `:70,75,152` (cite lines 127–149 of `next.config.ts`, now
  `:153-169`); `src/app/api/github/stats/route.ts:5-6` (cites line 101 of `github.ts`, now `:114`); `.github/dependabot.yml:80`
  ("Pinned to 3.0.4" — `package.json:34` pins `3.1.1`); `src/app/articles/[slug]/page.tsx:25-28` (cites
  `:59` for the external-article redirect — it is `:77-81` — and line 103 of `velite.config.ts` for the optional
  `externalUrl` — it is `velite.config.ts:131`).
- **Four stale-comment items listed in earlier editions are FIXED** by the comment sweep on the fix branch,
  and are dropped from the carried-forward list rather than renumbered: `graph-data.ts:3` no longer counts
  systems ("every flagship work system + every OSS repo … see `graphNodes` below for the count");
  `game-model.ts:19` reads "3 of the **16** graph node ids" and names the three affected ids; `scene.tsx:18-19` is
  count-agnostic ("Count is taken from `graphNodes.length`"); and `agent-trace.ts:13-16` no longer claims the
  test "BLOCKS shipping" (see [§ Tests as a gate](#tests-as-a-gate--what-that-actually-means)).
