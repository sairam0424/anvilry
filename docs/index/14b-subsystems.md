---
kind: doc
title: Cross-cutting subsystem maps (part 2 of 2)
domain: [content]
status: current
version: v3.17.0
---

# Cross-cutting subsystem maps — part 2 of 2

> Part of the Anvilry v3.17.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
> **Baseline:** describes Anvilry v3.17.0 (`package.json` 3.17.0), i.e. `main` at a929932 (`package.json` 3.6.0, 297 commits past the v3.6.0 tag) plus twenty-eight
> post-a929932 changes in all (twenty-seven released, the twenty-eighth not yet in any version), those that touch these subsystems described by behaviour, starting with five fixes — notes are hidden at the data layer when `NOTES_ENABLED` is
> off (the default of a default build and of GitHub CI; the Vercel build environment has it on (observed, not in the repository; see 10 UNVERIFIED)); rate limiting has per-class buckets (`chat` / `voice` / `beacon`) with an eval-cron bypass, built on
> `src/lib/cron-auth.ts`; admin auth goes through the shared `isAdminAuthorized` (`src/proxy.ts`,
> `requireAdmin`, the telemetry page); overlay voice entry points are gated by `isVoiceViewActive`; the
> bundle-budget gate asserts `MIN_ROUTES = 17` and verified-dead components were removed (`article-card.tsx`,
> `ui/button.tsx`, `ui/empty-state.tsx`, `ArticleJsonLd` in `json-ld.tsx`). v3.16.0 adds three more, two of which land here: the projects collection grows to 20 in four groups with 25 graph nodes (subsystem 9, 3D / WebGL), and the compiled-MDX split moves the bundle gate's first-load figure for `/` to 976,936 B (subsystem 10, build & deploy); the private-repository marker lands in subsystem 1 (`14-subsystems.md`). v3.16.1 adds three more, all landing here: (23) the removal of three low-priority open-source items takes the projects collection from 20 to 18 (16 of them public) and the graph from 25 nodes to 23 and from 28 edges to 24 (subsystem 9, 3D / WebGL; the cards and the feed-allowlist entries themselves are subsystem 1, `14-subsystems.md`); (24) the production gate, a Vercel Deployment Check that holds a new production deployment off the production domain until the `Post-deploy smoke` commit status is green, with a GitHub issue opened when a smoke step does not succeed (subsystem 10, build & deploy); and (25) the bundle gate's `MAX_FIRST_LOAD_BYTES` of 988,000 B (was 1,336,000 B) together with a bounded, retried E2E browser install (subsystem 10). v3.17.0 adds two more, both landing here: (26) the agent-readable surface, whose `src/proxy.ts` job beside the `/admin` gate is subsystem 7 and whose six extra smoke checks (26 in all, was 20) are subsystem 10; and (27) the dependency security release — Next 16.3.5 to 16.4.3, the MCP SDK pin 1.32.0, fourteen pnpm overrides (twelve before), `vite` declared, the search-index script that works under Vercel's adapter layout, and `/` at 966,794 B of first-load JS (subsystem 10). The unreleased (28), the API-policy change, lands in three places: the proxy's third job beside the `/admin` gate and the Markdown negotiation (subsystem 7), the public API contract with its versioned JSON API, limiter and catalog (subsystem 11), and the Markdown twins of ten pages (subsystem 12); it also takes the smoke gate to 30 checks (subsystem 10). Its later pass lands in four more places: the batch endpoint (subsystem 13), the JSON-LD lists and the hardened serialiser (subsystem 14), the source of the `anvilry` command-line client and the flag that keeps the site's wording about it honest (subsystem 15) and the split of `/developers` into section components (subsystem 16); its typed MCP parameters and JSON-RPC errors are subsystem 5 in `14-subsystems.md`.
> Continues [`14-subsystems.md`](./14-subsystems.md), which maps subsystems 1–6 (content pipeline · view
> system · chat/LLM · voice · MCP · telemetry).

**Scope:** the "how the parts connect" layer — **subsystems 7–16 of 16** (auth & security surface · feature
flags · 3D / WebGL · build & deploy · public API contract · page Markdown twins · batch endpoint · structured data (JSON-LD) · the `anvilry` CLI package and its publish flag · the `/developers` section architecture), plus the cross-subsystem coupling table, the entry-point cheat sheet,
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
| 7 | Auth & security surface | Two credential schemes: HTTP Basic (`ADMIN_PASSWORD`) on `/admin/*` (`src/proxy.ts`, Node runtime, first `config.matcher` entry `"/admin/:path*"`, re-checked by the telemetry page) and on `POST /api/admin/faq-cache/purge` (route-level `requireAdmin`; the proxy does not gate it: its `/api/:path*` matcher entry wakes the proxy and the request passes on); `Bearer ${CRON_SECRET}` on all five `/api/cron/*` routes (`unauthorizedUnlessCron`) | `401`, `notFound()` (the page re-check) or `NextResponse.next()` (the proxy's second job, Markdown negotiation, is a content concern, not an auth one: see § The proxy's second job); everything else is public, guarded only by the enforced CSP + six other headers, three per-class rate-limit buckets (plus a separate `/api/visit` limiter), and nine sanitisation boundaries |
| 8 | Feature flags | Two mechanisms: build-time `NEXT_PUBLIC_*` reads (30 flags, a redeploy to change) and the Vercel Flags SDK when `FLAG_DRIVER=vercel` (seconds, exactly one migrated flag) | A boolean at each read site — for the one SDK flag, awaited in `RootLayout` (`src/app/layout.tsx:87-91`) and threaded as a prop into `<Providers>` and `<CommandPalette>` — plus one `[flags]` log line per resolution |
| 9 | 3D / WebGL | Mounting `<Hero>` on `/` (both hero slots), entering the gamified view (`BuildGraph`), opening any voice surface (`VoiceOrb`), or the 404 page with `NEXT_PUBLIC_404_ORB=true` | Pixels in a `<canvas>`; the hero, avatar, voice-orb and 404-orb wrappers are `aria-hidden` and decorative, the Build Graph canvas is a pointer-driven enhancement, and the accessible content is elsewhere |
| 10 | Build & deploy | `git push` (CI runs on `branches: ["**"]`), a PR into `develop` or `main`, or a manual `make deploy-preview` / `make deploy-prod` | A Vercel Preview URL (from `develop`) or the production deployment (from `main`) whose build also emits the Pagefind index, five live cron schedules, and one `[config]` cold-start line per server process |
| 11 | Public API contract (versioned JSON API, limiter, catalog) | Any request for a path `isPublicApiPath` accepts — the `/api/v1` routes, the unversioned `/api/resume.json` and `/api/github/stats`, the MCP endpoint, the discovery files and the Markdown twins — which `src/proxy.ts` stamps and counts before the route answers; a client reads the contract at `/api/v1`, `/openapi.json`, `/developers` and `/.well-known/api-catalog` | The route's own answer carrying `API-Version: 1` and the `RateLimit` fields, or a JSON 400 / 405 / 429 in the shared error shape, with `Retry-After` on the 429 |
| 12 | Markdown twins of pages | `GET /<page>.md` (rewritten to `/api/md/pages/<page>`) or `Accept: text/markdown` on `/<page>`, for one of ten pages: about, articles, contact, decisions, developers, mcp, notes, privacy, projects, work | A Markdown document with one `#` heading, absolute links and a footer naming the HTML page; or the Markdown 404 (`/notes` while the notes flag is off, `/articles` with nothing published); or the shared JSON 500 if a prose page cannot be converted |
| 13 | Batch endpoint (`POST /api/v1/batch`) | `POST /api/v1/batch` with `{ "requests": [ { "id", "method"?, "path" } ] }`, `Content-Type: application/json`, which `src/proxy.ts` counts as one request of the 300 / 60 s budget before `src/app/api/v1/batch/route.ts` reads the body | `200 { "responses": [ { id, status, body } ] }` in request order, each item with the status its own `/api/v1` route answered; or, with nothing run, a 400 `invalid_request`, a 413 `payload_too_large` (body over 16,384 bytes, or an answer over 1,048,576), a JSON 405 or a 429 |
| 14 | Structured data (JSON-LD) | A crawler or agent reading the HTML of `/`, `/developers`, `/mcp` or an article or note page | `<script type="application/ld+json">` blocks: three `ItemList`s on `/`, a `WebAPI` and a `TechArticle` on `/developers`, a `WebAPI` on `/mcp`, all serialised by `safeJsonLd` |
| 15 | The `anvilry` CLI package and its publish flag | A terminal running `anvilry <command>` (`npx anvilry`, now that the package is on npm; from a clone, `node cli/bin/anvilry.mjs`) and `src/lib/developer-tools.ts`, the site's one descriptor of the CLI | JSON on stdout, errors on stderr, an exit code 0 to 3; on the site, the CLI section of `/developers`, its Markdown twin and the CLI line of `llms.txt`, all worded from `CLI.published` |
| 16 | The `/developers` section architecture | `GET /developers`, or `GET /developers.md` and `Accept: text/markdown` on `/developers` | An HTML page, or a Markdown document that contains everything the HTML shows, both made from the components listed in `src/app/developers/sections/index.ts` |

## Coverage

**Mapped in this file (10 of 16):** 7. auth & security surface · 8. feature flags · 9. 3D / WebGL ·
10. build & deploy · 11. public API contract · 12. page Markdown twins · 13. batch endpoint · 14. structured data (JSON-LD) ·
15. the `anvilry` CLI package and its publish flag · 16. the `/developers` section architecture — followed by the cross-subsystem coupling table (36 multi-site contracts), the
entry-point cheat sheet ("if you want to change X, start at file Y", ~59 tasks), and the UNVERIFIED /
carried-forward ledger for both parts.
**Subsystems 1–6 are in [`14-subsystems.md`](./14-subsystems.md):** content pipeline · view system ·
chat/LLM request path · voice pipeline · MCP server · telemetry & observability.
**Synthesized from** sections [01](./01-routes-pages.md)–[13](./13-dependencies-and-versions.md) (each cites
its own reads), plus direct reads recorded where they are used: a `force-static` / segment-config grep across
`src/` (no `force-static`; no `runtime` / `revalidate` / `dynamic` export, only comments recording their removal), the Next 16 Proxy runtime note (`file-conventions/proxy.md`, § Runtime, in the docs bundled under `node_modules/next/dist/docs/`),
and — for subsystem 10's bundle gate — `node_modules/next/dist/lib/bundler.js:142-144`,
`node_modules/next/dist/build/index.js:2922-2923` and `node_modules/@next/bundle-analyzer/index.js:7-14`
(all re-read against the installed Next 16.4.3).

---

## 7. Auth & security surface

There are two credential schemes and no user accounts. **HTTP Basic** (one shared `ADMIN_PASSWORD`, no
username semantics) guards `/admin/*` twice — the Proxy and the page itself — and separately guards
`POST /api/admin/faq-cache/purge`, which the Proxy does not gate (its `/api/:path*` entry wakes it and the request passes on) and which calls `requireAdmin` itself.
**`Bearer ${CRON_SECRET}`** guards the five `/api/cron/*` routes and doubles as the rate-limiter bypass for
the eval cron. Everything else is public. The rest of the security posture is headers, per-class rate
limiting, and nine sanitisation boundaries. Both auth predicates live in Node-only modules
(`src/lib/admin-auth.ts`, `src/lib/cron-auth.ts`) and compare SHA-256 digests with `timingSafeEqual`.

### Flow — the `/admin` gate

```
GET /admin/telemetry
   → src/proxy.ts  (Next 16 Proxy — NODE runtime by default; first config.matcher entry "/admin/:path*", :42-43)
        pathname is /admin or under /admin/ — checked BEFORE any Markdown negotiation            :166
        isAdminAuthorized(req.headers.get("Authorization")) is false
             → 401 "Unauthorized" + WWW-Authenticate: Basic realm="anvilry"                     :167-172
        otherwise → NextResponse.next()                                                          :174
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

One predicate, three callers: `proxy()` (`src/proxy.ts:173-182`), `requireAdmin(req)` (`admin-auth.ts:48-50`, whose deny
response adds `WWW-Authenticate` + `Cache-Control: no-store`, `:61-69`), and the telemetry page (`:470`). The
Proxy docblock (`proxy.ts:12-22`) states the runtime and the layering plainly: Node by default (the Next docs
say `runtime` is not configurable in Proxy files — `file-conventions/proxy.md`, § Runtime, in the docs bundled under `node_modules/next/dist/docs/`),
and the Proxy is "the first filter, not the only gate" — the page re-checks, so the dashboard stays protected
if the matcher is ever bypassed or edited. Guards: `src/proxy.test.ts` (unset password, missing header, wrong
same-length credential, malformed base64, both credential forms), `src/lib/admin-auth.test.ts`,
`src/app/admin/telemetry/page.test.tsx` (`notFound()` and no Redis read without credentials; renders and reads
Redis with them). All of these pin allow/deny **outcomes** only — nothing asserts that the compare is actually
constant-time (no spy on `timingSafeEqual`; the header of `admin-auth.test.ts` claims it at `:4-9`, but swapping
`constantTimeEqual` for `===` would leave the suite green), and `cron-auth.test.ts` has the same gap.

### The purge route — the one authenticated API

`POST /api/admin/faq-cache/purge` (`src/app/api/admin/faq-cache/purge/route.ts`, `maxDuration = 10` at `:5`)
is **not gated** by the Proxy (its `/api/:path*` entry wakes it and the request passes on), so it authenticates itself: `requireAdmin(req)` at `:33`, then a declared
`Content-Length` ceiling of 4 KB (`:30,:36-39`), a post-parse `JSON.stringify(body).length` backstop
(`:52-54`), and a `question` that must be a non-blank string of at most 2000 characters (`:59-65`) before
`faqCachePurge(question)` (`chat-cache.ts:465`) removes that one cached answer. It is deliberately **not**
rate-limited (`:17-19`) — it is the operator remediation path for a cached answer that finished cleanly but
should not be replayed (§ The sanitisation boundaries, FAQ cache row). `route.test.ts` covers the three 401
paths (`:52-73` — no credential, wrong credential, unset `ADMIN_PASSWORD`; the first two also assert Redis is
never touched) and the authenticated contract (`:75-122` — `purged`, `not_found` answered with 200, 503 when
Redis throws, 400 for a blank or missing `question`, 413 for a declared oversize body). A new `/api/admin/*`
route inherits **no** protection from `proxy.ts`; nothing (test, lint) enforces that it calls `requireAdmin`.

### The proxy's second job — Markdown negotiation

`src/proxy.ts` has had a second responsibility since the agent-readiness change: for a request whose `Accept` header mentions `text/markdown` it decides whether to serve the Markdown twin of a page (a content item, the homepage or, since the API-policy change, one of ten pages; subsystem 12). It sits in this subsystem because it shares the file and the matcher with the `/admin` gate, but it grants and denies nothing: every path ends in an ordinary response, and the admin check always runs first.

```
any request whose Accept header mentions text/markdown   (the conditional matcher entry, `has` header accept, :54-57)
   → src/proxy.ts proxy(): not /admin, not a public API path → negotiateMarkdown(req)           :179 (:64-95)
        classifyPath(pathname)                      (src/lib/markdown-routing.ts:35-53)         :66
           pass       /api/ /_next/ /_vercel/ /.well-known/ /admin/, any file extension,
                      metadata images, HTML_ONLY_PAGES (/resume /search /stats)  → NextResponse.next()   :67
           rewrite    "/", /<projects|work|articles|notes>/<slug>, or one of the ten PAGE_TWINS
           not-found  anything else
        negotiate(Accept, ["text/html", "text/markdown"])  (src/lib/accept-negotiation.ts:62-90)  :69
           "text/markdown" → rewrite to /api/md/home, /api/md/<kind>/<slug> or /api/md/pages/<page>   :71-72
                             (not-found → /api/md/not-found?p=<path>, a real 404, Markdown body)   :73-75
           null on a negotiated page → 406 text/plain, Vary: Accept, Cache-Control: no-store       :80-89
           otherwise HTML → NextResponse.next(), Vary: Accept appended on negotiated routes        :92-94   (the proxy's own response)
```

The matcher entry is conditional so that browsers and crawlers, which never ask for Markdown, never invoke the proxy for it (the other matcher entries wake it for the admin gate and the public API paths, below). The decision logic lives in two pure modules with their own tests (`accept-negotiation.test.ts`, `markdown-routing.test.ts`), and `src/proxy.test.ts` pins the outcomes. The static half of the same contract is in `next.config.ts` (`headers()`, `:286-300`): a request for `Vary: Accept` and a `Link: <…md>; rel="alternate"; type="text/markdown"` header on `/`, on each of the ten page twins and on `/<kind>/:slug` (the slug pattern excludes dots, so an explicit `.md` URL does not advertise itself), with the RFC 8631 `service-desc` and `service-doc` links and the RFC 9727 `api-catalog` link on `/`; `src/next-config.test.ts` pins it. Next replaces `Vary` on HTML responses and keeps it on Markdown ones (the comment at `next.config.ts:265-267`), so `Vary: Accept` is claimed only for the Markdown responses and the `Link` header is what lasts on the HTML pages. Two properties make the second job safe to leave in the security map: the response for a Markdown 404 echoes the requested path only after `sanitizeRequestedPath` (every character outside `[A-Za-z0-9/._~%-]` becomes `?`, 80 characters at most), and `markdownForContent` reads a file only for a slug that is in the Velite collection. The one way it can go wrong for visitors is a new extension-less page missing from both `PAGE_TWINS` and `HTML_ONLY_PAGES`, which would answer a Markdown client with a 404 for a page that exists; `markdown-routing.test.ts` walks `src/app` and fails first.

### The proxy's third job — the public API contract

Since the API-policy change `src/proxy.ts` also stamps and counts the free, read-only public surface (docblock
`:29-35`). After the admin gate, `proxy()` asks `isPublicApiPath(pathname)` (`src/proxy.ts:184`; `src/lib/public-api-paths.ts:57-62`)
and hands a public path to `servePublicApi` (`src/proxy.ts:126-168`) instead of `negotiateMarkdown` (which it still calls last,
`:167`). `servePublicApi` runs in a fixed order: a request `API-Version` other than `1` is a JSON 400 (`versionRejection`, `:113-124`,
called at `:128-129`); `OPTIONS` is answered 204 with `Allow` set to the path's own list, never counted, except on the MCP path,
which hands the request to its own handler (`:138-141`); a method that the path's entry in the method table does not list is a
JSON 405 carrying that `Allow` (`:145-154`, again not on the MCP path); then the client's budget is spent (`:156`) and an
over-budget request is a JSON 429 with `Retry-After` (`:158-166`). The method table is `allowedMethods` in
`src/lib/public-api-paths.ts:41-55`: `GET, HEAD, OPTIONS` for every public path except `/api/v1/batch`, the one POST of the free
API besides MCP, which takes `POST, OPTIONS` (subsystem 13); the batch route's own 405 stubs name the same list
(the OpenAPI 405 responses document only a generic `Allow` header). `stamp` (`:100-109`) adds `API-Version: 1`, the `RateLimit` fields and, when
`DEPRECATIONS` matches the path, `Deprecation`, `Sunset` and a successor `Link`. The paths, the numbers, the limiter and
the routes behind them are subsystem 11; the point for this map is that the matcher (`:41-59`) and the predicate must name
the same paths, or the proxy never wakes for one and its responses silently lose the headers
(`public-api-paths.test.ts` fails first), and that none of this emits a telemetry span (`TELEMETRY.md:7`).

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
(`eval/route.ts:121-127`; `src/app/api/cron/eval/route.test.ts` asserts the bearer on all 12 calls and, in its "eval cron cache bypass" block (`:123`), the skip-cache header on all 12) and would
otherwise self-throttle against the 8/min budget.

### Headers and CSP

Defined in `next.config.ts`; applied to `/:path*` at `:287`, with a `/resume` + `/resume/:path*` variant at
`:289-290`. Seven headers in total (`securityHeaders`, `:121-147`).

| Header | Value | Cite |
|---|---|---|
| `Content-Security-Policy` | **ENFORCED** (the header key at `:146` is the enforcing one, not Report-Only) | `next.config.ts:37-85,146` |
| `X-Frame-Options` | `DENY` → `SAMEORIGIN` on `/resume*` | `:122`, `:251-252` |
| `X-Content-Type-Options` | `nosniff` | `:123` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `:124` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `:129` |
| `Cross-Origin-Resource-Policy` | `same-origin` | `:130` |
| `Permissions-Policy` | `microphone=(self), camera=(), geolocation=(), browsing-topics=()` | `:131-135` |
| HSTS | **intentionally absent** — set by Vercel's platform default | `:119-120` |

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
  (`:256-259`). Editing `next.config.ts:41` (reorder or requote) silently makes the override a no-op and
  the résumé PDF iframe stops rendering.
- **`upgrade-insecure-requests` is conditional on `process.env.VERCEL`** (`:84`, rationale `:70-83`): unlike
  Chromium, WebKit obeys it on `localhost`, rewriting every sub-resource to `https://localhost:PORT` and
  breaking all client JS locally — which is what made the `mobile-safari` Playwright project fail before it
  was gated. Production's policy string is unchanged. `img-src` also allow-lists `https://img.shields.io`
  (`:53`, paired with `images.remotePatterns` at `:237-244`).

The docblock at `next.config.ts:19-20` still says the CSP is "shipped as Report-Only first"; the code at
`:136-146` (comment and header key) is the truth — enforced.

### Rate limiting

Three route classes, each with **its own** Upstash sliding window of 8 requests / 60 s per IP
(`REQUESTS_PER_WINDOW = 8`, `WINDOW = "60 s"`, `src/lib/rate-limit.ts:21-23`), prefixes `anvilry:chat` /
`anvilry:voice` / `anvilry:beacon` (`:25-29`), all built once at module load (`:33-48`, `analytics: false`
at `:42`). `checkRateLimit(req, cls)` **requires** the class (`:95-98`), so a route cannot silently share
another class's bucket. The key is the **raw** client IP, not the salted hash telemetry stores —
`x-vercel-forwarded-for`, else the LAST `x-forwarded-for` segment, else `x-real-ip`, else the literal
`anonymous` (`clientIp`, `:74-80`) — so requests carrying none of those headers all share one `anonymous`
bucket. Route → class: `/api/chat` → `chat` (`chat/route.ts:145`); `/api/tts`, `/api/tts-google`,
`/api/transcribe` → `voice` (`tts/route.ts:70`, `tts-google/route.ts:68`, `transcribe/route.ts:64`);
`/api/error` → `beacon` (`error/route.ts:102`). A burst of per-sentence TTS or error beacons therefore no
longer 429s the visitor's chat — but each class is still only an 8/min per-IP budget. All five call sites are
pinned by tests: `src/app/api/voice-rate-limit-class.test.ts` (the three voice routes charge `voice`,
`:35-46`), `src/app/api/chat/route.test.ts:131-137` (`chat`) and `src/app/api/error/route.test.ts:266-272`
(`beacon`); `src/lib/rate-limit.test.ts` pins the mechanics (`:121` one limiter per class with separate
prefixes, `:226-253` per-class isolation, `:255-` cron bypass).

It **fails open** on both paths: `{ ok: true }` when unconfigured (`:99`) and on any Upstash throw
(`:106-109`), with a production-only module-load warning as the sole signal (`:62-68`, which still names only
chat / tts / transcribe). `/api/visit` has its **own** limiter — `slidingWindow(1, "30 m")`, prefix
`anvilry:visit` (`api/visit/route.ts:39-46`) — and on denial returns the current total with `today: 0`
rather than a 429 (`:54-60`). The purge route has no limiter. The free read-only surface (the MCP endpoint, `/api/github/stats`, the
`.md` twins, the `/api/v1` routes and the discovery files) is counted by a separate, in-memory limiter in the
proxy, 300 requests per 60 s per IP and per server instance, which never touches Redis (subsystem 11); it is
not one of the three classes above.

### The sanitisation boundaries

| Boundary | What it enforces | Cite |
|---|---|---|
| **Inbound chat payload** | Declared `Content-Length` ≤ 2 MB (header only — no post-read backstop); 12 messages max, 600 chars per string block, image mediatype allowlist, `application/pdf` only, 10000-char cap on `"[PDF:"` text blocks, last message must be `user` | `src/app/api/chat/route.ts:27-28,163-166,177-261` |
| **Model output → card tokens** | Locked `[a-z0-9-]+` slug charset; resolution against the build-time Velite allowlist; unresolved tokens **dropped**, never echoed | `src/components/chat/parse-cards.ts:29-33,54-68`; gate `parse-cards.test.ts:40-75` |
| **Model output → markdown** | react-markdown vdom (never `dangerouslySetInnerHTML`) + `skipHtml` + default `urlTransform` + `rehype-sanitize` as defense-in-depth. Markdown **images are not stripped** — the component map has no `img` override and rehype-sanitize's default schema keeps `<img src="http(s)…">` — so the CSP `img-src` allowlist (`next.config.ts:53`) is the only barrier to a model-emitted image beacon. No test exercises this pipeline: `markdown-message.test.ts` covers only `closeOpenMarkdown` | `src/components/chat/markdown-message.tsx:9-16,47-84,88-95` |
| **Telemetry egress** | `redact()` on `message` and `stack` before `emit()`; salted 16-hex IP/UA hashes; transcript text, prompt text and the stored reasoning summary never emitted (a cache hit's event carries no reasoning text, only the boolean `reasoning_replayed`; a cache-error event cuts the Upstash `, command was:` echo and caps the message at 300 characters) | `src/lib/telemetry/schema.ts:88-111,129-136`; `api/error/route.ts:151-167`; `api/transcribe/route.ts:106-113`; `chat/route.ts:340-341`; `chat-cache.ts:225-227` |
| **External redirect** | `/articles/<slug>` redirects only after asserting an `https://` or `http://` prefix, else `notFound()` — the open-redirect guard | `src/app/articles/[slug]/page.tsx:78-84` |
| **JSON-LD** | `safeJsonLd` escapes every `<`, `>`, `&`, U+2028 and U+2029 as its `\uXXXX` JSON escape, because `JSON.stringify` leaves them and `</script>`, `<!--` and `<script` change how the HTML parser reads a block (the parsed object is identical) | `src/components/json-ld.tsx:5-28` |
| **Voice engine params** | `validateVoiceForEngine` rejects unknown ids, engine mismatches, and tier disagreements server-side; no `tier` field is accepted from the client | `src/lib/voice-catalog.ts:346-367`; `api/tts/route.ts:104-106`, `api/tts-google/route.ts:102-104` |
| **Analytics** | `commandEventName` returns the registered command word or the literal `"unknown"` — never raw input or args | `src/components/game/terminal/commands.ts:755-758` |
| **FAQ cache write and read** | Only a clean `end_turn` completion from the primary rung is cached (a `fell_back` answer never is), after control-byte stripping and a 1–4000-character bound; first-turn string questions only; 24 h TTL; entries are tagged with the id of the deployment that wrote them (`chat-cache.ts:193-195`), so another deployment's answers are never served and a cold start or a new instance changes nothing; only a host with no deployment id falls back to the corpus stamp, which `src/instrumentation.ts:98` rewrites on every production process start. It checks completion *cleanliness*, not content safety — a jailbreak that finishes cleanly would be cached, which is why the purge route exists. The reasoning summary is stored beside the answer, stripped of control bytes like the answer, trimmed and bounded to 1–4000 characters (`MAX_CACHEABLE_REASONING_CHARS`), and only when the normalized question is at most 200 characters (`MAX_REASONING_QUESTION_CHARS`), because the summary of a long question is the likeliest to carry what the visitor typed; an unusable summary is dropped and the answer is still cached. The summary is normalized again on an exact-tier read (same strip, trim and bound), re-stripped and trimmed once more in the route before it is replayed, and removed from a semantic hit | `src/lib/chat-cache.ts:23-55,68,84,90,96,173-185,281,329,347-365,371-373`; `chat/route.ts:288-298,313-318` |

### Failure modes

| Failure | Mechanism |
|---|---|
| `/admin` open | Both `src/proxy.ts` not executing (matcher edited, file moved) **and** the page's own re-check removed (`admin/telemetry/page.tsx:470`). Either alone still denies; with only the page check, an unauthorised request gets a `404`, not a `401` challenge. |
| A new `/api/admin/*` route is open | The proxy does not gate it: only `/admin/*` is gated (`proxy.ts:173-182`), and the `/api/:path*` matcher entry (`:44`) wakes the proxy for it, which then passes the request on (`classifyPath` passes `/api/` through untouched); only an explicit `requireAdmin(req)` (as at `purge/route.ts:33`) protects it, and no test or lint rule catches a missing call. |
| `/admin` locked out entirely | `ADMIN_PASSWORD` unset — deliberate (`admin-auth.ts:26-31`); the client sees a bare 401 challenge, the server logs `[admin-auth]`. |
| All five crons 401 | `CRON_SECRET` unset — deliberate fail-closed (`cron-auth.ts:11-12`). Nothing then refreshes the health result, whose Redis key `anvilry:health:latest` expires 90,000 s (25 h) after the last run that reached the write (`health-check/route.ts:220-221`), so the dashboard's "Site health" tile falls back to its "run /api/cron/health-check to populate" placeholder (`admin/telemetry/page.tsx:829-842`) about a day later. |
| Eval cron self-throttles | The `CRON_SECRET` bearer removed from the eval cron's `/api/chat` calls (`eval/route.ts:124-126`), or `hasValidCronSecret` dropped from `checkRateLimit` (`rate-limit.ts:100`) — 12 sequential chats then hit the 8/min chat bucket. Both halves are pinned (`eval/route.test.ts`: the bearer on all 12 calls; `rate-limit.test.ts:255-`: the bypass). A separate budget risk remains: each call is bounded by `AbortSignal.timeout(25_000)` (`eval/route.ts:131`) inside `maxDuration = 60` (`:5`), so a slow chain can outlive the function before the Redis write (`:176`). |
| Wrong bucket charged | A route calling `checkRateLimit` with the wrong class — TypeScript demands *a* class but cannot tell which is right. The five existing call sites are each pinned by a test (voice ×3 in `voice-rate-limit-class.test.ts`; `chat` in `chat/route.test.ts:131-137`; `beacon` in `error/route.test.ts:266-272`); a **new** route is pinned by nothing. |
| Every MDX page crashes | `'unsafe-eval'` removed from `script-src`. |
| Voice permanently broken in production | The Chrome speech WebSocket host removed from `connect-src`. |
| Résumé PDF iframe blank | The `frame-ancestors` string replace no longer matching `next.config.ts:41`. |
| Local WebKit runs no client JS | `upgrade-insecure-requests` made unconditional (`next.config.ts:84`). |
| Unbounded AWS spend | Rate limiting fails open in both failure modes; `/api/chat` is the cost-bearing endpoint. `x-chat-skip-cache` is a presence-only header any client can send to bypass the FAQ cache (`chat/route.ts:288`) — it forfeits the saving for that request but is still limited; the one exception is a request carrying the valid `CRON_SECRET` bearer, which skips the limiter altogether (`rate-limit.ts:100`). |
| A bad answer replayed for up to 24 h | A jailbreak that finishes with `end_turn` passes the FAQ write gate (`chat-cache.ts:361`); remediate with the purge route, which drops the entry's stored reasoning summary with it (model text that can quote the question, replayed only on an exact-tier hit). |
| `/admin/*` crawled | `src/app/robots.ts:3-17` is allow-all (`userAgent: "*"`, `allow: "/"`) with **no** `disallow` entries; the protection is the Proxy, not robots. |

### Flags / env that alter it

`ADMIN_PASSWORD`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`/`_TOKEN` (whether rate limiting and the FAQ cache
exist at all), `FAQ_CACHE_ENABLED` (kill switch, default on, `chat-cache.ts:159-161`) and
`FAQ_CACHE_SEMANTIC_MATCH` (embedding tier, default off, `chat-cache.ts:151-152`), `VERCEL_DEPLOYMENT_ID` (the cache's corpus tag, `chat-cache.ts:194`), `TELEMETRY_IP_SALT`,
`TELEMETRY_ENABLED` (honoured by `/api/error` only, `error/route.ts:93`), `FLAGS_SECRET` (what
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
src/app/layout.tsx:87-91  RootLayout awaits it server-side (the await is :90)
  ▼
threaded as a PROP into <Providers discoveryBadgesEnabled>       layout.tsx:138
                    and into <CommandPalette discoveryBadgesEnabled>   layout.tsx:149
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
| `NEXT_PUBLIC_ARTICLES_ENABLED` | `ARTICLES_ENABLED` | **true** | `!== "false"` (the only opt-out) `:19-20` | `/articles` subtree via `articles/layout.tsx:12`; nav link (`site-nav.tsx:45`); sitemap (`sitemap.ts:71`); `WritingPreview` (`home/writing-preview.tsx:8-12`, through `homeArticleGroups`, `src/lib/home-articles.ts:14-17`, which the homepage JSON-LD list and the homepage Markdown twin read too) |
| `NEXT_PUBLIC_NOTES_ENABLED` | `NOTES_ENABLED` | false | `=== "true"` `:22` | **The data layer:** `allNotes` is `[]` while off (`lib/content.ts:66`), so llms.txt, the RSS feed, the MCP tools, the chat corpus and both `.md` handler sets publish no notes, and articles whose only destination is a note are dropped (`content.ts:92`). Route layer: `/notes` via `notes/page.tsx:21`; `/notes/[slug]` via `notFound()` at `notes/[slug]/page.tsx:52` (its `generateStaticParams` still prerenders every *published* slug as a 404, `:16-26`); article `linkedNote` redirects (`articles/[slug]/page.tsx:74`); nav (`site-nav.tsx:48`); sitemap (`sitemap.ts:44`). The `linkedNote` → `/notes/<slug>` link is chosen only while the flag is on in `article-href.ts:19` (shared by the card, the homepage JSON-LD list and the homepage twin), `related-writing.tsx:13`, `articles/page.tsx:199,272` and `llms-txt.ts:49` (otherwise the entry uses `externalUrl`). Two older per-surface filters for note-only articles remain (`sitemap.ts:67-69`, `articles/[slug]/page.tsx:44`, with a matching guard at `:87-89`) and are now subsumed by `allArticles`. Pinned by `src/lib/notes-dark.test.ts` |
| `NEXT_PUBLIC_OPEN_TO_WORK` | `OPEN_TO_WORK` | false | `:24` | `OpenToWorkBanner`, gated in the caller (`layout.tsx:140`); the chat and developer views also subtract the banner's height (`OPEN_TO_WORK_BANNER_HEIGHT_REM`, `:34`) from their exact-height `<main>` (`chat-view.tsx:79-81`, `developer-view.tsx:39-41`) |
| `NEXT_PUBLIC_STATS_ENABLED` | `STATS_ENABLED` | false | `:38` | **Nav + sitemap only** (`site-nav.tsx:53`, `sitemap.ts:90`) — `/stats` still renders and prerenders |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `SEARCH_ENABLED` | false | `:40` | **Nav + sitemap only** (`site-nav.tsx:54`, `sitemap.ts:100`) — same as `/stats` |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `TESTIMONIALS_ENABLED` | false | `:44-45` | `home/testimonials.tsx:13` — the only gate; with the flag on and an empty `testimonials` array it renders a "recommendations coming soon" card (`:15-36`). (`hasTestimonials` is consumed by the chat corpus, `corpus.ts:69`, not by this component.) |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `INKFORGE_ARTICLES_ENABLED` | false | `:49-50` | `articles/page.tsx:44` (`visibleInkforge`) |
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `GITHUB_STATS_ENABLED` | false | `:54-55` | `GithubStatsStrip` on `/`, mounted from `home/hero.tsx:169-175` |
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
| `NEXT_PUBLIC_404_ORB` | `not-found.tsx:46` (module scope) | distressed orb on the 404 page |
| `NEXT_PUBLIC_VISITOR_COUNTER` | `site-footer.tsx:119` | footer visitor badge (client-side gate only; `/api/visit` has no flag check, `api/visit/route.ts:15-17`) |
| `NEXT_PUBLIC_RESUME_VARIANTS` | `resume/page.tsx:29`, `home/resume-view.tsx:46`, `command-palette-content.tsx:365`, `game/terminal/commands.ts:297` | all `resumeVariants` vs only `resumeVariants[0]` — **currently a no-op**: `resumeVariants` (`src/lib/profile.ts:139-145`) has exactly one entry, so both branches yield the single master PDF. `developer-rail.tsx:45` is not gated at all; it maps the same one-entry list. |
| `NEXT_PUBLIC_HERO_MODE` | `home/hero.tsx:26` (branched `:33-39`), re-checked `hero-avatar/index.tsx:50` | `"avatar"` → `HeroAvatar`; `"mascot"` → `HeroMascotBackdrop` + in-flow `HeroMascot` (`home/hero-mascot.tsx`); else `HeroGraph` |
| `NEXT_PUBLIC_AVATAR_POSITION` | `hero-avatar/index.tsx:51` | `hero-side` (default) \| `hero-split` \| `hero-top`; unknown values fall through to `hero-top` |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | `hero-graph/index.tsx:10` (**module scope**) | `./scene-physics` vs `./scene` |
| `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` | `chat-view.tsx:259` | the file picker |
| `NEXT_PUBLIC_PDF_ATTACHMENTS` | `file-picker-button.tsx:7` | `application/pdf` in the accept list |
| `NEXT_PUBLIC_EXTENDED_THINKING` | `chat-messages.tsx:165` | the thinking block (`!== "false"`, default ON); a replayed FAQ-cache hit arrives in one piece, so the measured duration is 0 s and the collapsed toggle reads "Thought for a moment" (`:260`) |
| `NEXT_PUBLIC_LLM_SDK` | `llm-sdk-mode.ts:26` | **nothing** — `llm-sdk-mode.ts` has zero importers (only its test); the `aws-sdk-bedrock` branch is unbuilt (`:13-15`) |
| `NEXT_PUBLIC_BUILD_YEAR` | written `next.config.ts:159`, read `site-footer.tsx:240` | the footer copyright year (an in-render `new Date()` fails the prerender under `cacheComponents`) — a constant, not a flag |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | `flags.ts:58,65` | the ★ N/4 badge — the one flag on Mechanism B |

**Server-side, non-prefixed**

`EXTENDED_THINKING` (`api/chat/route.ts:287`, default ON) is the server half of the pair whose client half is
`NEXT_PUBLIC_EXTENDED_THINKING` above — one decides whether the model is asked to think (and whether an exact-tier FAQ-cache hit replays its stored reasoning summary, `api/chat/route.ts:313-318`), the other whether the
block renders, and they are independent; `LLM_USE_SONNET_5` (`llm.ts:45-47`, default OFF — swaps the primary
rung of both model chains to Sonnet 5); `LLM_USE_SONNET_5_5` (default OFF, the same swap to Sonnet 5.5, which wins over it); `LLM_USE_OPUS_FALLBACK` (`llm.ts:75-77`, default OFF — puts Opus 4.6 back as a rung behind the primary); `LLM_THINKING_EFFORT` (`llm.ts:182-189`, exactly one of `low`, `medium`, `high`, `xhigh`, `max`, with `xhigh` sent as `max` off Sonnet 5.x; unset → `medium` on Sonnet 5.x, `low` elsewhere); `FAQ_CACHE_ENABLED` (default ON) and `FAQ_CACHE_SEMANTIC_MATCH`
(default OFF) (`chat-cache.ts:151-161`); `TELEMETRY_ENABLED` (`api/error/route.ts:93`); `FLAG_DRIVER`, `FLAGS`,
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
| Notes leak on one surface while dark | Reading `publishedNotes` (raw) instead of `allNotes` on a public surface — only the `/notes` route files may (`content.ts:57-59`), because `cacheComponents` needs `generateStaticParams` to return ≥1 slug even while the section is dark. `notes-dark.test.ts` guards llms.txt, the feed, MCP, the corpus and both `.md` handlers. |
| `vi.stubEnv` stops working in tests | Hoisting a flag read from inside a function body to module scope. Deliberately inside the body at `resume/page.tsx:28-29`, `home/resume-view.tsx:45-47`, `command-palette-content.tsx:363-366`, `commands.ts:296-299`, `hero.tsx:25-26`, `hero-avatar/index.tsx:49-51`. |
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
  chat/voice-orb.tsx:13-16     → ./voice-orb-3d        (app/not-found.tsx:30-33 imports the same module)
        ▼
ERROR CONTAINMENT
  <WebGLBoundary> wraps: hero-graph/index.tsx:79 · hero-avatar/index.tsx:59 · build-graph.tsx:60 ·
                         voice-orb.tsx:46 · not-found.tsx:66
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
            next.config.ts:201: "The src/lib/r3f.ts barrel stays — it is load-bearing for the single-copy outcome"
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
| 3 | `src/components/home/hero.tsx:26,30` | The sole mount point for both hero slots. |
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
(`hero-graph/index.tsx:68`, `hero-avatar/index.tsx:68,88,104`, `voice-orb-3d.tsx:304`, `not-found.tsx:65`) and
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
| Chunk dedup | the `src/lib/r3f.ts` barrel; `three`/`fiber`/`drei` deliberately **excluded** from `optimizePackageImports` (which is `["lucide-react","motion"]`) | `next.config.ts:178-183,198-202` |
| Recorded chunk measurement | 16.2.9: 2036 KB / 5 chunks (two 876 KB copies) → 16.3.0: 1160 KB / 4 chunks (one copy), −876 KB | `next.config.ts:185-196` |
| Live perf contract | exactly 1 three.js copy (`grep -l WebGLRenderer \| wc -l` must be 1 — the `react-three` grep returns 5 and is **not** the copy count), 1248 KB across R3F chunks, 113/113 static pages — recorded on 2026-08-15 (post-#121/#123/#124, before the 3.6.0 cut) and **not re-measured** for a929932 (no build was made for this index) | `domains/performance/README.md:85-91` |
| Enforced in CI | the same `WebGLRenderer` marker, asserted mechanically: the chunk carrying it (897,249 B per the script's comment) must appear in **zero** routes' first-load sets, and no route may exceed `MAX_FIRST_LOAD_BYTES = 988_000`. Runs on the `e2e` job's existing build, reading `.next/diagnostics/route-bundle-stats.json` | `scripts/bundle-budget.mjs:72,76-83,84,158-166`; step at `.github/workflows/ci.yml:190-191`; § 10 The bundle budget gate |
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
| View transitions | JS snap branch (`view-context.tsx:105-117`) **and** a CSS `animation: none !important` kill switch (`globals.css:424-430`) |
| Global CSS | **Ten** separate `@media (prefers-reduced-motion: reduce)` blocks in `globals.css` (`:107,124,131,139,208,319,396,418,449,483`); the orb block deliberately keeps `blur(1.4px) contrast(4.5)` because dropping the filter shatters the metaballs (`:208-218`) |
| Skill tree | Injects an **unscoped** global `* { animation: none !important; transition: none !important }` from inside the SVG (`skill-tree.tsx:664-666`) |

### Failure modes

| Failure | Mechanism |
|---|---|
| Two live WebGL contexts on low-end mobile | Dropping the `view === "classic"` term from the hero gates (`hero-graph/index.tsx:64`; the rationale is stated at `:26-29`), or changing the gamified branch in `view-router.tsx` from unmount to `hidden`. |
| Uncatchable crash on a GL-less client | Relying on `WebGLBoundary` alone: R3F surfaces context-creation failure as an async unhandled rejection (`use-media-query.ts:21-26`). `hero-avatar/index.tsx` neither probes nor passes `onFail` (the graph, build graph and voice orb do both), and the 404 orb wraps a boundary with no probe (`not-found.tsx:64-74`). |
| Demand loop becomes a perpetual loop | Removing the `> 0.0006` invalidate threshold (`scene.tsx:106`). Note the avatar's demand loop already never settles: `useAvatarIdle` invalidates unconditionally (`use-avatar-idle.ts:27`). |
| Avatar freezes between mouse moves | Removing `useAvatarIdle`'s `invalidate()` — it is one of only two wake sources on the avatar's demand loop (`avatar-scene.tsx:22`, `avatar-controls.tsx`). |
| Twin three.js chunks return (−876 KB lost) | Deleting `src/lib/r3f.ts`, or re-adding `three`/`@react-three/*` to `optimizePackageImports` (`next.config.ts:198-202`). **Still unguarded by CI:** `scripts/bundle-budget.mjs` asserts three.js stays *off the first-load critical path*, not that only one copy exists — two lazy copies change no route's first-load bytes and pass the gate. The barrel is the only defence. |
| three.js dragged onto the first-load critical path (+876 KB on every route) | An eager `import * as THREE` (or an R3F import outside a `next/dynamic(..., { ssr: false })` boundary) in anything a route renders on first load. **This one is guarded:** the `Bundle budget` step fails the `e2e` job, naming the offending chunks (`scripts/bundle-budget.mjs:158-166`, step at `ci.yml:190-191`). |
| Node unit tests fail `ECONNREFUSED` | Importing `avatar-mesh.tsx` from a node test — `useGLTF.preload` at module scope (`avatar-mesh.tsx:10`) fires a real fetch. This is why `resolveRig` lives in `rig.ts` (`rig.ts:19-22`). |
| Avatar loads but never moves | Renaming a bone: `resolveRig` matches lowercased substrings `head`/`neck`/`chest`\|`spine1`/`spine`-not-`spine1` (`rig.ts:43-52`). No error anywhere. Pinned by `avatar-glb.test.ts:98-130`. |
| Eye gaze silently inert (**current state**) | `rig.morph` requires a `SkinnedMesh` whose name contains `"head"` **and** has a `morphTargetDictionary` (`rig.ts:57-63`). `sairam.glb` is an Avaturn export (`avaturn_body`, `avaturn_hair_0`, …) with **zero** morph targets, so all 8 ARKit `setMorph()` calls (`avatar-mesh.tsx:102-109`) are skipped. Asserted deliberately at `avatar-glb.test.ts:132-157`; shipping a blendshape avatar requires flipping `:148` to `toBeGreaterThan(0)` or the build fails. (`avatar-mesh.tsx:13` still calls it a "ReadyPlayerMe GLB".) |
| Uncatchable unhandled rejection offline | drei/troika `<Text>` without a local `font` prop fetches font metadata from `cdn.jsdelivr.net` — which is why the 3D hover label is commented out (`build-graph-scene.tsx:100-120`) while `Node` still takes an unused `label` prop (`:51,:59`). |
| Skill tree throws at render | `skills.find(s => s.group === groupName)!` is a non-null assertion against six hardcoded group names (`skill-tree.tsx:61-62,169`); renaming a group in `src/lib/profile.ts:75-125` throws. |
| Build fails on an avatar re-export | Re-exporting without meshopt/quantization, or with PNG/JPEG textures, or above 1.5 MB — `avatar-glb.test.ts` runs inside `pnpm build` (`:58-96`). |
| Wrong scene named in the console | `WebGLBoundary` hardcodes a `[build-graph]` prefix (`webgl-boundary.tsx:25`) even when the failing surface is the hero graph, the hero avatar, the voice orb, or the 404 orb. |
| Nodes clip out of frustum | `graph-data.ts:75` records the budget: camera z=7, fov=45 ⇒ visible half-height ≈ 2.9 / SCALE 1.6 ≈ 1.8 units. |

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
   job `e2e`  : pnpm install → scripts/ci-install-playwright.sh (playwright install --with-deps chromium webkit;
                             3 attempts of 240 s, apt/dpkg stopped and repaired between attempts) → pnpm build
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
  + deploy-smoke.yml (vercel.deployment.ready dispatch -> scripts/post-deploy-smoke.mjs; reports the `Post-deploy smoke` commit status;
                     when the smoke step did not succeed (it failed, or it was skipped after an earlier step failed) it also opens one issue per held commit via scripts/deploy-gate-alert.mjs (dedupe is best effort: newest 100 open items), in
                     best-effort steps before the guard step, run in Actions only through two controlled dispatches on 2026-10-22; DEPLOY.md section 8)
  every third-party `uses:` in all six workflows is SHA-pinned with a `# vX` comment; Dependabot's github-actions
  ecosystem moves the pins (.github/dependabot.yml:103-116)
        │
        ▼  PR: feature → develop  (make pr)      Vercel PREVIEW deploy
        ▼  PR: develop → main    (make pr-prod)  Vercel PRODUCTION deploy
VERCEL BUILD
  pnpm build  =  velite --clean  &&  vitest run  &&  next build  &&  node scripts/build-search-index.mjs
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
  make search-index → node scripts/build-search-index.mjs   (needs a finished `next build`, in either output layout)
                      (Makefile:65-66 — "without a full rebuild"; public/pagefind/ is gitignored, .gitignore:50)
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `package.json:5-7,9-21` | **13** scripts. `predev` = bare `velite` (`:9`); `dev` = plain `next dev` (`:10`); `build` = the four-step chain (`:11`); `analyze` (`:12`); `seal-claims` (`:18`); `clean` deletes `.next .turbo node_modules/.cache .velite` (`:19`). `engines.node` is `">=22 <23"` (`:5-7`), matching `.nvmrc` (`22`). |
| 2 | `velite.config.ts` | Content compile step 1; `output.clean: false` by default (`:179`), the `build`/`content` scripts pass `--clean` explicitly. |
| 3 | `vitest.config.ts:17,26-54` | Two projects (`node` / `dom`); `resolve.tsconfigPaths`; `env: { NODE_ENV: "test" }`; `testTimeout: 30_000` and `hookTimeout: 60_000` for both projects (`:32-33`), because the Vercel build runs the whole suite in parallel on a loaded container and the first test of a DOM file cold-imports a large module graph; they only bound a hang. The `dom` project also loads `tests/setup/dom-async-timeout.ts` (`setupFiles`, `:50-51`), which raises Testing Library's `waitFor` limit from 1 s to 10 s for the same reason. The `tests/**` globs are live (`tests/cli/**` runs in the `node` project). 185 test files (132 node + 53 dom; 170 under `src/`, 15 under `tests/cli/`), 2734 tests: 2732 pass and 2 are skipped (the two `skipIf(CLI.published)` release-step rehearsals in `tests/cli/readme.test.ts`; 2733 and 1 before the CLI-published flip), at this tree (vitest 5.0.5; 149 files and 1955 tests before round 3, 131 files and 1572 tests at v3.17.0, 115 files and 1356 tests before the agent-readiness change, 130 files and 1566 tests before the search-index script's own test file). |
| 4 | `next.config.ts` | Headers/CSP, `cacheComponents`, `inlineCss`, Turbopack root pin, the `.md` rewrites (the four content kinds and the ten page twins), the developer-URL `redirects()`, `NEXT_PUBLIC_BUILD_YEAR`, the dev-only Velite watcher, `withBundleAnalyzer` (`:5-7` — still wrapping, but now reachable only through `pnpm analyze`; see § The bundle budget gate). |
| 5 | `scripts/build-search-index.mjs` + `src/lib/build-search-index.test.ts` | Build step 4, the Pagefind index (`package.json:11`; alone via `make search-index`, `Makefile:65-66`). `resolveSearchSource` (`scripts/build-search-index.mjs:47-77`) picks the classic `.next/server/app` tree when it holds any `.html`, otherwise stages the adapter layout `.next/server/route-cache/APP_PAGE/<hash>/$/` into `.next/search-site` under URL paths, and throws when neither has a page; `main` (`:79-91`) then runs `pagefind --site <that dir> --output-path public/pagefind` and exits with its status. Exports `SERVER_DIR`, `STAGE_DIR`, `OUTPUT_PATH`, `listHtml` and `resolveSearchSource` (`:22-24,27,47`). Six tests (`src/lib/build-search-index.test.ts:26-85`: five on `resolveSearchSource`, one on `listHtml`) build both layouts by hand and run inside `pnpm build`'s `vitest run`. |
| 6 | `.github/workflows/ci.yml` | The merge gate: five jobs (above). `pnpm/action-setup` is pinned to `ea17c68…` (v6.1.0) in four jobs; `ci`, `e2e` and the opt-in job use `version: 10`, `install-pnpm-11` uses `version: 11` (`:24,:108,:155,:230`). Also carries the `Bundle budget` step (`:190-191`). |
| 7 | `scripts/bundle-budget.mjs` | The bundle gate that replaced `bundle-analysis.yml`. Reads `.next/diagnostics/route-bundle-stats.json` (`:37`); asserts a per-route first-load ceiling (`:72`), a route-count floor (`:40`), and that three.js stays off the first-load critical path (marker `:84`, checked at `:158-166`) and compiled MDX bodies do too (marker `:96`, checked at `:168-177`). Exits 1 when the artifact is unreadable (`:107-111`) or its shape has changed (`:114-125`). |
| 8 | `playwright.config.ts:15-24,37-44` | **Two** projects — `chromium` (Desktop Chrome) and `mobile-safari` (iPhone 13, which launches webkit); `baseURL http://localhost:3000` (`:11`); `retries: 2` and `workers: 1` in CI (`:7-8`); `webServer.command = "pnpm start"`, `reuseExistingServer: !CI` (`:37-44`). |
| 9 | `vercel.json:3-7` | The five cron schedules — the file's only key. |
| 10 | `Makefile` | 36 targets, all `.PHONY`, `.DEFAULT_GOAL := help` (`:9`): `pr`/`pr-prod`, `deploy-preview`/`deploy-prod`/`rollback`, `logs`/`logs-llm`/`logs-flags`, `trace`, `health`, `admin`, `env-check`/`env-setup`/`env-vercel`, `flags-show`, four `new-*` scaffolds, `search-index`. |
| 11 | `.github/dependabot.yml` | Two ecosystems (`npm`, `github-actions`), weekly Monday 09:00 America/Chicago, `target-branch: develop`. The `npm` block has five version-update groups (first-match-wins ordering, `:14-16`) plus a `security-patches` group with `applies-to: security-updates` (`:68-71`), and 3 `ignore` rules (`@react-three/postprocessing` `3.0.5`, `typescript` major, `eslint` major, `:82-101`). |
| 12 | `pnpm-workspace.yaml:18-47,52-57,60-87` + `pnpm-lock.yaml:7-26` | The **14** security `overrides` (`:18-47`; `proxy-addr` and `source-map-js` at `:40-41` are the two the dependency security batch added to the earlier twelve), the `@react-three/fiber@9.7.0` patch (`:52-57`, `patches/@react-three__fiber@9.7.0.patch`), and the build-script allowlist (`allowBuilds` `:84-87`; legacy `onlyBuiltDependencies` / `ignoredBuiltDependencies` `:73-79`). **No longer in `package.json`** — the whole `pnpm` field moved to `pnpm-workspace.yaml` in v3.5.0 because pnpm 11 stopped reading that field, which had silently disarmed the v3.4.2 overrides on any pnpm-11 install (rationale at `:1-12`). |
| 13 | `scripts/seal-claims.ts` + `data/integrity-chain.json` + `src/lib/claims-integrity.ts` | The Claims Integrity Ledger: verify mode (the `ci` job's last step) fails if `impactMetrics` / `achievements` in `profile.ts` no longer match the chain head or the chain's own linkage is broken; `--write` appends a new sealed entry. Unit-tested by `claims-integrity.test.ts`, which does run inside `pnpm build`. |
| 14 | `.github/workflows/deploy-smoke.yml` + `scripts/post-deploy-smoke.mjs` + `scripts/deploy-gate-alert.mjs` | The production gate, which sits AFTER the build: on Vercel's `vercel.deployment.ready` dispatch (built, not yet promoted) the workflow validates the payload, checks out and runs the smoke script (30 GET checks: the 20 of the first gated deployment, six from the agent-readiness change, for `/developers`, `/contact`, `/privacy`, `/openapi.json`, the homepage requested with `Accept: text/markdown` and an unknown `/api` path that must be a JSON 404, and four from the API-policy change, for `/api/v1` with its `API-Version` and `RateLimit` headers, an unknown v1 item that must be a typed JSON 404, the API catalog and `/about.md`) against that exact deployment, and reports the `Post-deploy smoke` commit status that a Vercel Deployment Check requires before the production domain is assigned (`.github/workflows/deploy-smoke.yml:3-29`). Both scripts decide whether they are the program being run by comparing real paths (`scripts/post-deploy-smoke.mjs:506`, `scripts/deploy-gate-alert.mjs:194-202`): a raw `argv[1]` comparison made the smoke script exit 0 without running a single check when started behind a symlink, a false green, and `src/lib/deploy-smoke.test.ts` (42 tests, 628 lines) now starts it by its real path and through a symlink and expects the usage error, exit 2. When the smoke step of a dispatch run does not succeed (it failed, or it was skipped because an earlier step such as payload validation failed), two best-effort steps (`continue-on-error: true`, added after v3.16.0) tell a human: "Checkout the alert script (default branch)" (2 minutes) sparse-checks-out `scripts/deploy-gate-alert.mjs` from the run's own `github.sha` (the default branch, never the commit under test) and "Open an issue because the gate is holding a deployment" (1 minute) runs it (`.github/workflows/deploy-smoke.yml:142-165`). It opens one GitHub issue per held commit, titled `Production deployment held: smoke failed for <7-char sha>` (or `an unknown commit` when the dispatch had no valid sha), and its Smoke result line says failure, cancelled or skipped. Dedupe is best effort: it lists the newest 100 open items (the issues API also returns pull requests, which count toward the 100 and are then ignored) and skips creating when an open ISSUE with that title opened by `github-actions[bot]` is among them, so a same-title issue opened by anyone else cannot silence the alert, and a closed issue never dedupes; a match outside that window, or a create that was retried after its first attempt had already succeeded, can leave a duplicate (`scripts/deploy-gate-alert.mjs:148-169`). One retry after a network error, a 5xx or a 429; an error carries GitHub's own message but never the token, which goes only to api.github.com, and any API error exits 1. Every payload value is validated first (40-hex sha, `*.vercel.app` host, github.com Actions run URL, known outcome) and an invalid value is dropped, never echoed. It runs whenever the smoke step did not succeed, not only after a failed smoke; a deployment held because no status ever arrives is NOT announced (a watchdog was considered and not built), and closing the issue is manual. Both alert steps sit BEFORE the last step, a guard that fails the job unless the smoke succeeded (`.github/workflows/deploy-smoke.yml:167-175`), so a broken alert can neither hide a failed smoke nor turn it into a pass. Every step has its own `timeout-minutes` (18 minutes summed against the job's 20, `:80-83`), nothing cancels a run (`:70-73`), and the job permissions are `contents: read`, `statuses: write`, `actions: read` and `issues: write` (`:84-88`). **The alert steps have run in Actions only through two controlled dispatches** on 2026-10-22 (invalid payload, smoke skipped; runs 39821938807 and 39822149872: issue #342 was opened once, the second run was deduplicated, and #342 was closed by hand). They are also covered by `src/lib/deploy-gate-alert.test.ts` (36 tests, 373 lines) against a mocked GitHub API, plus checks on the workflow text, and that file runs inside `pnpm build`. |

### Entry point

`git push` (CI runs on `branches: ["**"]`), a PR into `develop` or `main`, or a manual
`make deploy-preview` / `make deploy-prod`.

### Exit point

A Vercel Preview URL (from `develop`) or the production deployment (from `main`) whose build also emits
`public/pagefind/`, plus five live cron schedules and a `[config]` cold-start log line per server process.

### Tests as a gate — what that actually means

`pnpm build` is `velite --clean && vitest run && next build && node scripts/build-search-index.mjs` (`package.json:11`). The `&&` chain
is the gate: a failing Vitest assertion aborts before `next build`, so every one of the 185 test files
(2734 tests, two skipped) is a deploy blocker on the Vercel build path. That build runs Vitest with the flag on (its environment has `NEXT_PUBLIC_NOTES_ENABLED=true`: observed, not in the repository; see 10 UNVERIFIED), whereas GitHub CI leaves it unset, so a test that assumes the default flags passes in CI and can fail the Vercel build; five tests in four suites did, and four suites now pin the flag themselves (10 § `src/lib/notes-dark.test.ts`). Concretely, these invariants block a deploy:

- graph↔content bijection — `src/lib/game-model.test.ts:22-58`
- the decisions ledger ↔ content coverage and anti-fabrication gate — `src/lib/decisions.test.ts`
- the 1.5 MB avatar budget + compression/rig assertions — `src/lib/avatar-glb.test.ts:21,58-130`
- snake_case Anthropic usage keys — `src/lib/llm.test.ts:308-318`
- card-token fail-closed behaviour — `src/components/chat/parse-cards.test.ts:40-75`
- redact-before-emit — `src/app/api/error/route.test.ts:293-332`
- the auth surface — `src/proxy.test.ts`, `src/lib/admin-auth.test.ts`, `src/app/admin/telemetry/page.test.tsx`,
  `src/lib/cron-auth.test.ts`, `src/app/api/cron/cron-auth.routes.test.ts`,
  `src/app/api/admin/faq-cache/purge/route.test.ts`
- per-class rate limiting and the eval bypass — `src/lib/rate-limit.test.ts` (mechanics), the route-to-class
  pins in `src/app/api/voice-rate-limit-class.test.ts`, `src/app/api/chat/route.test.ts` and
  `src/app/api/error/route.test.ts`, and `src/app/api/cron/eval/route.test.ts` (bearer on all 12 chat calls)
- notes dark on every public surface — `src/lib/notes-dark.test.ts`
- MCP tool table documented — `src/app/mcp/tools-documented.test.ts`
- the batch endpoint and the MCP protocol — `src/lib/batch.test.ts`, `src/lib/batch-run.test.ts`, `src/app/api/v1/batch/*.test.ts`,
  `src/app/api/mcp/[transport]/route.test.ts` and `route-protocol.test.ts` (validation, the in-process run, both caps, the typed
  parameters, the JSON-RPC error codes)
- JSON-LD safety and parity — `src/components/json-ld.dom.test.tsx` (escaping), `json-ld-lists.dom.test.tsx`,
  `json-ld-articles.dom.test.tsx`, `json-ld-parity.dom.test.tsx`, `json-ld-api.dom.test.tsx`
- the CLI package and the site's wording about it — `src/lib/developer-tools.test.ts` (`CLI.published` pinned to `true` by the release gate, the
  command list equal to `cli/lib/commands.mjs`) and `tests/cli/**` (15 files, 279 tests)
- last-XFF-segment IP derivation — `src/lib/telemetry/with-trace.test.ts:220-230`, and, across **all
  four** `clientIp` copies, `src/lib/client-ip-consistency.test.ts` (`:26-31` the enumerated copies —
  `rate-limit.ts`, `telemetry/with-trace.ts`, `api/visit/route.ts` and, since the API-policy change,
  `public-api-limit.ts`; `:102` a discovery check that fails if a fifth copy appears unguarded; `:141`
  "takes the LAST x-forwarded-for segment, never the first"). `api/visit/route.ts` takes `xff.split(",").pop()!.trim()` (`:34`).
- SSR-is-always-Classic — `src/components/view-context.test.ts:30-35`
- two tests read `node_modules` rather than source, so a dependency bump can red a production deploy:
  `src/lib/pnpm-build-allowlist-consistency.test.ts` (every dependency with an install script must have an
  `allowBuilds` decision) and `src/lib/health-expectations.test.ts:160-185` (pins the installed `mcp-handler`
  version and asserts its GET branch is still unconditional)
- the production gate's alert and shape — `src/lib/deploy-gate-alert.test.ts` (36 tests: 28 on `scripts/deploy-gate-alert.mjs`, 8 that
  read `.github/workflows/deploy-smoke.yml` as text: guard step last, every step bounded with the sum below the job limit,
  no `cancel-in-progress: true`, one concurrency group per environment and commit, alert steps best effort and before the guard,
  alert script from the default branch, least-privilege permissions). A careless edit of `deploy-smoke.yml` reds the **build**, not only a CI job
- the search-index layout resolver — `src/lib/build-search-index.test.ts:26-85` (6 tests that build both Next output layouts by hand: the classic `app` tree, the adapter `route-cache` tree staged under URL paths, the classic tree preferred when both exist, the first copy kept for a duplicated URL path, a throw when neither layout holds a page, and `listHtml`). A red test here stops the build before an empty or wrongly staged index could be published

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

When it was deleted no status check was required on `develop` or `main` (a live GitHub read: an active repository ruleset required PRs and blocked deletion and force-push but had no `required_status_checks` rule; one was added on 2026-10-22 — see the Resolved ledger), so no required check disappeared with it.

**What the replacement measures.** `next build` writes `.next/diagnostics/route-bundle-stats.json` with no
flag and no second build — but **only** under Turbopack (`node_modules/next/dist/build/index.js:2922-2923`
gates `writeRouteBundleStats` on `bundler === Bundler.Turbopack`). So it describes exactly what ships.
Records are `{ route, firstLoadUncompressedJsBytes, firstLoadChunkPaths }` (`scripts/bundle-budget.mjs:120-125`);
the floor is 17, set when the tree had 16 `page.tsx` routes plus `/_not-found` and now documented in the script as "a floor, not a count" (`:39-40`; the tree has 19 `page.tsx` routes), and the local
`.next/diagnostics/route-bundle-stats.json` (built at 00:34 on 2 Nov by Next 16.4.3, the build that gave `/` 966,798 B) holds 20
records (an older one of unknown provenance held 17).

| Assertion | Value | Cite |
|---|---|---|
| Per-route first-load ceiling | `MAX_FIRST_LOAD_BYTES = 988_000`, raised four times since the gate landed at 1,285,000 (→ 1,290,000 → 1,326,000 → 1,332,000 → 1,336,000), then lowered once to 988,000 after v3.16.0 (shipped in v3.16.1). The in-file rule (`:69-71`) is one commit per raise, quoting measured before/after bytes, but only one of the four raises (`61c9cb8`) was a standalone commit — `2b08f83`, `338effd` and `d412aac` moved the constant inside code changes; the lowering is a standalone commit as well. The in-file comment now says why (`:66-67`): `/` measured 976,936 B at the v3.16.0 cut (#329 had taken it from 1,298,585 B, about a quarter), 972,887 B after the later prune of three low-priority open-source items (#333, `a665991`: two project cards and the Shop.this feed entry) and 972,920 B when the ceiling was set. The 972,887 B was the same on CI (ubuntu-latest, run 39779046431) and on a local macOS build, and the 33 B since is the one-sentence rewrite in `content/projects/anvilry.mdx` line 26. Until the lowering the ceiling had stayed at 1,336,000 B and left 363,113 B of slack. After the dependency security batch (Next 16.4.3) the gate measured `/` at 966,794 B (`node scripts/bundle-budget.mjs` prints it), 6,126 B below the figure when the ceiling was set, and at `953db82` after round 3 it measures 966,798 B (+4 B), so 21,202 B (about 2.1%) of headroom remain under 988,000 B (21,206 B before round 3). The headroom is a growth allowance, not jitter room: #333 shed 4,049 B with two cards and their graph nodes, so it covers roughly ten cards of that size, while any eager import of about 21 KB or more fails. Rebuilds of an unchanged tree have been byte-identical in CI, and CI and macOS agreed on the trees compared, so no jitter margin is added. The 966,794 B and 21,206 B figures come from the gate run for the dependency security batch, which the lead ran again on a build at HEAD `91381b5` (over the existing `.next`, not a wiped one) with the same result; the 966,798 B and 21,202 B figures are the lead's measurement at `953db82` after an incremental `next build` (neither was measured by this pass); the 972,920 B, 972,887 B, run and macOS figures are quoted from the in-file comment and the CI log. The comment still narrates the last raise (1,333,521 B, `:57-64`) and opens with an older figure (1,322,132 B, now worded "at the time", `:43`), and the local artifact above shows `/` at 1,184,096 B — all history, none of them is the current baseline | `scripts/bundle-budget.mjs:72` |
| Route-count floor | `MIN_ROUTES = 17`; fewer means the artifact's shape changed and the gate is lying about coverage. (The script's header still quotes an older measurement — "16 routes; … `/` is 1220794", `:27` — while the `MIN_ROUTES` docblock at `:39` says 17; the assertion uses the constant.) | `:40,:114-119` |
| three.js off the first-load critical path | exactly **1** chunk contains `WebGLRenderer` — 897,249 B (876.2 KiB), i.e. the single "876 KB" copy recorded at `next.config.ts:185-196` — and it appears in **0** of the routes' first-load sets | `:76-77` (comment), `:84` (marker), `:158-166` (check) |
| Every first-load chunk path exists on disk | otherwise the artifact and the build output disagree and the measurement is untrustworthy | `:149-156` |
| Missing or malformed artifact ⇒ exit 1 | by design; the predecessor's defining flaw was reporting success while measuring nothing | `:30-31`, `:107-111`, `:114-125` |

**What it deliberately does not do.** No `continue-on-error`, no `if-no-files-found` — the two settings
that made the predecessor unable to fail on a missing measurement; the rationale is recorded inline at
`ci.yml:179-189`. It also does **not** assert total emitted bytes, so a three.js *twin-chunk* return (two
copies, both still lazy) passes it untouched — that regression is still guarded only by the barrel, per the
twin-chunk row in § 9's failure table. And like the index-citation check it is a **merge** gate, not a
**deploy** gate: Vercel runs `pnpm build` alone, so a bundle regression fails the PR rather than blocking a
production deploy. Three references in the script — comments at `bundle-budget.mjs:70` and `:75`, and the
failure message at `:164` — cite lines 127–149 of `next.config.ts` for the three.js chunk record; that block is now
`next.config.ts:185-201`.

**`@next/bundle-analyzer` survives as a local attribution tool.** It is still a devDependency
(`package.json:61`) and `next.config.ts:5-7` still wraps the config with it, but the only thing that sets
`ANALYZE` is now the `pnpm analyze` script — `package.json:12`, which is
`velite --clean && ANALYZE=true next build --webpack`, and the explicit `--webpack` is what makes the
plugin do anything at all; it writes `.next/analyze/{client,edge,nodejs}.html`.
The consequence is deliberate and one-directional: a `--webpack`
build emits no `route-bundle-stats.json`, so `scripts/bundle-budget.mjs` fails after `pnpm analyze` and
names `--webpack` as the cause (`:109`). Re-run `pnpm build` before the gate. The plugin says as much
itself: its Turbopack warning ends "To run this analysis pass the `--webpack` flag to `next build`", and it
suggests a Turbopack-native analyzer (`node_modules/@next/bundle-analyzer/index.js:10,12`). The plugin's
wording for that alternative — `next analyze` — is real: 16.4.3 ships it as a subcommand (alias
`next experimental-analyze`) that analyses without producing an application build
(`node_modules/next/dist/bin/next:143`, documented in the bundled `01-app/02-guides/package-bundling.md`), and
separately as a `next build --analyze` **flag** (plus a hidden `--experimental-analyze`, `bin/next:110`) that is
refused under any non-Turbopack bundler ("--analyze is only compatible with the Turbopack bundler.",
`node_modules/next/dist/cli/next-build.js:71-72`). Nothing in `package.json` or the
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
(`CHANGELOG.md:1197-1198`).

### The Pagefind search-index step

`/search` loads `/pagefind/pagefind-ui.css` and `/pagefind/pagefind-ui.js` at runtime by injected tag
(`src/app/search/page.tsx:20-46`). Those files are written by the **last step of `pnpm build`**
(`package.json:11`: `node scripts/build-search-index.mjs`), whose input, the prerendered HTML, only exists after `next build`; `make search-index`
(`Makefile:65-66`) re-runs just that step. **There is no `pnpm search-index` script** — `package.json` has 13
scripts (`:9-21`) and none is named that. `public/pagefind/` is gitignored (`.gitignore:50`), so it is absent
from a fresh checkout and `/search` 404s its Pagefind assets until a build (or `make search-index` against
one) has run. The page's own header comment (`search/page.tsx:6`) still says the bundle is "generated
post-build by `make search-index`". The index is rebuilt on **every** `pnpm build` even though
`SEARCH_ENABLED` defaults off (it does not gate the route — only the nav link and the sitemap entry), and a
failure of the step fails the Vercel build (the script itself exits non-zero when it finds no HTML).

**Two output layouts — why this is a script and not a one-liner.** Next writes the prerendered pages in one of two
layouts, and `scripts/build-search-index.mjs` indexes whichever exists (`scripts/build-search-index.mjs:4-13`): the
classic `.next/server/app/<path>.html`, or, when the build runs with a deployment adapter (`NEXT_ADAPTER_PATH`,
which Vercel sets on Next 16.4 and later), `.next/server/route-cache/APP_PAGE/<hash>/$/<path>.html`. The earlier
one-liner, `pagefind --site .next/server/app --output-path public/pagefind`, found 0 files on Vercel and failed that
build ("Found 0 files matching the html glob") while every local and CI build passed. `resolveSearchSource`
(`scripts/build-search-index.mjs:47-77`) uses the classic tree whenever it holds any `.html` (`:49-50`), so CI
behaves as before; otherwise it copies each adapter file to `.next/search-site/<path>.html`, the URL path the page
is served at, so results link to real pages (`:52-70`), keeps the first copy of a duplicated path in sorted-hash
order (`:57,60-63`), and throws when neither layout holds a page instead of publishing an empty index (`:71-75`).
`main` then runs the local `pagefind` binary on the chosen directory into `public/pagefind` (`:79-91`). Both
layouts produced the same index (38 pages, 3953 words) in the check reported with the commit; that figure was not
re-measured here. The mechanism is in Next: `adapterPath` is `process.env.NEXT_ADAPTER_PATH`
(`node_modules/next/dist/server/config-shared.js:189`), the route-cache key is
`/route-cache/<kind>/<sha256 of the source route>/$<path>` (`node_modules/next/dist/server/lib/route-cache-key.js:36,74`),
and the build prefers it over `app/…` when an adapter is set and `output` is not `export` (visible where it moves
`_not-found.html`, `node_modules/next/dist/build/index.js:2491`).

### Failure modes

| Failure | Mechanism |
|---|---|
| Module resolution failure in vitest and next build | `pnpm content` / `velite --clean` skipped; `.velite/` is gitignored. |
| "React.act is not a function" ⇒ every DOM test fails ⇒ deploy fails | Removing `env: { NODE_ENV: "test" }` (`vitest.config.ts:26`). Vitest only defaults `NODE_ENV=test` when unset, but the Vercel build shell sets `production`, which makes React load its prod bundle without `act` (`:19-25`). |
| Every DOM suite runs twice, once without happy-dom globals | Removing the `node` project's `exclude: ["**/*.dom.test.{ts,tsx}", …]` (`vitest.config.ts:41`) — `src/x.dom.test.ts` also matches `src/**/*.test.ts`. |
| "Failing test blocks deployment" property lost | Reordering or splitting the `build` chain into independent commands. |
| Playwright tests a stale build | Without the `webServer` block, a leftover process on :3000 is silently tested — recorded as having produced 5 phantom failures during a release audit (`playwright.config.ts:25-36`). |
| `Executable doesn't exist at .../chromium_headless_shell-<rev>` (or the same for `webkit-<rev>/pw_run.sh` now that `playwright.config.ts` has the `mobile-safari` project) | Installing browsers with anything other than `pnpm exec playwright install --with-deps chromium webkit`, which pins to the installed `@playwright/test` (`ci.yml:166-173`). Omitting `webkit` here installs cleanly and passes silently — it only breaks the instant a `mobile-safari` spec actually runs. |
| Dev server dies with "Can't resolve './projects.json'" | Passing `--clean` to Velite in dev, or setting `clean: true` in `velite.config.ts:179` (rationale `:175-178`). |
| Prerender fails "encountered the unstable value `Date.now()`" | An in-render `new Date()`/`Date.now()` under `cacheComponents`. Two live workarounds: the build-time `NEXT_PUBLIC_BUILD_YEAR` (`next.config.ts:159` → `site-footer.tsx:240`) and `/admin/telemetry`'s `export const instant = false` (`:13`) **plus** `await connection()` (`:478`) — the comment at `:471-474` records that `instant=false` alone does **not** clear it. |
| Build fails with "26 errors" | Re-adding any `export const runtime`, `revalidate`, or `dynamic` segment config under `cacheComponents: true` (`next.config.ts:207-226,235`). The RSC transform rejects the mere *presence* of `runtime`, so `"nodejs"` and `"edge"` are indistinguishable to it. `maxDuration` and `preferredRegion` are **not** rejected. (A grep of `src/` for `export const (runtime\|revalidate\|dynamic)` finds no actual export — only comments recording their removal.) |
| Build fails on an empty `generateStaticParams` | `cacheComponents` requires ≥1 result — which is why `src/app/notes/[slug]/page.tsx:17-27` no longer short-circuits on `!NOTES_ENABLED` and instead prerenders every *published* note slug (`publishedNotes`, `lib/content.ts:57-62`) as a 404 via `notFound()` at `:52`. |
| Vercel build fails at its last step with "Found 0 files matching the html glob" while `pnpm build` is green locally and in CI | The build ran with a deployment adapter (`NEXT_ADAPTER_PATH`; Vercel on Next 16.4 and later), so the prerendered pages are under `.next/server/route-cache/APP_PAGE/<hash>/$/` and `.next/server/app` holds no HTML, which the former one-line `pagefind --site .next/server/app` could not index. `scripts/build-search-index.mjs` (`package.json:11`) indexes whichever layout exists and exits non-zero when it finds none; the reproduction recipe (`NEXT_ADAPTER_PATH` pointing at a no-op adapter) is in [15](./15-invariants-and-gotchas.md), Build & content pipeline. |
| GitHub polling cadence silently changes | `/api/github/stats` has no segment `revalidate`; the 1-hour cadence lives only in two fetch options (`api/github/stats/route.ts:32` and `src/lib/github.ts:142`, recorded at `route.ts:4-8` — whose text still says line 101 of `github.ts`). |
| `security-alerts` reports nothing while showing green | The default `GITHUB_TOKEN` cannot read the Dependabot alerts API even with `security-events: read` — the restriction is on token **type**; a fine-grained PAT stored as `SECURITY_ALERTS_TOKEN` is required (`ci.yml:266-273`). |
| **CI red immediately after the build step**, "cannot read .next/diagnostics/route-bundle-stats.json" | Only Turbopack writes that artifact (`node_modules/next/dist/build/index.js:2922-2923`), so any build that opted into webpack — `pnpm analyze`, or a `--webpack` flag added to `pnpm build` — leaves the gate nothing to read. It exits 1 and names `--webpack` (`scripts/bundle-budget.mjs:107-111`). This is the intended behaviour, not a false positive: unmeasurable must be red. |
| First-load JS grows past the ceiling, or three.js lands on the critical path | `scripts/bundle-budget.mjs` fails the `e2e` job (`ci.yml:190-191`). Raising `MAX_FIRST_LOAD_BYTES` (`:72`) is allowed but must be its own commit quoting measured before/after bytes (`:69-71`); an eager `import * as THREE` in a shell component is the failure the byte ceiling alone would miss, because the bytes were always shipped — they just stopped being deferred (`:79-82`). |
| A bundle regression ships green again | Re-adding `continue-on-error` / `if-no-files-found` to the budget step, which is exactly how `bundle-analysis.yml` ran 222 times (211 green, 11 red) and produced zero artifacts, ever (`ci.yml:179-189`). |
| A production deployment is READY but the production domain still serves the previous one | The Deployment Check `Post-deploy smoke` is pending or red, so Vercel has not assigned the alias (`.github/workflows/deploy-smoke.yml:3-11`). A smoke step that did not succeed (a red smoke, or one skipped because an earlier step failed) is meant to open one issue per held commit, titled `Production deployment held: smoke failed for <7-char sha>` (`an unknown commit` when the dispatch had no valid sha), with best-effort dedupe over the newest 100 open items (`scripts/deploy-gate-alert.mjs`, two `continue-on-error` steps before the guard, `.github/workflows/deploy-smoke.yml:142-165`; those steps were exercised live only by two controlled dispatches on 2026-10-22); if they fail, or if the deployment is held because no status ever arrives (not announced; no watchdog was built), no issue appears and the red (or missing) status on the commit is the only trace. Force Promote and removing the check are in DEPLOY.md section 8. Preview dispatches are skipped by the `environment != preview` guard (`:78`) and are never held. |
| CI runs twice on every PR branch | `push` on `"**"` and `pull_request` both trigger `ci.yml`, with no `concurrency` group (`ci.yml:3-7`). |
| A docs edit reds the PR | Editing or deleting a line the index cites: `node scripts/check-index-citations.mjs` (`ci.yml:76-77`) fails on stale **text** (the cited text is gone from its file, or is duplicated and matches no line shift seen elsewhere in that file), an unresolvable file or line, an inverted range, or a citation on an empty line; a pure relocation from inserted lines is only a warning. Re-fingerprint with `--write` once the prose is re-pointed (`ci.yml:74-75`). |
| The `@react-three/postprocessing` types regression returns | `package.json:34` is now the exact pin `3.1.1`, past the broken `3.0.5`; the version-scoped Dependabot `ignore` for `["3.0.5"]` (`dependabot.yml:82-84`) is still there and its comment (`:80`) still says "Pinned to 3.0.4". Loosening the pin, or dropping the `ignore` while the pin moves back, re-opens it — verify against the `3.0.5` regression before treating the pair as removable. |
| eslint chain breaks | Collapsing the two `brace-expansion` overrides (`@1` → `^1.1.21`, `@>=3` → `^5.0.12`, `pnpm-workspace.yaml:30-31`) into one blanket pin, which forces `minimatch@3` onto 5.x (`CHANGELOG.md:1168-1170`). |
| Dependabot cannot move a transitive advisory | `@modelcontextprotocol/sdk` was exact-pinned to `1.26.0`, equal to `mcp-handler`'s literal peer (`pnpm-lock.yaml:3716`), which produced `security_update_not_possible` (`CHANGELOG.md:1178-1180`) — the situation the `pnpm-workspace.yaml` overrides work around. The pin is now `1.32.0` (`package.json:29`) while the peer still says `1.26.0`: a tolerated mismatch, resolved as `mcp-handler@1.1.0(@modelcontextprotocol/sdk@1.32.0…)` (`pnpm-lock.yaml:8535`). |
| `three` bump breaks a peer | `postprocessing@6.39.5` declares `three: >= 0.168.0 < 0.187.0` (`pnpm-lock.yaml:4132`) against a declared `^0.186.0` — only the 0.186.x line satisfies both. |

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

## 11. Public API contract (versioned JSON API, limiter, catalog)

New with the API-policy change (in no release yet; branch `feat/api-policy-ratelimit-md-twins`). The free,
read-only surface of the site has one published contract, and `src/lib/api-policy.ts` is its single source:
version `"1"` (`:12`), the `API-Version` header (`:15`), the `/api/v1` base path (`:18`), 180 days of notice
before a deprecated surface is removed (`:38`), a budget of 300 requests per 60 seconds (`:41-45`), an empty
`DEPRECATIONS` list (`:61`), the header builder `deprecationHeaders` (`:73-89`) and the sentences that both
`/developers` and the OpenAPI `info.description` print (`VERSIONING_POLICY` `:104-109`, `RATE_LIMIT_POLICY_TEXT`
`:112-118`). The `RateLimit` fields are sent only on responses that count against the budget (and on the 429); a malformed
`API-Version` (400), a refused method (405) and a preflight carry `API-Version` only. `src/proxy.ts` enforces it on every public path, because most of those responses are prerendered or
cached and cannot compute a per-client number themselves. The two numbers (300 per 60 s, 180 days) are defaults
that still await the owner's decision; each is a one-line change.

### Flow

```
GET /api/v1/projects/trelix    (or /api/resume.json, /api/github/stats, /api/mcp/mcp, /llms.txt, /openapi.json, /about.md …;
                                the one POST is /api/v1/batch, subsystem 13)
   → config.matcher entries "/api/:path*", "/.well-known/api-catalog", "/llms.txt", "/llms-full.txt",
     "/openapi.json", "/feed.xml", "/sitemap.xml", "/robots.txt", "/:page.md", "/:kind(…)/:slug.md"   src/proxy.ts:44-53
   → proxy(): the admin gate first, then isPublicApiPath(pathname) → servePublicApi(req)                  :184
        exact set, prefixes /api/v1/ and /api/mcp/, /<page>.md and /<kind>/<slug>.md  src/lib/public-api-paths.ts:13-24,27,30-31
        request header API-Version ≠ "1"          → JSON 400 invalid_request (hint names the one version)  versionRejection :113-124, called :128-129
        allowed = allowedMethods(pathname)         GET, HEAD, OPTIONS; /api/v1/batch takes POST, OPTIONS    :132-133, public-api-paths.ts:53-55
        OPTIONS                                    → 204 + Allow: <allowed>, never counted;
                                                     the MCP path passes through to its own handler         :138-141
        method not in <allowed> (not MCP)          → JSON 405 + Allow: <allowed>                            :145-154
        publicApiLimiter.hit(publicApiClientKey(req))  fixed window per IP, in server memory                :156
                                                     (src/lib/public-api-limit.ts:67-93)
           over budget → JSON 429 rate_limited + Retry-After + the RateLimit fields                         :158-166
        otherwise negotiateMarkdown(req), then stamp(): API-Version: 1, RateLimit-Policy, RateLimit,
           RateLimit-Limit / -Remaining / -Reset, and Deprecation / Sunset / Link when DEPRECATIONS matches  :100-109,:167
   → the answering route or file
        /api/v1/**     src/app/api/v1/**/route.ts, 14 GET routes and the one POST (batch); the GET data comes from mcp-tools.ts through content-api.ts
        /.well-known/api-catalog   src/app/.well-known/api-catalog/route.ts → buildApiCatalog() (RFC 9727 Linkset)
        /api/resume.json, /api/github/stats   the unversioned aliases of version 1 (/api/v1/resume and
                       /api/v1/github/stats serve the same data; the latter calls the alias's own handler)
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/api-policy.ts:12-45,61,73-118` | The constants (version `:12`, header `:15`, base path `:18`, `BATCH_PATH` `:21` and the three batch limits `:33-35`, the 180-day notice `:38`, the budget `:41-45`), the empty `DEPRECATIONS` (`:61`), `deprecationHeaders` (`:73-89`; `Deprecation: @<unix>` RFC 9745, `Sunset` RFC 8594, `Link rel="successor-version"` RFC 5829), `givesEnoughNotice` (`:92-98`, checks an entry against the 180 days) and the two prose arrays (`:104-109`, `:112-118`; the second says a batch counts as one request). Imports nothing. |
| 2 | `src/lib/public-api-paths.ts:13-62` | `isPublicApiPath` (`:57-62`): the exact set (`:13-24`), the two prefixes (`:27`), the `.md` twin pattern (`:30-31`); a trailing slash is ignored (`:34-38`). `allowedMethods` (`:53-55`) says which methods a public path takes: reading and the preflight (`READ_ONLY_METHODS`, `:41`) unless the table `METHOD_EXCEPTIONS` (`:48-50`) lists it, and it lists one path, `/api/v1/batch`, which takes `POST` and `OPTIONS`. Imports only `BATCH_PATH` from `api-policy.ts`, which imports nothing, so the proxy bundle stays free of the content layer. |
| 3 | `src/proxy.ts:41-59,100-109,113-168,184` | The matcher, `stamp`, `versionRejection` (`:113-124`), `servePublicApi` (`:126-168`) and the dispatch. The matcher and the predicate must name the same paths; the method table decides both the JSON 405 (with its `Allow`) and the `OPTIONS` 204. |
| 4 | `src/lib/public-api-limit.ts:36-96,99-102,112-127,135-144` | `createWindowLimiter`: one `Map` of `{count, resetAt}` per client, at most 10,000 clients (`:36`; when full, expired ones go first and then the oldest live ones, `:57-64`), expired buckets also swept once per window at the next request (`:50-55,:71`); `rateLimitHeaders` (the IETF draft fields and the earlier-draft names with the same numbers, `Retry-After` only on a refusal); its own `clientIp` (`x-vercel-forwarded-for`, else the LAST `x-forwarded-for` segment, else `x-real-ip`, else `anonymous`): the fourth copy, listed in `client-ip-consistency.test.ts:26-31`. Deliberately not Redis: a crawler cannot spend the Upstash quota the chat cost guard needs. |
| 5 | `src/lib/api-error.ts:20-73` | Eight codes since `internal_error` (500, `:54`) joined the catalogue; `withJsonErrors` (`:122-133`) wraps a handler so an uncaught exception, or a rejected promise, leaves as the shared 500 and only the error name is logged. |
| 6 | `src/lib/content-api.ts:14,18,21,26-37,61,68,93` | What the v1 handlers share: the slug rule (`^[A-Za-z0-9_-]{1,120}$`), the 100-character limit on `q` and `tag`, `V1_RESOURCES`, `jsonResponse`, `listResponse` (`{count, items}`) and `respondWithItem` (a 400 for a malformed slug that is not echoed, a 404 naming the collection with at most 30 valid slugs in the hint). |
| 7 | `src/app/api/v1/**/route.ts` (15) | Seven prerendered routes that export `GET` only (`/api/v1`, `profile`, `work`, `projects`, `articles`, `notes`, `resume`) and seven dynamic ones (the four `[slug]` routes, `decisions`, `search`, `github/stats`) wrapped in `withJsonErrors` and carrying the JSON 405 stubs and an `OPTIONS`; the fifteenth, `batch/route.ts`, is the one `POST` (subsystem 13). The data comes from the functions the MCP tools use (`mcp-tools.ts`), so the REST view and the tools cannot disagree. |
| 8 | `src/lib/api-catalog.ts:11-51` + `src/app/.well-known/api-catalog/route.ts` | The RFC 9727 catalog: `application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"`; lists `/api/v1` (service-desc `/openapi.json`, service-doc `/developers`, status `/api/v1`) and the MCP endpoint (service-doc `/mcp`). The homepage `Link` header points at it (`next.config.ts:280-284`). |
| 9 | `src/lib/openapi.ts:115-152` + `openapi-v1.ts:31,223` + `openapi-legacy.ts:169` + `openapi-schemas.ts` + `openapi-v1-schemas.ts` + `openapi-parts.ts:24,67,86` | `/openapi.json`: 30 operations, the 15 v1 ones first (14 GETs and `runBatch`; `{ ...buildV1Paths(), ...legacyPaths() }`, `openapi.ts:152`) and the 15 older ones. `openapi.ts` is types and assembly (`buildOpenApiDocument`, `openapi.ts:150`); a POST that never changes anything carries `x-read-only: true` (`runBatch`, `callMcpServer`) and the document's opening sentence about POST routes is generated from the marked ones by `postRoutesSentence` (`:115-135`), so an unmarked POST gets a neutral clause instead of a false "only reads"; `openapi-parts.ts` supplies the optional `API-Version` header parameter, the version and `RateLimit` headers on every 2xx and the typed error responses that reference the `Error` schema. |
| 10 | `src/lib/developers-content.ts:42,94,126` + `src/app/developers/page.tsx` | `RESPONSE_HEADERS` (nine headers), `deprecationSummary`, `buildCurlRecipes`; the page renders them, through the section components of subsystem 16, with the policy text under the anchors `authentication`, `versioning`, `rate-limits`, `sdk`, `cli` and `errors`, and says there is no official SDK; its CLI section is worded from `CLI.published` (true: the published wording). |
| 11 | `src/lib/privacy-facts.ts:18-20` + `src/app/privacy/page.tsx` | `publicApiRequests` and `publicApiWindowSeconds`, pinned to `api-policy.ts` by `privacy-facts.test.ts`, and the paragraph that says the counter lives only in the memory of the server instance that answers, under the IP address (not hashed), and is not written to Upstash or to any log; it also says expired counters are swept out about once a minute, whenever the instance handles a request (never on a timer), and that every counter is gone when the instance restarts. `agent-pages.dom.test.tsx` pins the in-memory and not-written sentences, not the sweep sentence. |

### Entry point

Any request for a path `isPublicApiPath` accepts. A client finds the contract from `/api/v1` (version, status,
rate limit, deprecations, every resource), `/openapi.json`, `/developers`, `llms.txt` ("Developer resources")
or `/.well-known/api-catalog`.

### Exit point

The route's own answer carrying `API-Version: 1` and the `RateLimit` fields, or a JSON 400 / 405 / 429 in the
shared error shape (`error`, `code`, `status`, `hint`, `docs`) with `Retry-After` on the 429.

### Failure modes

| Failure | Mechanism |
|---|---|
| A public path answers without the version and rate-limit headers | The path was added to `isPublicApiPath` but not to the matcher (or the other way round): the proxy never wakes for it. `public-api-paths.test.ts` fails first (it runs the matcher through `unstable_doesMiddlewareMatch` and walks every documented OpenAPI path). |
| A prerendered v1 route becomes a function call per request | A `POST` (or other non-GET) export is added to a static route: Next treats the module as dynamic. `v1-contract.test.ts` fails. |
| The documented API drifts from the routes | A v1 body gains a key the schema omits (the strict validator fails), or a route is added without a row in `v1-test-support.ts` or `openapi-v1.ts`. |
| A client is limited sooner or later than the published numbers say | The count is per server instance and in memory, so a client spread over several instances sees more than 300 per 60 s; the policy text says the numbers describe the instance that answered. Requests with none of the three IP headers share one `anonymous` bucket. |
| A crawler is limited | The discovery files and the `.md` twins count against the same budget (`/sitemap.xml`, `/robots.txt`, `/feed.xml` included). |
| A client that sends `API-Version: v1` gets a 400 | Only `1` is accepted; any other value is refused so a client never receives a contract it did not ask for. |
| A handler throws | `withJsonErrors` answers the shared 500 (`internal_error`); the prerendered routes are not wrapped and fail at build time instead. |
| A browser on another origin cannot call part of the API | The app adds no CORS headers (a decision left to the owner). Vercel adds `Access-Control-Allow-Origin: *` to static responses (most prerendered pages, the seven static `/api/v1` routes, `/openapi.json`, `/llms.txt`, `/llms-full.txt`, `/feed.xml`, `/api/resume.json`, `/sitemap.xml`, `/robots.txt`, the API catalog and `/index.md`), so those are readable cross-origin; the dynamic routes (the slug routes, `search`, `decisions`, `github/stats`, MCP; the new `batch` route is not on production yet and, as a dynamic POST route, is inferred to answer none), the `.md` twins of pages and content (`/about.md`, `/projects/<slug>.md`) and the `use cache` pages `/projects` and `/projects/[slug]` answer none (observed on production, previous release, 2026-11-01). |

### Flags / env that alter it

None: no environment variable was added. The numbers live in `src/lib/api-policy.ts`. The platform header
`x-vercel-forwarded-for` decides the client key on Vercel. `NEXT_PUBLIC_NOTES_ENABLED` empties
`/api/v1/notes` and makes `/api/v1/notes/{slug}` a 404 while the notes flag is off (the default build; a Vercel preview of this branch listed 7 notes there, so that build environment has the flag on: observed, not in the repository).

---

## 12. Markdown twins of pages

New with the API-policy change (in no release yet). Ten pages (`about`, `articles`, `contact`, `decisions`,
`developers`, `mcp`, `notes`, `privacy`, `projects`, `work`; `PAGE_TWINS`, `src/lib/page-twins.ts:16-27`) answer
`Accept: text/markdown` and have a `/<page>.md` URL, the way the homepage and every content item already did
(subsystem 7). `/resume`, `/search` and `/stats` stay HTML-only on purpose (`HTML_ONLY_PAGES`,
`src/lib/markdown-routing.ts:27`, three entries where there were thirteen): a PDF viewer, an interactive search and
live numbers have no text of their own to hand over.

### Flow

```
GET /privacy.md                     (or GET /privacy with Accept: text/markdown)
   → next.config.ts rewrite /:page(about|…|work).md → /api/md/pages/:page                      next.config.ts:313
     (the Accept route: proxy negotiateMarkdown → classifyPath → isPageTwin → rewrite
      /api/md/pages/<page>                               src/proxy.ts:64-95, src/lib/markdown-routing.ts:48-49)
   → src/app/api/md/pages/[page]/route.ts   GET = withJsonErrors(…)                              :13-18
   → markdownForPage(name)                                                                       src/lib/page-markdown.ts:45-50
        not a PAGE_TWINS name                       → markdownNotFound(`/${name}`)
        buildPageMarkdown(name) is null             → markdownNotFound  (articles / notes with nothing to show)
        about, projects, work, decisions, articles, notes → the builders of page-markdown-lists.ts,
                                 written from the same data modules the pages read
        contact, developers, mcp, privacy           → renderProseMarkdown(page)                  page-markdown-prose.ts:64-
                                 calls the page's own function and converts the elements it returns
                                 with elementToMarkdown(Page(), { callable, sections })           element-markdown.ts:400
   → markdownResponse(body, { canonicalPath })      text/markdown, Vary: Accept, Link rel="canonical"
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/page-twins.ts:16-35` | `PAGE_TWINS` and `isPageTwin`. Imports nothing, because the proxy reaches it through `markdown-routing.ts`. |
| 2 | `src/lib/markdown-routing.ts:27,35-53` | `HTML_ONLY_PAGES` and `classifyPath`: a page twin rewrites to `/api/md/pages/<page>` (`:48-49`), an HTML-only page passes (`:51`), any other extension-less path is the Markdown 404. |
| 3 | `next.config.ts:91-102,292-295,313` | The config's own copy of the page list (the file imports nothing from `src/`; `next-config.test.ts` fails if it differs from `page-twins.ts`), the `Link` and `Vary: Accept` rules for the ten HTML pages (Next keeps `Vary` only on Markdown responses), and the rewrite. |
| 4 | `src/app/api/md/pages/[page]/route.ts:13-26` | The handler, wrapped in `withJsonErrors`, with the JSON 405 stubs and an `OPTIONS`. |
| 5 | `src/lib/page-markdown.ts:23-50` | `buildPageMarkdown` (the switch) and `markdownForPage` (the response, or the Markdown 404 for a name with no twin and for a page that would itself be a 404). |
| 6 | `src/lib/page-markdown-lists.ts:47,98,110,133,172,197` | `buildAboutMarkdown`, `buildProjectsMarkdown`, `buildWorkMarkdown`, `buildDecisionsMarkdown`, `buildArticlesMarkdown`, `buildNotesMarkdown`. The last two return `null` when there is nothing to show (no published article; notes dark). |
| 7 | `src/lib/page-markdown-prose.ts:38-73` | `PROSE_PAGES` (loaded on first use, so a fault in one page cannot take the others down) and `renderProseMarkdown`: the page is the source, so the privacy numbers, the API tables and the policy text cannot differ from what a browser shows. |
| 8 | `src/lib/element-markdown.ts:400` | `elementToMarkdown`: walks the React elements a server component returns (table cells escape a pipe through `escapeCellPipes`, `:408-418`, by the parity of the backslash run before it: after an odd run the pipe is already escaped and stays, otherwise it gets one more backslash; a CodeQL `js/incomplete-sanitization` fix pinned by two tests). It exists because `react-dom/server` is not usable where a route handler runs. Host elements are converted, components on an allow-list are called, section components become headings, a component given an `href` is a link, any other component contributes its children only, and an async component or an unreadable node throws (the route then answers the shared JSON 500 rather than a half page). |
| 9 | `src/lib/page-markdown-shared.ts` | `abs`, `linkText`, `pageAndTwinLinks` (`[name](url)` for an HTML page followed by the link to its Markdown twin, `:13`), `section`, `joinParts` and `twinFooter` (the closing line that names the HTML page). |
| 10 | `src/lib/llms-txt.ts:26-32,90,161-162` | `llms.txt` lists the `.md` URL of every page that has a twin and exists (`articles` only when an article is published, `notes` only when notes are on) under "Pages", and tells an agent that every page has a `.md` URL. |

### Entry point

`GET /<page>.md`, or `Accept: text/markdown` on `/<page>`, for one of the ten pages.

### Exit point

A Markdown document with one `#` heading, absolute links and a footer that names the HTML page; or the
Markdown 404 (`/notes` while the notes flag is off, `/articles` with no published article); or the shared JSON 500
if a prose page cannot be converted.

### Failure modes

| Failure | Mechanism |
|---|---|
| A page is added and a Markdown client gets a 404 for it | The page is in neither `PAGE_TWINS` nor `HTML_ONLY_PAGES`. `markdown-routing.test.ts` walks `src/app` and fails first. |
| A twin drifts from its page | A list twin reads different data than its page, or a prose page uses a component the converter does not know and the text is lost. `page-markdown.dom.test.tsx` renders the real pages and fails when a heading, paragraph, list item, table cell, code block or link is missing from the twin. |
| The three copies of the page list disagree | `PAGE_TWINS` (`page-twins.ts`), the copy in `next.config.ts` and the rewrite pattern: `page-twins.test.ts` and `next-config.test.ts` fail. |
| A prose page cannot be converted | An async page component or a node the converter cannot read throws; `withJsonErrors` answers the shared 500 and logs the error name only. |
| A cached twin goes stale | Twins send a revalidating `Cache-Control` and `Vary: Accept` (`markdownResponse`), not an immutable one. |

### Flags / env that alter it

`NEXT_PUBLIC_NOTES_ENABLED` (the `notes` twin is the Markdown 404 while the notes flag is off). Whether any article is
published decides the `articles` twin. No environment variable was added.

---

## 13. Batch endpoint (`POST /api/v1/batch`)

New with the later pass of the API-policy change ("round 3", in no release yet; branch `feat/agent-readiness-round3`). It is the one `POST` of
the free API besides the MCP endpoint, and it only ever reads: the body lists `GET` operations of `/api/v1`, and the answer carries one result
for each. An agent that needs a profile, a project and a search result makes one request instead of three. Three numbers bound it, all in
`src/lib/api-policy.ts`: at most `BATCH_MAX_REQUESTS` = 25 operations (`:33`), a request body of at most `BATCH_MAX_BODY_BYTES` = 16384 bytes
(`:34`) and an answer of at most `BATCH_MAX_RESPONSE_BYTES` = 1048576 bytes (`:35`), pinned as literals in `api-policy.test.ts`. What actually
bounds the traffic one batch can pull is **each operation once**: a batch that repeats an operation is rejected, so it is at most 25 different
`GET`s, and the answer cap is a backstop in case a route's answer grows (`api-policy.ts:23-32`). A batch counts as **one** request of the
300 per 60 s budget (the proxy counts when the `POST` arrives, `:116` says so in the published policy text).

### Flow

```
POST /api/v1/batch   {"requests":[{"id":"trelix","path":"/api/v1/projects/trelix"}, …]}   Content-Type: application/json
   → src/proxy.ts   isPublicApiPath (prefix /api/v1/) → servePublicApi: API-Version check, then
                    allowedMethods("/api/v1/batch") = POST, OPTIONS (every other public path: GET, HEAD, OPTIONS)      proxy.ts:126-168, public-api-paths.ts:48-55
                    → counted once against the budget, 429 when spent, stamped with the RateLimit fields
   → src/app/api/v1/batch/route.ts   POST = withJsonErrors(…)                                                         :27-50
        Content-Type is not application/json            → 400 invalid_request ("nothing ran")                         :28-30
        readBodyWithin(req, 16384)  more than 16384 BYTES → 413 payload_too_large, before parsing                      :32-42 (batch.ts:244-273)
        not valid UTF-8                                  → 400                                                         :43-44
        parseBatchBody(text)  any problem at all         → 400, nothing runs, the hint names the item                  :46-47 (batch.ts:170-219)
        runBatch(items)  each item in process, through the real GET handler of the route its path names, all at once  :49 (batch.ts:381-392)
        answerBatch(results)  over 1048576 bytes         → 413 payload_too_large, none of the results, nothing truncated
                              else 200 { "responses": [ { id, status, body }, … ] } in request order, Cache-Control: no-store   (batch.ts:405-415)
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/api-policy.ts:21,33-35,116` | `BATCH_PATH`, the three limits and the sentence of `RATE_LIMIT_POLICY_TEXT` that says a batch counts as one request, printed by `/developers` and the OpenAPI description. |
| 2 | `src/lib/public-api-paths.ts:41-55` | `READ_ONLY_METHODS`, the one-entry table `METHOD_EXCEPTIONS` and `allowedMethods(path)`; the proxy reads it for both the JSON 405 (with its `Allow`) and the `OPTIONS` 204. |
| 3 | `src/proxy.ts:114-168` | `versionRejection` and `servePublicApi`: the `API-Version` check and the budget still apply to a `POST`; the MCP path is unchanged. |
| 4 | `src/app/api/v1/batch/route.ts:27-58` | The route: `POST` wrapped in `withJsonErrors`, and `GET`/`PUT`/`PATCH`/`DELETE` as JSON 405 stubs advertising `POST` with an `OPTIONS` (`:52-58`). It reads a body, so it is dynamic. |
| 5 | `src/lib/batch.ts:20-33` | The id and path limits (64 characters counted as code points, 512) and the path allowlist `BATCH_PATH_PATTERN`: `/api/v1` followed by segments of letters, digits, hyphen and underscore, and an optional query of printable ASCII without space, `#` or backslash. No dot segment, percent-escape, backslash, double slash, scheme, host or control character can be written. |
| 6 | `src/lib/batch.ts:55-111` | `BATCH_ROUTES`, the closed list of 14 `/api/v1` GET handlers a batch can run, with per route the query parameters it reads (`decisions` reads `tag`, `search` reads `q`). The batch endpoint, admin, cron, chat, voice, the MCP endpoint and the unversioned aliases are absent, so a batch can neither reach them nor recurse; `batch.test.ts` pins the list to the OpenAPI document. |
| 7 | `src/lib/batch.ts:132-219,329-337` | `itemProblem` and `parseBatchBody`: all-or-nothing validation, the first problem found names the index and never repeats what the client sent; `operationKey` decides when two items are the same operation (the route template, the slug and the values of the parameters that route reads, the query parsed exactly as the handler parses it). |
| 8 | `src/lib/batch.ts:244-273` | `readBodyWithin`: believes the declared `Content-Length` only to refuse early, counts the bytes that arrive (so a chunked body or a lying header cannot pass), cancels the stream past the cap, and decodes with `fatal: true` so invalid UTF-8 is reported, not repaired. |
| 9 | `src/lib/batch.ts:284-392` | `toOutcome`, `resolveRoute`, `execute` and `runBatch`: each item calls the real handler in process with a bare `GET` for this site (no client headers) and its slug as Next 16 passes it; a non-JSON sub-response has a null body; an unmatched path is a 404 item (`notBatchable` lists the batchable paths); a throwing handler is a 500 item `internal_error`, logged by name only. |
| 10 | `src/lib/batch.ts:395-415` | `responseBytes` and `answerBatch`: the 1048576-byte cap is measured on the serialised answer, and over it the whole answer is refused. |
| 11 | `src/lib/openapi-v1.ts:106-116,239-262` + `src/lib/openapi-v1-schemas.ts:273-330` | The operation `runBatch` (tag API, `x-read-only: true`), its request example `BATCH_EXAMPLE_BODY` (tested against the real parser and run end to end) and the schemas `BatchRequest`, `BatchRequestItem`, `BatchResponse`, `BatchResponseItem`. |
| 12 | `src/lib/developers-content.ts:165-199` + `src/app/developers/sections/intro.tsx:67-86` + `src/lib/llms-txt.ts:101` | `buildBatchRecipe` (the curl call, built from the document's own example), `batchSentence` and `batchSemantics`, printed on `/developers` and in its Markdown twin, and the "Anvilry batch endpoint" line of `llms.txt`. |
| 13 | `cli/lib/commands.mjs` (the `batch` command) + `cli/lib/request.mjs:24-38` | The CLI's `anvilry batch <path>...` sends one `POST` with the paths numbered from 1 (subsystem 15). |

### Entry point

`POST /api/v1/batch` with a JSON body `{ "requests": [ { "id", "method"?, "path" } ] }`: 1 to 25 items, an `id` of 1 to 64 characters unique in the
batch, `method` absent or `"GET"`, a `path` of at most 512 characters that starts with `/api/v1`. Only the keys `id`, `method` and `path`, and
`requests` at the top level, are accepted.

### Exit point

`200 { "responses": [ { id, status, body } ] }` in request order, each item carrying the status its own route answered (a 404 for an unknown slug or
an unmatched path, a 400 for a malformed slug or query, a 500 when its handler failed), `Cache-Control: no-store`; or, with nothing run, a 400
`invalid_request`, a 413 `payload_too_large`, a JSON 405 or a 429, all in the shared error shape.

### Failure modes

| Failure | Mechanism |
|---|---|
| A batch is used to amplify traffic | The same operation twice is a 400 (`requests[N] repeats requests[M]; send each operation once`); two items count as the same when the route would read the same values from both, so a parameter a route ignores makes no difference and a second `?` cannot hide one; the one route that calls GitHub is therefore called at most once per batch (`batch/route.test.ts`). The cap is then a backstop: the largest all-distinct batch measures about 140 KB (140,742 B by the procedure of `batch-run.test.ts` with the notes flag unset or `false`, 142,923 B with it `true`; about 13 to 14% of the cap), well under half of it. |
| A batch reaches a route it should not | It can only name a row of `BATCH_ROUTES`; the path allowlist leaves no way to write a traversal or a host, and a nested batch is refused (`batch.ts:160-162`). A well-formed path no row matches is a 404 item and no call is made. |
| A new `/api/v1` route is not batchable, or a removed one is still listed | `batch.test.ts` fails when `BATCH_ROUTES` and the OpenAPI document disagree, including the query parameters each route declares. |
| The answer grows without bound | Over 1048576 bytes the whole answer is a 413 and none of the results are sent; a long list is split across batches (`batch-cap.test.ts` replaces `runBatch` with an oversized result; `batch-run.test.ts` stubs a route that answers more than the cap). |
| A client re-sends or loses a batch | There is no write to repeat: every operation is a read, the answer is never cached (`no-store`) and the budget is charged once per call. |
| One bad item hides the good ones | Validation is all or nothing and happens first; after it, items run independently and one failing item never fails another. |
| A `POST` reaches a read-only path | The proxy's method table lists `/api/v1/batch` alone; everywhere else a `POST` is the JSON 405 (`public-api-paths.test.ts`, `proxy.test.ts`). |

### Flags / env that alter it

None: no environment variable was added. `NEXT_PUBLIC_NOTES_ENABLED` changes what the note items return (`batch/batch-notes.test.ts` pins both states).

---

## 14. Structured data (JSON-LD)

New with round 3. The site already described the owner (`PersonJsonLd`, `OrganizationJsonLd`, `WebSiteJsonLd`, `FaqJsonLd` in the root layout,
`src/app/layout.tsx:125-128`, `ProfilePageJsonLd` on `/about`) and, for each article and note page, a `BlogPosting`. Round 3 adds
what search and agents had no structured data for: the three lists the homepage shows, the developer documentation, and the MCP server; it
also hardens the one serialiser all of them go through. Every entity says only what its page says, and a DOM test renders the real page and
compares.

### Flow

```
src/app/page.tsx   after <ViewRouter>, outside <main> (so not part of the page text)                         :43-47
   → <FeaturedWorkJsonLd />      allWork                       → featuredWorkItemList      json-ld-lists.tsx:91-110    (CreativeWork, the owner as `contributor`)
   → <FeaturedProjectsJsonLd />  featuredProjects              → featuredProjectsItemList  :114-137                   (SoftwareSourceCode via softwareSourceCodeEntity; codeRepository only for a public repo)
   → <LatestArticlesJsonLd />    homeArticleGroups()           → latestArticlesItemList    :151-174                   (BlogPosting; url = articleUrl(group), :145-148)
        ListScript renders nothing for an empty list (:177-179), otherwise JsonLdScript                         json-ld.tsx:37-47
            JsonLdScript = { "@context": "https://schema.org", ...data } → safeJsonLd(…)                        json-ld.tsx:26-28, escapes :18-24
/developers  → <DevelopersJsonLd />   WebAPI "Anvilry public API" + TechArticle                                   json-ld-api.tsx:27-54,70-77 (page.tsx:76)
/mcp         → <McpServerJsonLd />    WebAPI "Anvilry MCP server"                                                json-ld-api.tsx:57-67,80-82 (mcp/page.tsx:216)
articles/[slug] and notes/[slug]  → JsonLdScript (the same escaper)                                              articles/[slug]/page.tsx:140, notes/[slug]/page.tsx:111
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/home-articles.ts:6-17` | `homeArticleGroups()` and `HOME_ARTICLE_COUNT` (2): none while articles are disabled, otherwise the newest two **after** grouping, so two platform copies of one article are one card. `WritingPreview` (`home/writing-preview.tsx:8-12`), the JSON-LD list and the homepage Markdown twin all read it, so they cannot disagree about which articles the page shows. |
| 2 | `src/lib/article-href.ts:13-28` | `resolveCanonicalHref(group, notesEnabled)`: where an article card sends a visitor (the on-site note while notes are enabled, else the canonical's external URL, else the first syndicated copy with a URL, else the on-site page). Pure and import-light so the article card (a client component), the JSON-LD list and the homepage Markdown twin (server code, which cannot call functions exported by a client module) share one rule. It is not the only copy: the `/articles.md` twin (`page-markdown-lists.ts`) and `related-writing.tsx` keep their own. |
| 3 | `src/lib/strip-tracking-params.ts:2-74` | `stripTrackingParams(url)`: removes the 20 documented tracking names (`TRACKING_PARAMS`, `:16-37`) and any `utm_` parameter, matched whole, lower-cased and percent-decoded; returns the input unchanged when there is nothing to strip or it is not an absolute URL. Applied **only** to the URL of a JSON-LD entity (`json-ld-lists.tsx:145-148`); a visible link stays as the author wrote it. |
| 4 | `src/components/json-ld-lists.tsx:1-193` | The three list builders and the three components (`:181-193`). Each entry is built from the data its section component reads, in its order; text is passed through as shown, and the test fails if a title ever carries markdown or HTML. The project entity is the same call `/projects/[slug]` makes; the work entity says `contributor` where `/work/[slug]` says `author` (a deliberate difference: every case study's register reads "Co-built"). |
| 5 | `src/components/json-ld-api.tsx:18-82` | `publicApiEntity`, `developersArticleEntity`, `mcpServerEntity` and the two components; no terms of service and no publication date are declared because there are none. |
| 6 | `src/components/json-ld.tsx:5-52` | `safeJsonLd` and `JSON_LD_ESCAPES` (`:18-28`), `JsonLdScript` (`:37-47`), `authorPerson` (`:50-52`). The serialiser escapes every `<`, `>`, `&`, U+2028 and U+2029 as its `\uXXXX` JSON escape (it used to escape only `</`): `<` can begin `</script>`, `<!--` or `<script`, and after `<!--` a later `<script` puts the HTML tokenizer in its "double escaped" state, where the block's own `</script>` no longer closes it and the rest of the page, with every JSON-LD block after it, is swallowed. `JSON.parse` reads the escapes back to the same characters, so the parsed object is identical. |
| 7 | `src/lib/home-markdown.ts:35-40` | The homepage Markdown twin links the same articles through `homeArticleGroups()` and `resolveCanonicalHref`, so with notes on its link for a cross-posted article is the on-site note page, not a Substack share link. |
| 8 | `src/components/json-ld-lists-support.tsx:1-136` | A test helper, not production code (it imports Vitest): renders the real homepage sections with the notes and articles flags pinned and reads the JSON-LD back out of the server HTML, for `json-ld-lists.dom.test.tsx` and `json-ld-articles.dom.test.tsx`. |

### Entry point

A crawler or agent reading the HTML of `/`, `/developers`, `/mcp` or an article or note page.

### Exit point

`<script type="application/ld+json">` blocks: three `ItemList`s on `/` (`@id` `…/#production-work`, `…/#open-source-projects`, `…/#latest-articles`), a `WebAPI` and a
`TechArticle` on `/developers`, a `WebAPI` on `/mcp`.

### Failure modes

| Failure | Mechanism |
|---|---|
| A title or summary ends the script block or swallows the rest of the page | Fixed in `safeJsonLd`; `json-ld.dom.test.tsx` asserts on the serialised text for hostile strings, because happy-dom does not model the HTML parser states that make `<!--` and `<script` dangerous, and checks every component of the file uses it. |
| The list says something the page does not | Each list is compared with the cards its section renders (`json-ld-lists.dom.test.tsx`, `json-ld-articles.dom.test.tsx`); the project and work entities are compared with their own pages (`json-ld-parity.dom.test.tsx`). |
| A private repository leaks | `repoLink()` returns `null` for a private project and the entity then has no `codeRepository`; a test asserts the URL never appears. |
| An article has several URLs in the index | The JSON-LD URL is the card's link without tracking parameters, so one article has one URL (`json-ld-articles.dom.test.tsx`). |
| A list is emitted for an empty section | `ListScript` renders nothing for `numberOfItems === 0`, and `LatestArticlesJsonLd` is absent when articles are disabled. |

### Flags / env that alter it

`NEXT_PUBLIC_ARTICLES_ENABLED` (no article list when disabled) and `NEXT_PUBLIC_NOTES_ENABLED` (a cross-posted article points at the note only while notes
are enabled). Nothing else.

---

## 15. The `anvilry` CLI package and its publish flag

New with round 3. The source of a command-line client for the public API lives in `cli/` (npm name `anvilry`, zero dependencies).
The owner published `anvilry` 0.1.0 to npm on 2026-11-01 (by hand, no provenance, from the tree before the publish flip); `cli/package.json` is 0.1.1, a README-only patch prepared for the owner to publish, so the registry's latest is 0.1.0 until then.
Every sentence about the CLI on `/developers`, in its Markdown twin and in `llms.txt` is built from one descriptor and one flag, `CLI.published`, which is `true` in this tree and flips them together; production, observed 2026-11-01, runs the previous release, so its `/developers` and `llms.txt` still say there is no published CLI until this deploys. The package
is indexed file by file in [11](./11-config-build-ci-infra.md) (`### cli/`); this section is how it connects to the rest.

### Flow

```
anvilry <command> [args] [flags]     (npx anvilry; from a clone: node cli/bin/anvilry.mjs)
   → cli/bin/anvilry.mjs   passes in only ANVILRY_BASE_URL; exits 0 quietly if the reader of a pipe leaves             :5-16
   → run(argv, { env, stdout, stderr, fetch })                                                                         cli/lib/run.mjs:24-52
        planInvocation(argv, env)   parse, validate, build the request; every usage error is raised here, before any network call   plan.mjs:33
        send(request, { fetch, timeoutMs })   redirect "manual" (a 3xx is a result, never followed), body read under 10 MiB, one deadline   http.mjs:22-47
        interpretResponse(response, plan)   stdout, stderr, exit code: 0 ok · 2 API error / 429 / 3xx / not JSON / too big / failed batch item
                                            (3 no answer, 1 usage)                                                    report.mjs:40
   → GET https://anvilry.vercel.app/api/v1/…  (or POST /api/v1/batch, subsystem 13)  with Accept, API-Version: 1 and User-Agent anvilry-cli/<version>

the site side:
src/lib/developer-tools.ts   CLI = { name "anvilry", registry "npm", published: true, … }                              :35-43   ← the single switch
   → cliHeading / cliStatus / cliSourceNote / cliInstallLines / cliLlmsLine                                             :115-150
   → /developers #cli (sections/cli.tsx:31-104), /developers.md (the same components), llms.txt "Developer resources" (llms-txt.ts:109)
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `cli/package.json`, `cli/bin/anvilry.mjs`, `cli/lib/*.mjs` | The package (11 `### cli/`). |
| 2 | `cli/lib/commands.mjs` | The command and flag tables: the contract the site pins its documentation to; frozen, so they cannot change at run time. |
| 3 | `cli/lib/constants.mjs` | The numbers it shares with `src/` (API version and header, slug rule, the 25-operation batch limit, the canonical origin); it cannot import from the site, so `tests/cli/drift.test.ts` is the only thing that ties them together. |
| 4 | `src/lib/developer-tools.ts:35-150` | `CLI` (the descriptor and the flag), `CLI_COMMANDS` (the site's copy of the command table, pinned to `cli/lib/commands.mjs` by `developer-tools.test.ts`) and the wording helpers. Published (the state of this tree): the section is headed "Anvilry CLI", names the package, offers `npx anvilry` and `npm install --global anvilry` and lists every command; unpublished (the flag-false branch of this tree's helpers, covered by the wording tests): headed "Anvilry command-line use", says there is no published CLI package, adds where the source is (`cli/`) and offers no install or run command; production, which runs the previous release, shows an older wording without the source note until this deploys (the same heading, "There is no published CLI package for Anvilry." and curl recipes; observed 2026-11-02). |
| 5 | `src/app/developers/sections/cli.tsx:31-104` + `src/lib/llms-txt.ts:109` | `CliCommandsTable`, `CliInstall`, `CliSection` and the `llms.txt` line, all reading `CLI`. |
| 6 | `cli/README.md` (156 lines) | Carries no status block and no "Once published:" lead-in now (they exist exactly while the flag is false, `tests/cli/readme.test.ts`); Install is at `:12` and the maintainers' list at `:142-152` ends at verifying a clean install. |
| 7 | `.gitignore` | `~/`, `**/~/` and `.npm/`: a literal `~` directory once appeared under `cli/`. |
| 8 | `tests/cli/**` (15 files, 279 tests) | Commands, planning, running (in process and as a child process), hostile servers, pipes, packaging, README, drift. |

### Entry point

A terminal (`npx anvilry`, now that the package is on npm; from a clone, `node cli/bin/anvilry.mjs`), and `src/lib/developer-tools.ts` for the site's wording.

### Exit point

JSON on stdout, errors on stderr, an exit code 0 to 3; and, on the site, the CLI section of `/developers` (headed "Anvilry CLI" while the flag is true), its twin and `llms.txt`.

### Failure modes

| Failure | Mechanism |
|---|---|
| The site says the CLI is installable when it is not, or denies one that exists | Not possible by editing prose: the wording comes from `CLI.published`; `developer-tools.test.ts` pins the flag to `true` (the package is on npm; lower it, and the gate, only if the package is withdrawn) and `readme.test.ts` fails if a README status block or lead-in disagrees with the flag. The four edits publishing takes (flag, block, lead-in, gate) were made in the change that flipped it. |
| The package and the site disagree about a command or a number | `developer-tools.test.ts` compares `CLI_COMMANDS` with `cli/lib/commands.mjs` in name, summary and usage; `drift.test.ts` compares the shared values with `src/`. |
| A hostile `--base-url` server attacks the terminal | Control and format characters in what the CLI prints are written as `\uXXXX`; `--raw` is byte-exact on purpose; redirects are never followed (a batch body is never re-sent elsewhere); a body over 10 MiB, an unprintable body or one nested past the pretty-print limits is refused with exit 2. |
| `anvilry openapi \| head -1` crashes | `exitWhenReaderLeaves` makes `EPIPE`, `ENOTCONN` and `ECONNRESET` on stdout or stderr exit 0 quietly; any other stream error is rethrown. |
| The package ships a stray file | The `files` whitelist, and `package.test.ts` (`npm pack --dry-run`, skipped with a visible reason without `npm`). |
| The package publishes with provenance from a laptop | The manifest asks for none (`publishConfig` is only `access: public`): npm can generate provenance only on a supported CI provider. |

### Flags / env that alter it

`CLI.published` (a source constant, currently `true`, not an environment variable). The CLI itself reads exactly one variable, `ANVILRY_BASE_URL`, and writes no file.

---

## 16. The `/developers` section architecture

New with round 3. `src/app/developers/page.tsx` is 79 lines: a metadata block and a short `DevelopersPage` (`:43-79`) that lays out section components imported from `./sections`. Before
round 3 it was one long page; the split exists so each piece stays small and so the Markdown twin can be made by the same components.

### Flow

```
/developers (HTML)   page.tsx:43-79   buildOpenApiDocument() once → <Section …> IntroSection, QuickstartSection, AuthenticationSection, EndpointsSection, VersioningSection,
                     RateLimitsSection, ResponseHeadersSection, DeprecationNote, MarkdownSection, ErrorsSection, ErrorCodesSection, McpSection, SdkSection, CliSection, DiscoverySection, LimitsSection
                     + <DevelopersJsonLd />
                     every component comes from  src/app/developers/sections/index.ts  (26 lines, the single list)
/developers.md (Markdown twin)   page-markdown-prose.ts:38-46   import page + import sections → components: Object.values(sections)
                     → renderProseMarkdown (:64-73): elementToMarkdown(Page(), { callable: CALLABLE ∪ components, sections: SECTIONS })
                     a component not in index.ts is read through, keeping only its children: it would vanish from the twin without an error
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/app/developers/page.tsx:43-79` | Metadata and the layout; no prose of its own. |
| 2 | `src/app/developers/sections/index.ts:1-26` | The one export list, read by the page and by the twin. |
| 3 | `src/app/developers/sections/intro.tsx:34-90` | `IntroSection`, `QuickstartSection` (the curl recipes, including the batch call, `:63-86`). |
| 4 | `src/app/developers/sections/contract.tsx:9-112` | `AuthenticationSection`, `EndpointsSection` (rendered from the OpenAPI document by `ApiTable`, `api-table.tsx:23`), `VersioningSection`, `RateLimitsSection`, `ResponseHeadersSection`, `DeprecationNote`. |
| 5 | `src/app/developers/sections/guides.tsx:48-212` | `MarkdownSection`, `ErrorsSection` (the `errors` anchor, `:94`), `ErrorCodesSection` (the table rendered from `API_ERROR_CODES`, `:127`), `McpSection`, `SdkSection`, `DiscoverySection`, `LimitsSection`. |
| 6 | `src/app/developers/sections/cli.tsx:31-104` | `CliCommandsTable`, `CliInstall`, `CliSection` (subsystem 15). |
| 7 | `src/lib/developers-content.ts:42-199` | The facts the sections state that are not prose: `RESPONSE_HEADERS`, `deprecationSummary`, `buildCurlRecipes`, `buildBatchRecipe`, `batchSentence`, `batchSemantics`. |
| 8 | `src/lib/page-markdown-prose.ts:38-73` | The prose-page registry; `developers` is the one entry that also loads the sections. |

### Entry point

`GET /developers`, or `GET /developers.md` and `Accept: text/markdown` on `/developers`.

### Exit point

An HTML page, or a Markdown document that contains everything the HTML shows (`page-markdown.dom.test.tsx`).

### Failure modes

| Failure | Mechanism |
|---|---|
| A section silently disappears from `/developers.md` | It was not exported by `index.ts`. `sections.test.ts` fails when a component of the folder is missing from it. |
| The page grows back into one long file | `sections.test.ts` fails when a function is over 50 lines, a file over 500, or `DevelopersPage` is not short. |
| A table on the page and in the twin disagree with the code | The endpoint table is rendered from the OpenAPI document, the error table from `API_ERROR_CODES`, the header table from `RESPONSE_HEADERS`, the commands from `CLI_COMMANDS`; nothing is retyped. |
| The CLI section says the wrong thing | It is built from `CLI`; see subsystem 15. |

### Flags / env that alter it

`CLI.published` changes the `#cli` section. Nothing else.

---

---

## Cross-subsystem coupling points

Places where one subsystem's change breaks another, gathered from all sixteen maps — subsystems 1–6 in
[`14-subsystems.md`](./14-subsystems.md), 7–16 above.

| Coupling | Sites that must agree |
|---|---|
| Project group names (2 copies) | `velite.config.ts:4-9` · `src/lib/content.ts:40-45` |
| Graph node ↔ content slug | `src/lib/graph-data.ts:18-92` (`graphNodes`, 23 entries) · `src/lib/game-model.ts:36-67` (`NODE_CONTENT`) · gate `src/lib/game-model.test.ts:22-58` |
| Base URL `https://anvilry.vercel.app` (**22 production files / 26 lines** at this tree, prose and comments included; 24 files / 28 lines counting the two test-support helpers `mcp-test-support.ts` and `json-ld-lists-support.tsx`; 46 files / 85 lines with all `src/` test files; 56 files / 104 lines once `tests/` and `cli/` are searched too, the CLI carrying its own `DEFAULT_BASE_URL`; newer machine-readable code imports `SITE_URL` from `src/lib/site-url.ts` instead of repeating the host) | The per-file table in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url) is the single authority; re-verify with `grep -rn 'anvilry\.vercel\.app' src Makefile \| grep -v '\.test\.'`. Densest site: `src/components/json-ld.tsx:72,255,292,305,351` (5 lines, the last one inside FAQ answer prose). One site is **functional, not cosmetic**: `OWN_NOTES_URL_PREFIX` (`src/lib/content.ts:79`) is how `isNoteOnlyArticle` recognises an article whose `externalUrl` is one of its own note URLs — change the domain without it and note-only articles stop being dropped while notes are dark (`content.ts:92`). `src/lib/mcp-tools.test.ts:104,117` asserts against the same host, and `cli/lib/constants.mjs` (`DEFAULT_BASE_URL`) is a copy outside `src/` that `tests/cli/drift.test.ts` ties to the canonical origin |
| Error dedupe flag string | `src/app/error.tsx:39` · `src/app/global-error.tsx:34` · `src/instrumentation-client.ts:68-69` |
| Beacon `source` enum | `src/lib/telemetry/beacon.ts:42` · `src/app/api/error/route.ts:84` (declared source of truth) |
| Telemetry kind union (8 kinds) | `src/lib/telemetry/schema.ts:37-50` · `src/app/admin/telemetry/page.tsx:47` (fetch loop over `KIND_LITERALS`) and its render switches (`:384,:414-416`) · `scripts/replay-trace.mjs:47-55` (**hardcoded copy with 7 kinds — `chat.cache` is missing**, so `make trace` never replays FAQ-cache spans) · the union is pinned by `schema.test.ts:138-155`. Three of the eight — `tts.request`, `transcribe.request`, `budget.tick` — have **no emitter** anywhere in `src/` (TTS/STT failures are emitted as `server.error`), so the dashboard's four voice-latency tiles (`page.tsx:729-762`) stay on their empty placeholders |
| Redis key literals | `src/app/admin/telemetry/page.tsx:29,244,278,281,284,287,293` · the five `api/cron/*` writers (`eval/route.ts:176`, `health-check/route.ts:208-221`, `github-sync/route.ts:27,53`, `seo-audit/route.ts:66`, `content-audit/route.ts:43`) · `src/lib/telemetry/emit.ts:70` · `src/instrumentation.ts:98` and `src/lib/chat-cache.ts:57-59` (the corpus stamp and the FAQ-cache entry/index keys) · rate-limit prefixes `rate-limit.ts:25-29` and `api/visit/route.ts:43` |
| Nav height `3.5rem` / `h-14`, and the open-to-work banner height `2.3125rem` | `src/components/site-nav.tsx:67,70` · `src/components/ui/skeleton.tsx:106` (`SkeletonViewTransition`) · `chat-view.tsx:79-81` · `game/developer-view.tsx:38-41` · `globals.css:94-97` (`scroll-padding-top`) · the banner literal in `chat-view.tsx:80` / `developer-view.tsx:40` must equal `OPEN_TO_WORK_BANNER_HEIGHT_REM` (exported from `src/lib/writing-flags.ts`, `:34`) — spelled out as literal Tailwind classes because the JIT scanner cannot see interpolated ones |
| View-transition names | `view-router.tsx:56` (`view-body`) · `site-nav.tsx:68` (`site-header`) · `globals.css:388-430`; direction is stamped on `<html data-view-dir>` at `view-context.tsx:207-210` and consumed at `globals.css:401-413` |
| Résumé label / variants | `src/lib/profile.ts:139-145` (`resumeVariants`, one entry) · `src/lib/mcp-tools.ts:25` (`RESUME_ROLES`) and `:29-35` (`ROLE_TO_LABEL`) · the PDF `public/resume/Sairam_Resume_MX_E.pdf` — re-adding a role is a three-place edit or `get_resume_variant` returns `notFound` (`mcp-tools.ts:31-33`) |
| Article `source` enum | `velite.config.ts:150-157` · `src/components/platform-badge.tsx:5-23` (`ArticleSource`, `SOURCE_CONFIG`) · `src/app/articles/page.tsx:34-41` (`SOURCE_LABELS`) · `src/app/articles/[slug]/page.tsx:31-38` (its own `SOURCE_LABELS`, rendered at `:111`) · `articles/[slug]/opengraph-image.tsx:20-27` (`SOURCE_LABEL`). **All four maps are keyed by `ArticleSource` (`platform-badge.tsx:5-11`), so adding a source to the Velite enum without adding it everywhere is a `tsc` error.** `opengraph-image.tsx` was the exception — `Record<string, string>` with a `?? "> article"` fallback — and it had silently drifted two members behind (`devto` and `hashnode` missing; the file's own comment counts 8 of 14 published articles, 9 of 15 files, rendering the generic `> article`). Widening any of these back to `Record<string, …>` re-opens the hole, because the fallback then absorbs the omission instead of failing the build |
| Terminal command visibility filter | `src/components/game/terminal/commands.ts:745-747` (`COMMAND_NAMES`) · `terminal.tsx:17-19` (independent re-filter for the fuzzy dropdown) |
| Terminal input selector | `terminal.tsx:302` (`aria-label="Terminal command input"`) · `terminal-overlay.tsx:40-42` (queries that exact string) |
| CSP `frame-ancestors` string | `next.config.ts:41` (the literal) · `:256-259` (the replace that depends on it) |
| Palette `value` pinning | `command-palette-content.tsx:361` (`copy-email`), `:478` (`voice-tts`), plus six other voice actions (`voice-pick` `:415`, `voice-settings` `:429`, `voice-engine` `:506`, `voice-stt-engine` `:534`, `voice-surface` `:563`, `voice-wake` `:588`) — cmdk re-scores when a label mutates |
| `MDXContent` ↔ CSP | `src/components/mdx-content.tsx:14-17` · `next.config.ts:43-51` (`'unsafe-eval'`) |
| `.md` passthrough (two implementations) | `next.config.ts:305-319` (4 rewrites → `/api/md/*`, plus the page rule at `:313` → `/api/md/pages/:page`, subsystem 12) · `src/app/<collection>/[slug].md/route.ts` (4 filesystem handlers) and `src/app/api/md/<collection>/[slug]/route.ts` (the rewrite targets). Both are thin wrappers around the one `markdownForContent` (`src/lib/markdown-content.ts`: frontmatter strip, `content/` read from disk, a Markdown 404 when the slug is not in the content layer); resolution order not exercised. The collection lookup runs before the file read, which is the only path-traversal guard; since the consolidation it lives in one place and `markdown-content.test.ts` has a test that a traversal slug never reads outside the content folder. |
| Admin credential predicate | `src/lib/admin-auth.ts:24` (`isAdminAuthorized`) is the single implementation; callers `proxy()` (`src/proxy.ts:173-182`), `src/app/admin/telemetry/page.tsx:470`, and `requireAdmin` (`admin-auth.ts:48`) → `api/admin/faq-cache/purge/route.ts:33`. The admin matcher entry (`proxy.ts:41-59`) covers only `/admin/:path*`, so every `/api/admin/*` route must call `requireAdmin` itself |
| Cron secret predicate | `src/lib/cron-auth.ts:15` (`hasValidCronSecret`) ← the five cron routes via `unauthorizedUnlessCron` **and** `rate-limit.ts:100` (limiter bypass); the eval cron's outbound `Authorization` + `X-Chat-Skip-Cache` headers (`eval/route.ts:123,126`) are what the bypass and `chat/route.ts:288` read. `cron-auth.routes.test.ts:19-25` lists the routes it covers |
| Rate-limit class ↔ route | `src/lib/rate-limit.ts` (`RateLimitClass` at `:19`, prefixes `:25-29`) ↔ callers `chat/route.ts:145`, `tts/route.ts:70`, `tts-google/route.ts:68`, `transcribe/route.ts:64`, `error/route.ts:102`; each pairing is pinned by a test — the three voice routes by `voice-rate-limit-class.test.ts`, `chat` by `chat/route.test.ts:131-137`, `beacon` by `error/route.test.ts:266-272` — but a new route is pinned by nothing |
| Extension-less pages ↔ the Markdown proxy | `PAGE_TWINS` (`src/lib/page-twins.ts:16-27`, ten pages) and `HTML_ONLY_PAGES` (`src/lib/markdown-routing.ts:27`, three) ↔ the `page.tsx` files under `src/app` (19 at this tree): a page missing from both lists is answered with a Markdown 404 when the client asks for Markdown. Gate: `src/lib/markdown-routing.test.ts` walks `src/app`; `page-twins.test.ts` ties the twin list to pages that exist. The ten names are also spelled in the `next.config.ts` copy (`:91-102`) and in the page rewrite (`:313`), which `src/next-config.test.ts` ties to `page-twins.ts`. The same slug pattern is spelled in `CONTENT_TWIN` (`markdown-routing.ts:33`), in the `next.config.ts` `headers()` source (`:296-299`) and in the rewrites (`:314-317`); `src/next-config.test.ts` pins the config side. |
| Voice surfaces ↔ BuildGraph gate | `voice-surface-mutex.ts:31` (`VoiceSurfaceId`: `modal` \| `inline` \| `core`) ↔ the three stores (`talk-overlay-store.ts`, `anvil-inline-store.ts`, `anvil-core-store.ts`) ↔ `game/build-graph.tsx:35-38` (ORs the same three "open" hooks so only one GL context is live) ↔ `header-orb-trigger.tsx:68-79` and `command-palette-content.tsx:437-439` (both gated by `isVoiceViewActive`, `voice-surface-mutex.ts:27`; the palette gate is pinned by `command-palette-content.dom.test.tsx:123-140`, the orb gate by no test). A fourth surface must be added to all of them |
| Dark notes | `src/lib/content.ts:57-66` (`publishedNotes` raw vs `allNotes` gated) ↔ the `/notes` route files, the only readers of `publishedNotes` (`notes/[slug]/page.tsx:26`, `notes/[slug]/opengraph-image.tsx:13`) ↔ `src/lib/notes-dark.test.ts` (llms.txt, feed, MCP, corpus, `.md` handlers); the `/api/v1/notes` list is empty and its items are 404s while the notes flag is off (`v1-notes.test.ts`, which also pins the flag-on answers), and the `notes` page twin is the Markdown 404 (`page-markdown.test.ts`) |
| Decisions ledger | Velite fields (`decisions` on Project, `constraints` / `tradeoffs` on Work — `velite.config.ts:70,97-98`) → `src/lib/decisions.ts:23-65` (`allDecisions`, one flat typed ledger) → the `/decisions` client page (`src/app/decisions/page.tsx:7,33-34`) and MCP `list_decisions` (`mcp-tools.ts:365-377`, registered at `api/mcp/[transport]/route.ts:127-137`); gate `src/lib/decisions.test.ts:15-93` — every populated source field has an entry, every entry matches its source verbatim, hrefs match `/^\/(work\|projects)\/[a-z0-9-]+$/`, ids are unique — and it is build-blocking |
| Public API paths | `src/proxy.ts:44-53` (the matcher entries) ↔ `src/lib/public-api-paths.ts:13-62` (`isPublicApiPath`) ↔ the operations documented in `openapi-v1.ts` and `openapi-legacy.ts`: a path in the predicate but not in the matcher never reaches the proxy, so its responses lose `API-Version` and the `RateLimit` fields. Gate: `src/lib/public-api-paths.test.ts` (Next's `unstable_doesMiddlewareMatch` against every documented path). |
| Public API numbers (version `1`, 300 per 60 s, 180 days) | `src/lib/api-policy.ts:12-45` ← the OpenAPI `info.description`, `/developers`, `llms.txt` "Developer resources", `GET /api/v1` (`src/app/api/v1/route.ts:10-31`), `privacy-facts.ts:18-20` (pinned by `privacy-facts.test.ts`, which also checks the limiter never touches Redis) and the `api-v1-index` smoke check. Changing a number is a one-line edit in `api-policy.ts`; the tests fail where a copy was typed instead of read. |
| The `clientIp` helper (4 copies) | `src/lib/rate-limit.ts` · `src/lib/telemetry/with-trace.ts` · `src/app/api/visit/route.ts` · `src/lib/public-api-limit.ts:135-141`, all deliberately duplicated; gate `src/lib/client-ip-consistency.test.ts:26-31` (the enumerated copies) and `:102` (a discovery check that fails on an unlisted one). |
| API error codes (8) | `src/lib/api-error.ts:20-73` (`API_ERROR_CODES`) ↔ the `Error` schema in the OpenAPI document ↔ the errors table on `/developers#errors` ↔ the source files that emit them; gates `api-error.test.ts` (every code bound to one status and emitted somewhere), `openapi.test.ts` and `agent-pages.dom.test.tsx`. |
| Batch registry ↔ OpenAPI ↔ route files | `BATCH_ROUTES` (`src/lib/batch.ts:55-111`, 14 rows with the query parameters each route reads) ↔ the GET operations of `buildV1Paths()` (`openapi-v1.ts`) ↔ the `src/app/api/v1/**/route.ts` files. A new `/api/v1` GET route that is not added to `BATCH_ROUTES` is silently not batchable; a stale row is a dead operation. Gate: `batch.test.ts` pins the list to the OpenAPI document, parameters included. |
| Batch limits and counting rule | `BATCH_MAX_REQUESTS` 25, `BATCH_MAX_BODY_BYTES` 16384, `BATCH_MAX_RESPONSE_BYTES` 1048576 (`api-policy.ts:33-35`) ← `batch.ts` (the checks), the `runBatch` operation text in `openapi-v1.ts`, `/developers` (`developers-content.ts:181-199`), `llms.txt:101`, `RATE_LIMIT_POLICY_TEXT` (`api-policy.ts:116`, "counts as one request") and the CLI (`cli/lib/constants.mjs`, pinned by `tests/cli/drift.test.ts`); the literals are pinned in `api-policy.test.ts` without reading the constants. |
| Method table ↔ proxy ↔ route stubs | `METHOD_EXCEPTIONS` (`public-api-paths.ts:48-50`) ↔ the proxy's 405 and `OPTIONS` answers (`proxy.ts:132-154`) ↔ the batch route's own stubs (`batch/route.ts:52-58`): all three must name `POST, OPTIONS` for the batch path and `GET, HEAD, OPTIONS` elsewhere (the OpenAPI 405 responses document only a generic `Allow` header, `openapi-parts.ts:98-103`). Gates: `public-api-paths.test.ts`, `proxy.test.ts`, `batch/route.test.ts`. |
| `x-read-only` ↔ the document's opening sentence | An operation marked `x-read-only: true` (`runBatch`, `callMcpServer`) ↔ `postRoutesSentence` (`openapi.ts:115-135`), which says "read-only" only of marked POSTs; `openapi.test.ts` fails for an unmarked POST. A new POST route must be marked or described neutrally. |
| MCP parameters ↔ page ↔ route | `TOOL_INPUT_SHAPES` (`mcp-tools.ts`) is read by the route's registrations and by `src/app/mcp/page.tsx` (the parameter lines it lists come from the advertised JSON Schema); `mcp/page.tsx` also keeps the hand-written `TOOLS` table, which `tools-documented.test.ts` ties to the route's `registerTool` calls. |
| The CLI ↔ the site | `cli/lib/commands.mjs` (the command and flag tables) ↔ `CLI_COMMANDS` in `src/lib/developer-tools.ts:49-112` (the site's copy, pinned by `developer-tools.test.ts`) ↔ `cli/lib/constants.mjs` (API version and header, slug rule, batch limit, canonical origin; pinned to `src/` by `tests/cli/drift.test.ts`) ↔ `CLI.published` (`developer-tools.ts:38`), which drives the wording of the `/developers` CLI section, its Markdown twin and the `llms.txt` line, and must change in the same commit as the status block between the `status:unpublished` markers of `cli/README.md` and the "Once published:" lead-in (present while the flag is false, absent now that it is true; `tests/cli/readme.test.ts`). |
| JSON-LD lists ↔ the sections they describe | `featuredWorkItemList` / `featuredProjectsItemList` / `latestArticlesItemList` (`json-ld-lists.tsx`) ↔ the data the homepage sections render (`allWork`, `featuredProjects`, `homeArticleGroups()`); the article list, the `WritingPreview` card and the homepage Markdown twin share `home-articles.ts` and `article-href.ts`. Gates: `json-ld-lists.dom.test.tsx`, `json-ld-articles.dom.test.tsx`, `json-ld-parity.dom.test.tsx` (the project and work entities equal their own pages'; the `contributor` / `author` difference is pinned), `home-markdown-articles.dom.test.tsx`. |
| `/developers` sections ↔ the Markdown twin | `sections/index.ts` ↔ `page.tsx` ↔ `page-markdown-prose.ts:38-49` (`developers` registers `Object.values(sections)`): a component the page uses that `index.ts` does not export is read through by the converter and vanishes from `/developers.md` without an error. Gate: `sections.test.ts` (completeness, functions under 50 lines, files under 500) and `page-markdown.dom.test.tsx`. |

---

## Entry-point cheat sheet

"If you want to change X, start at file Y." All paths are repo-relative to the repository root (the
`Anvilry` checkout).

| If you want to change… | Start at | Then also touch / be aware of |
|---|---|---|
| Add or edit a case study / OSS project / note / article | `content/<collection>/<slug>.mdx` (or `make new-work SLUG=…`) | Run `pnpm content`. A new work/project **requires** a matching node in `src/lib/graph-data.ts:18` (`graphNodes`) and an entry in `src/lib/game-model.ts:36` or `game-model.test.ts:22-58` fails `pnpm build`. A new public project also moves `impactMetrics` (`profile.ts:68` is `publicProjects.length`; a project with `visibility: private` is listed but not counted, and `repoLink()` hides its repo link), so `npx tsx scripts/seal-claims.ts` fails in CI until `--write` re-seals `data/integrity-chain.json`. |
| Add a page that should have a Markdown twin (or add any new extension-less page) | `src/app/<path>/page.tsx`, then `src/lib/markdown-routing.ts` | A content page under `/projects`, `/work`, `/articles` or `/notes` is covered by `CONTENT_TWIN`; any other new page goes into `PAGE_TWINS` (`src/lib/page-twins.ts:16-27`, and its name into the copies at `next.config.ts:91-102` and `:313`) if it should have a Markdown twin, or into `HTML_ONLY_PAGES` (`:27`) if it should not, or a Markdown client is told it does not exist. `src/lib/markdown-routing.test.ts` fails first. Add it to the sitemap's static list (`src/app/sitemap.ts:13-23`) if it is public. |
| Change a JSON error, or the 405 a route answers | `src/lib/api-error.ts` (`API_ERROR_CODES`, `apiError`, `methodNotAllowed`) | The catalogue is rendered on `/developers#errors` and documented in `/openapi.json`; `apiError` throws on a status/code pair the catalogue does not list. Guards: `api-error.test.ts`, `src/app/api/method-not-allowed.test.ts`, `openapi.test.ts`. |
| Add or change a content **field** | `velite.config.ts` (the relevant `defineCollection`) | Make it `.optional()` or every existing file fails validation at once. Then `src/lib/content.ts`, plus any projection that should surface it. |
| Change how content is sorted / filtered / subsetted | `src/lib/content.ts:19-96` | `pinned` without `pinRank` is dropped (`:36-38`); notes/articles sort by ISO **string** compare (`:62,:93`). Notes are hidden here, at the data layer: `allNotes` is `[]` while `NOTES_ENABLED` is off (`:66`) and note-only articles are dropped (`:92`). |
| Change what the chatbot knows | `src/lib/corpus.ts:13-96` | Guarded by `src/lib/corpus.test.ts`. `register` flows verbatim from `:17`. Also feeds `/llms-full.txt` and the terminal `grep` (`commands.ts:180`). |
| Change the LLM model chain, provider, or credentials | `src/lib/llm.ts:45-47` (the `LLM_USE_SONNET_5` toggle, with `isSonnet55PrimaryEnabled()` right after it and `isOpusFallbackEnabled()` at `:75-77`), `:102-137` (`buildChain()` and both chains), `:182-222` (`thinkingEffort()`, `adaptiveThinking()`), `:244-246` (provider), `:255-282` (creds/region) | `src/lib/llm.test.ts` pins model ids across both providers and both toggle states (`describe("LLM_USE_SONNET_5 toggle")`, `:1171`). Add a row to `PRICES` (`src/lib/llm-pricing.ts:57-95`) for any new Bedrock id: without one `llm-pricing.test.ts` fails, and at runtime the event omits `cost_usd` instead of guessing. |
| Change the streaming fallback rule | `src/lib/llm.ts:758-760` (`goingToApology = emittedAny \|\| isLast \|\| !isFallbackEligible(err)`; `isFallbackEligible` `:337`) | `emittedAny` (declared `:477`, set `:691`) also gates trace-frame emission (`:731`), the FAQ-cache `answerText` (`:723`), its `reasoningText` when non-empty (`:725`) and the thinking sentinel (`:598`). Pinned by `src/lib/llm.test.ts`'s "emittedAny invariant (load-bearing)" (`:478`), "v1.8 usage capture" (`:154`), "extended thinking" (`:635`) and "reasoningText capture" (`:2431`) describe blocks. |
| Change chat request limits / validation | `src/app/api/chat/route.ts:27-28,163-166,177-261` | `MAX_MESSAGES`, `MAX_CHARS`, the 2 MB declared-length ceiling (header only), the 10000-char PDF-block cap, the mediatype allowlists. |
| Change the FAQ response cache | `src/lib/chat-cache.ts` (TTL `:68`, index cap `:71`, answer bound `:84`, reasoning bound `:90`, reasoning question bound `:96`, semantic threshold `:298`, kill switch `:159-161`, corpus tag `ownDeploymentTag` `:193-195` and `getCurrentCorpusBuildTag` `:200-209` (chosen in `faqCacheGet` `:273-277`), reasoning normalizers `replayableReasoning` `:173` and `withReplayableReasoning` `:182`, Upstash echo cut `withoutCommandEcho` `:225`, over-bound warning that logs the length only `:379-381`) | Lookup `chat/route.ts:288-367` (first-turn string questions only; hit frame carries `cacheHit: true`, header `X-Chat-Cache: hit`; an exact-tier hit whose entry stores a summary, with `EXTENDED_THINKING` not `"false"`, sends `THINKING_SENTINEL` + summary + `THINKING_END` ahead of the answer, the live framing, `:313-318,356-358`), write-through `:456-480` (skipped for an answer from a fallback rung; `attempt.reasoningText` is the sixth `faqCacheSet` argument, `:478`); embeddings in `src/lib/faq-embeddings.ts` (Titan v2, 512 dims); emits telemetry kind `chat.cache` (a hit carries the boolean `reasoning_replayed`, never the text, `chat/route.ts:341`); `chat-cache.test.ts`, and for the replay `chat/route.test.ts:514` (hit path) and `:776` (round trip over an in-memory Redis). The eval cron bypasses it with `X-Chat-Skip-Cache`, so it never gets a replay. |
| Purge a bad cached answer | `POST /api/admin/faq-cache/purge` with Basic auth and `{ "question": "…" }` (`purge/route.ts:32-72`) | Removes the entry (and its index member) keyed by the normalised question (`chat-cache.ts:135-149`); returns 503 when Redis errors or is not configured, 200 `not_found` when nothing matched (`chat-cache.ts:465-485`). |
| Change the chat wire protocol | `src/lib/llm-trace.ts:19-25` | Pinned byte-for-byte by `src/lib/llm-trace.test.ts`. `use-chat.ts:59-116` parses it; `api/cron/eval/route.ts:138` parses a complete body with `answerFromBody` (`llm-trace.ts:67-75`); the FAQ-cache hit path assembles the same framing itself for a replayed exact-tier hit (`api/chat/route.ts:356-358`), so it has to change in step. |
| Add a card or command token the model can emit | `src/components/chat/parse-cards.ts:29-33` (grammar) + `:54-68` (resolution) | Charset is locked to `[a-z0-9-]`. Dispatch lives in `chat-messages.tsx:323-338`. Gate: `parse-cards.test.ts`. |
| Change markdown rendering of assistant text | `src/components/chat/markdown-message.tsx:47-95` | Do not remove `skipHtml` or override `urlTransform` — that is the XSS posture (`:9-16`). |
| Add or reorder a **view** | `src/components/view-context.tsx:24-45` (union, `VIEWS`, `VIEW_ORDER`) | Then `view-router.tsx:62-69`, `enabled-views.ts:20-21`, `view-switcher.tsx:25-59,101-104`, and `parse-cards.ts:60-63` (which validates `cmd:view` against `VIEWS`). `view-context.test.ts` pins the SSR default. |
| Change the view-transition animation | `src/app/globals.css:388-430` | The named groups come from `view-router.tsx:56` and `site-nav.tsx:68`; direction from `view-context.tsx:207-210`. |
| Change SSR/first-paint view behaviour | `src/components/view-context.tsx:90-91` | `getServerSnapshot` must stay `DEFAULT_VIEW` — `view-context.test.ts:30-35` is the guard. |
| Add or change a voice engine | `src/lib/voice-catalog.ts` (add to `CURATED_VOICES` `:134` / `EXTENDED_VOICES` `:283`) | Three lookup Maps build at module load (`:298-312`); adding a voice anywhere else leaves it un-lookupable and un-allowlisted. Then `use-speech-synthesis.ts` and, for a new server engine, a new `api/tts-*` route + cache and a `voice`-class `checkRateLimit` call. |
| Change voice defaults or add a persisted setting | `src/lib/voice-settings-context.tsx:77-88` (`DEFAULTS`) + `:129-158` (`parse`) | Every capability must stay default-OFF; `voice-settings-context.test.ts` asserts it. `parse` must never throw. |
| Add a voice surface | `src/components/chat/voice-surface-mutex.ts:31` (`VoiceSurfaceId`) | Create a store that calls `registerVoiceSurface` at module scope and `claimVoiceSurface` at the top of `open*()` (as `talk-overlay-store.ts:31,46` does); route to it from `header-orb-trigger.tsx:70-79`; add its open hook to the `talkOpen` OR in `game/build-graph.tsx:35-38`. |
| Change how the mic opens | `src/components/chat/use-speech-recognition.ts:162` | `continuous = false` is load-bearing for the whole half-duplex loop (`use-voice-session.ts:26-31`). `mic-button.tsx:59-64` is the consent gate. |
| Add an MCP tool | `src/lib/mcp-tools.ts` (the implementation, its Zod raw-shape schema and a `TOOL_INPUT_SHAPES` entry, `:486-497`) | Then register it in `src/app/api/mcp/[transport]/route.ts` with `inputSchema: T.TOOL_INPUT_SHAPES.<name>`, `annotations: T.READ_ONLY_TOOL_ANNOTATIONS` and `T.wrapToolResult()`, and add a row to the hand-written `TOOLS` table in `src/app/mcp/page.tsx:45` (the page lists each tool's parameters from `TOOL_INPUT_SHAPES`). The count has drifted and been fixed twice: 7→9, then 9→10. It is enforced, not just corrected: `src/app/mcp/tools-documented.test.ts` reads both the page's `TOOLS` block and the route's `registerTool` calls from source and fails the build if they disagree, and a second `describe` in the same file fails when a tool is registered with an inline or foreign schema instead of its `TOOL_INPUT_SHAPES` entry. If the data function returns an array, `wrapToolResult` wraps it in `{ items }` automatically (a bare array fails the SDK's `structuredContent` validation). A parameter should be optional so that a call without arguments keeps returning what it always did. Never import `personal.ts` (`mcp-tools.test.ts:34-56`). |
| Change the MCP not-found contract | `src/lib/mcp-tools.ts:136-148` | `mcp-tools.ts:393` (`wrapToolResult`, moved here from the route file) keys `isError` on the literal `notFound` property (`:394`, `:401`); renaming it turns errors into successes. |
| Add a telemetry span kind | `src/lib/telemetry/schema.ts:37-50` | The dashboard fetches every kind in `KIND_LITERALS` (`page.tsx:47`) but colours/summarises through switches (`:384,:414-416`), and `scripts/replay-trace.mjs:47-55` has its own hardcoded `KINDS` (already missing `chat.cache`). `schema.test.ts:138-155` pins the 8-kind union. |
| Change what is redacted from telemetry | `src/lib/telemetry/schema.ts:88-111` | Order is load-bearing (email → 32-char token → 12–19 digit run). Callers must redact **before** `emit` — `emit` does none (`emit.ts:30-35`). |
| Change telemetry retention | `src/lib/telemetry/emit.ts:42` (`SEVEN_DAYS_MS`) | The trim itself runs on only 1-in-20 writes (`TRIM_SAMPLE_EVERY`, `:54`; trim at `:85-94`). Also `scripts/replay-trace.mjs:64`, which computes its own `since` from the same window. |
| Add a dashboard tile | `src/app/admin/telemetry/page.tsx` | Add the Redis read to the `Promise.all` at `:493-`; every fetch helper must stay fail-soft (`:22-41,229-239,290-298`). Warn thresholds are inline magic numbers (`:548,598,620,742,761,772`). |
| Change `/admin` auth | `src/lib/admin-auth.ts:24-59` (the predicate) | One predicate, three callers: `proxy()` (`src/proxy.ts:173-182`), `requireAdmin`, and the telemetry page (`:470`) — edit the predicate, not the callers. Guards: `proxy.test.ts`, `admin-auth.test.ts`, `admin/telemetry/page.test.tsx`. |
| Add an authenticated route | `/admin/*` page: nothing to do — `src/proxy.ts:41-59` (the first `config.matcher` entry, `"/admin/:path*"`) already covers it (and re-check in the page as `telemetry/page.tsx:470` does). `/api/admin/*` route: call `requireAdmin(req)` first (`purge/route.ts:33`). | The proxy does **not** gate `/api/admin/*` (its `/api/:path*` entry wakes the proxy and the request passes on); nothing enforces the call. |
| Add a cron job | `vercel.json:3-7` + a new `src/app/api/cron/<name>/route.ts` | Start the handler with `const denied = unauthorizedUnlessCron(req); if (denied) return denied;` (e.g. `github-sync/route.ts:19-20`), add the route to `cron-auth.routes.test.ts:19-25`, and set `maxDuration`. All five existing crons are fail-closed on `CRON_SECRET`. |
| Change the CSP or a security header | `next.config.ts:37-85,119-147` | `'unsafe-eval'` is required by `MDXContent`; the three speech WebSocket hosts keep voice working in Chrome/Edge; the `/resume` override is a literal string replace of `:41` (at `:256-259`). HSTS is deliberately absent. |
| Change rate limits | `src/lib/rate-limit.ts:21-29` (budget, classes, prefixes) | A new route calls `checkRateLimit(req, cls)` with the right class **and** gets a test pinning it, as each of the five existing routes has. `/api/visit` has its own (`api/visit/route.ts:39-46`). Both fail-open paths are deliberate (`:99,:106-109`); a valid `CRON_SECRET` bearer bypasses (`:100`). |
| Add a build-time feature flag | `src/lib/writing-flags.ts` (or a component-local read) | Match the `=== "true"` convention (only `ARTICLES_ENABLED` is `!== "false"`). Read it **inside** a function body if a test needs `vi.stubEnv`. Then `.env.example`, `docs/configuration.md`, and `Makefile:155-180` (`flags-show`). |
| Migrate a flag to runtime toggling | `src/lib/flags.ts:17-29` | Also declare it in `src/app/.well-known/vercel/flags/route.ts:9-24`; requires `FLAG_DRIVER=vercel` + `FLAGS_SECRET`. `FLAG_DRIVER` is captured at module load (`:13`). |
| Gate which views exist in a build | `src/lib/enabled-views.ts:20-43` | Unset ⇒ all on; empty string ⇒ every toggleable view off. `classic` and `resume` cannot be disabled. |
| Change a 3D scene | `src/components/hero-graph/scene.tsx` · `hero-avatar/avatar-scene.tsx` · `game/build-graph-scene.tsx` · `chat/voice-orb-3d.tsx` | Import from `@/lib/r3f`, never directly (`scene-physics.tsx:4-6` and `voice-orb-3d.tsx:5-6` are the exceptions). On a demand frameloop something must call `invalidate()`. |
| Change when 3D mounts at all | `src/components/hero-graph/index.tsx:63-64` · `hero-avatar/index.tsx:56` · `game/build-graph.tsx:50` · `chat/voice-orb.tsx:42` | All four gates include the desktop + reduced-motion terms; the hero gates also include `view === "classic"`; hero-graph, build-graph and voice-orb also include the WebGL probe and an `onFail` latch. |
| Swap the avatar model | `public/avatar/sairam.glb` + `src/components/hero-avatar/avatar-mesh.tsx:10,27,54` (path in 3 places) | `src/lib/avatar-glb.test.ts` blocks the build on size (<1.5 MB), glTF 2.0, meshopt+quantization+WebP, named bones, and the current **zero** morph targets (`:132-157`). |
| Add a terminal command | `src/components/game/terminal/commands.ts:689-722` (registry) | 32 entries today (28 visible + 4 hidden eggs: `secret`, `personal`, `uses`, `now`). Keep `COMMAND_NAMES` `!hidden`-filtered (`:745-747`) **and** the independent re-filter at `terminal.tsx:17-19`. Return a `NavAction`; never import the router. |
| Change build ordering or add a build step | `package.json:11` | The `&&` chain is the deploy gate (velite → vitest → next build → `scripts/build-search-index.mjs`). `lint` and `tsc --noEmit` are CI-only (`ci.yml:57-61`), as is the bundle budget (`ci.yml:190-191`). Do **not** add `--webpack` to `build`: it silently stops `.next/diagnostics/route-bundle-stats.json` being written and the budget gate then fails by design (`scripts/bundle-budget.mjs:107-111`). |
| Raise the first-load JS budget, or profile what is in a chunk | `scripts/bundle-budget.mjs:72` (`MAX_FIRST_LOAD_BYTES`) · `pnpm analyze` (`package.json:12`) for attribution | Raise the constant in its **own** commit quoting measured before/after bytes (`:69-71`) — never by adding `continue-on-error` to the step. `pnpm analyze` is local-only, needs the explicit `--webpack`, and writes `.next/analyze/{client,edge,nodejs}.html`; re-run `pnpm build` afterwards or the gate has no artifact to read. |
| Change the test runner setup | `vitest.config.ts` | Do not remove `env: { NODE_ENV: "test" }` or the `node` project's `dom` exclude. `testTimeout: 30_000` and `hookTimeout: 60_000` (`:32-33`) are there for the Vercel build, which runs the whole suite in parallel on a loaded container; they only bound a hang, so a test must still not depend on wall-clock time. The `dom` project's `setupFiles` (`:50-51`) loads `tests/setup/dom-async-timeout.ts`, which sets Testing Library's `waitFor` limit to 10 s (its default is 1 s); an explicit shorter `timeout` option on a `waitFor` call would undercut it, so none remains. Both projects' `tests/**` globs are live: `tests/cli/**` runs in the `node` project. |
| Change E2E coverage | `e2e/views.spec.ts` · `e2e/resume.spec.ts` · `playwright.config.ts` | `webServer` runs `pnpm start`, so CI builds first (`ci.yml:175-177`); both a `chromium` and a `mobile-safari` project run. E2E does not block `pnpm build`. |
| Point a custom domain at the deployment | `src/app/layout.tsx:40` (`siteUrl`) | Then the rest of the base-URL set (22 non-test files / 26 lines; plus `src/lib/mcp-tools.test.ts:104,117` and the `next.config.ts:247` comment) — the enumerated table in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url) is the single authority — and `content.ts:79`, which is functional (coupling table above). |
| Regenerate the search index | `pnpm build` (last step, `package.json:11`) or `make search-index` (`Makefile:65-66`) | The index needs the prerendered HTML (`.next/server/app`, or `.next/server/route-cache/APP_PAGE/` under a deployment adapter), so it can only follow `next build`; `pnpm search-index` does not exist and both entry points run `node scripts/build-search-index.mjs`. Output goes to the untracked `public/pagefind/`. |
| Add or bump a dependency | `package.json:23-80` (35 prod + 19 dev) | Respect the exact pins (`next` `16.4.3` / `eslint-config-next` `16.4.3`, `react`/`react-dom` `19.3.0`, `@modelcontextprotocol/sdk` `1.32.0`, `@react-three/postprocessing` `3.1.1`), the `three < 0.187.0` ceiling from `postprocessing` (`pnpm-lock.yaml:4132`), and the 14 overrides — which live in `pnpm-workspace.yaml:18-47`, **not** a `pnpm` field in `package.json`. `vite` is a declared devDependency (`^8.1.6`, `package.json:77`; resolved `8.3.5`, `pnpm-lock.yaml:4744`) next to `vitest` (`^5.0.3`, `package.json:78`; resolved `5.0.5`, `pnpm-lock.yaml:4787`). A new dependency with an install script needs an `allowBuilds` decision (`pnpm-workspace.yaml:84-87`) or `pnpm-build-allowlist-consistency.test.ts` fails the deploy. |
| Add a Dependabot hold | `.github/dependabot.yml` | It is read from the **default branch only** — on any other branch it is inert. `ignore` entries accept a version-scoped `versions: ["x.y.z"]` form as well as a bare package name. |
| Replay one request end to end | `make trace TRACE_ID=…` → `scripts/replay-trace.mjs` | The id comes from the `x-anvilry-trace-id` response header (`with-trace.ts:207`). Needs both Upstash vars; window is 7 days; FAQ-cache spans are not replayed (see the coupling table). |
| Change the public API rate limit, the version or the notice period | `src/lib/api-policy.ts:38-45` (`DEPRECATION_NOTICE_DAYS`, `RATE_LIMIT_POLICY`) | Nothing else needs editing: the OpenAPI description, `/developers`, `llms.txt` and the headers read the constants. `PRIVACY_FACTS.publicApiRequests` / `publicApiWindowSeconds` (`privacy-facts.ts:19-20`) must follow or `privacy-facts.test.ts` fails, and `lastUpdated` should move with the privacy text. |
| Add a public path (a file, an endpoint, a twin) | `src/lib/public-api-paths.ts:13-62` **and** the matcher in `src/proxy.ts:44-53` | They must agree (`public-api-paths.test.ts`). A path that costs money (`/api/chat`, the voice routes) or is operator-only stays out. |
| Add a `/api/v1` route | `src/app/api/v1/<name>/route.ts`, a row in `src/app/api/v1/v1-test-support.ts` (`ROUTES`), the path in `src/lib/openapi-v1.ts` and its schema in `openapi-v1-schemas.ts` | A GET route must also join `BATCH_ROUTES` in `src/lib/batch.ts:55` (with the query parameters it reads), or it is silently not batchable; `batch.test.ts` compares the registry with the OpenAPI document and fails when they disagree. A route that reads the request needs the JSON 405 stubs and `withJsonErrors`; a static one must export `GET` only. `v1-contract.test.ts` validates the real answer against the schema in strict mode. |
| Deprecate a surface | `DEPRECATIONS` in `src/lib/api-policy.ts:61` | At least 180 days between `deprecatedOn` and `sunsetOn` (`givesEnoughNotice`, `api-policy.test.ts`); the proxy then sends `Deprecation`, `Sunset` and a successor `Link` on every matching response. |
| Add or change a page that agents read | `src/lib/page-twins.ts:16-27` (twin) or `HTML_ONLY_PAGES` (`src/lib/markdown-routing.ts:27`) | A twin also needs the name in `next.config.ts:91-102` and a builder (`page-markdown-lists.ts`) or an entry in `PROSE_PAGES` (`page-markdown-prose.ts:38-49`); a prose page must stay free of async components. |
| Change the batch limits, or what a batch may run | `src/lib/api-policy.ts:33-35` (the three numbers) and `BATCH_ROUTES` in `src/lib/batch.ts:55` | The numbers are read by `batch.ts`, the OpenAPI text, `/developers`, `llms.txt` and the CLI's copy (`cli/lib/constants.mjs`); `api-policy.test.ts` pins the literals, so changing one is a deliberate two-place edit. Never put the batch endpoint, admin, cron, chat, voice, MCP or an unversioned alias in the registry. |
| Release a new version of the `anvilry` CLI | Bump `version` in `cli/package.json` (0.1.1, a README-only patch, is prepared in the repository; the registry's latest is 0.1.0 until the owner publishes it), check `cd cli && npm pack --dry-run`, then publish by hand with the owner's npm credentials (steps in `cli/README.md:142-152`) | `CLI.published` is already `true`: the flag, the README status block, the lead-in and the release gate were handled in the change that first published (`developer-tools.test.ts:46` pins the flag; lower it only if the package is withdrawn). `tests/cli/readme.test.ts` fails if a status block or lead-in comes back while the flag is true. A new command or flag also goes into `CLI_COMMANDS` (next row). |
| Add or change a CLI command or flag | `cli/lib/commands.mjs` (the table), then `cli/lib/plan.mjs` and `report.mjs` | Mirror it in `CLI_COMMANDS` (`src/lib/developer-tools.ts:49-112`) and the help text; `developer-tools.test.ts` and `tests/cli/drift.test.ts` fail when the site and the package disagree. The package has no dependencies and must keep none (`tests/cli/package.test.ts`). |
| Add or change a `/developers` section | `src/app/developers/sections/<file>.tsx`, then export it from `sections/index.ts` and place it in `src/app/developers/page.tsx` | `sections.test.ts` fails when a component is not exported by `index.ts` (it would vanish from `/developers.md`), when a function passes 50 lines or a file 500; `page-markdown.dom.test.tsx` compares the twin with the page. |
| Add a JSON-LD block or list | `src/components/json-ld.tsx` (entities and `JsonLdScript`), `json-ld-lists.tsx` (homepage lists), `json-ld-api.tsx` (API entities) | Serialise only through `JsonLdScript` / `safeJsonLd`, which escape `<`, `>`, `&`, U+2028 and U+2029 (`json-ld.dom.test.tsx` checks every component of the file does); build a list from the data its section renders, and add the parity test. Entity URLs go through `stripTrackingParams`, visible links do not. |
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
  `kindBadge` at `:414`) but never emitted: TTS/STT failures surface as `server.error` (`tts/route.ts:189`,
  `tts-google/route.ts:169,220`, `transcribe/route.ts:122`) and no success-path event exists, so the dashboard's
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
  (`chat/route.ts:40-41`) and the `eval`, `github-sync` and `seo-audit` crons (`eval/route.ts:105-106`,
  `github-sync/route.ts:32-33`, `seo-audit/route.ts:21`, each the `https://${process.env.VERCEL_URL}` ternary) —
  see *Still open*.
- **`/mcp` as `(force-static)`** — the documentation/source mismatch this index recorded is gone.
  `src/app/mcp/page.tsx` exports only `metadata` (`:14`) and a grep for `force-static` (and for
  `export const runtime | revalidate | dynamic`) across `src/` still finds no segment-config export — only
  comments that say one was removed (re-verified for a929932 plus the five fixes).
- **Whether `next build` still uses webpack by default in Next 16 — it does NOT, and the claim this index
  carried was FALSE.** It is **Turbopack**. The claim's only source was the now-deleted
  `bundle-analysis.yml`'s own comment ("`next build` uses webpack by default in Next.js 16 (Turbopack is
  opt-in via --turbopack flag, dev-only)"), which this index recorded as the repo's own claim rather than
  as fact — correctly cautious, and the caution was warranted. Nothing in this repo configures a bundler,
  and `node_modules/next/dist/lib/bundler.js:142-144` — "The default is turbopack when nothing is
  configured" — sets `process.env.TURBOPACK = 'auto'`; a local `.next/diagnostics/framework.json` reported
  Next.js 16.3.5 (before the 16.4.3 bump) next to a `route-bundle-stats.json` — an artifact only Turbopack writes
  (`node_modules/next/dist/build/index.js:2922-2923`) — so a default build there was Turbopack. `next dev`
  resolves its bundler through the same module (`parseBundlerArgs`, `node_modules/next/dist/cli/next-dev.js:214-216`). Two
  consequences, both recorded in § 10 The bundle budget gate: the deleted workflow's `ANALYZE=true` build
  could never emit a report, because `@next/bundle-analyzer` is webpack-only; and the artifact the
  replacement gate reads exists *because* the build is Turbopack. **What does not change:** the 876 KB
  single-chunk three.js result at `next.config.ts:185-196` was always a **Turbopack** measurement — its
  own text says the flag "does NOT collapse the R3F twin-chunk in Turbopack" (`:180-181`) — and
  `scripts/bundle-budget.mjs:76` re-measures the same chunk at 897,249 B. That invariant and
  `src/lib/r3f.ts`'s load-bearing role both stand; only the bundler attribution was wrong.
- **Whether `@react-three/offscreen` and `@react-three/rapier` were retained intentionally** — answered by
  deletion. Neither was imported anywhere in the repo, and **both were removed from `package.json` in
  v3.5.0** (prod dependency count 35 → 33 at that release; `package.json` lists 35 prod + 19 dev today
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
  now says so (`:13-14`) and imports the Node-only `isAdminAuthorized` (`:4`, `admin-auth.ts:1` imports
  `node:crypto`), which is what makes a constant-time compare possible at the first gate. See § 7.
- **Whether the E2E CI job is a required check, and whether `develop` is branch-protected — read live, not
  from the tree.** A GitHub API read on 2026-09-29 shows classic branch protection absent on both branches
  (`GET …/branches/<b>/protection` → 404) but an **active repository ruleset**, "anvilry protected branches -
  core", covering `refs/heads/main` and `refs/heads/develop` with no bypass actors and exactly three rules:
  `deletion`, `non_fast_forward` and `pull_request` (0 required approvals). It has **no**
  `required_status_checks` rule, so no CI job — E2E included — is a required check on either branch, and no
  required check disappeared when `bundle-analysis.yml` was deleted. (Earlier text, including this index and
  `CHANGELOG.md:1030`, recorded `protected: false` from the classic endpoint; the ruleset is why the branches
  API now reports `protected: true`.) **Update 2026-10-22:** the ruleset now also has a `required_status_checks` rule (`Lint · Type-check · Test` and `E2E (Playwright)`, GitHub Actions app id 15368, non-strict) and one bypass actor, the repository-admin role in `pull_request` mode, so a red E2E run (a bundle regression included) now blocks the merge of a pull request except through that bypass.
- **What generates `public/static/`, and the manifest screenshots defect.** `public/static/` is Velite's asset
  output directory (`velite.config.ts:171-173`: `assets: "public/static"`, `base: "/static/"`), untracked (git does not
  track empty directories) and empty because no MDX references an asset; the only other references are
  `src/lib/case-study-depth.test.ts:24-27` (the `diagram` frontmatter path convention) and
  `eslint.config.mjs:19` (ignore). The related defect this index recorded — `manifest.ts` declaring PWA
  screenshots at `/static/screenshot-{desktop,mobile}.png` with no such file, so both URLs 404 — is **fixed**:
  `src/app/manifest.ts` no longer has a `screenshots` key (`icons` at `:15-19` is the last entry) and the comment
  at `:20-25` records what was dropped, why, and how to re-add it. `src/app/manifest.test.ts` pins the current
  shape (`:66-72` asserts zero screenshots) and walks whatever *is* declared, so a re-added screenshot with no
  file behind it fails the build.

**Still open**

- **Which `.md` implementation serves a live request.** `next.config.ts:305-319` returns the bare-array
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
  gitignored build (the `.next` of 00:34 on 2 Nov, see section 01) and reflect that machine's flag values (notably whether
  `NEXT_PUBLIC_NOTES_ENABLED` was on). A production build with different `NEXT_PUBLIC_*` values prerenders
  a different slug set. Segment-config columns are read from source and are env-independent.
- **Whether `/articles/<slug>` routes that `redirect()` emit a prerendered page artifact.** Several slugs
  present in `generateStaticParams` have an `opengraph-image` manifest entry but no page entry — consistent
  with the redirect path, not proven.
- **Whether the CSP was ever actually deployed as `Content-Security-Policy-Report-Only`,** and the contents
  of the Playwright zero-violation sweep referenced at `next.config.ts:136-145`. No such audit script or spec
  was located in `e2e/` (`resume.spec.ts`, `views.spec.ts`).
- **Whether `SECURITY_ALERTS_TOKEN` is configured** (not inspectable from the working tree), so whether
  `ci.yml`'s `security-alerts` job reports anything today is unknown.
- **Whether Vercel sets HSTS by platform default** (`next.config.ts:119-120`) — asserted in a comment, not
  verifiable from this repo.
- **Whether the Vercel build shell sets `NODE_ENV=production`** (the stated reason for
  `vitest.config.ts:26`) — taken from the config comment.
- **Actual PDF text extraction under `pdfjs-dist` 6.2.108** (`package.json:48` declares `^6.2.108`). Commit
  `2f309d2` flags it as NOT VERIFIED (needs a real browser upload); build and typecheck pass but the
  extraction path was never exercised post-bump.
- **Whether migrating `zod` from `^3.25.76` to v4 breaks the raw-shape schema handoff** to `mcp-handler`'s
  `registerTool` (`src/lib/mcp-tools.ts:58-131`, `:354-361` and `:379-384`). The one constraining peer — `@modelcontextprotocol/sdk`
  — already permits v4 (`zod: ^3.25 || ^4.0`, `pnpm-lock.yaml:1012`; `mcp-handler@1.1.0` declares no `zod` peer,
  `:3712-3720`), but nothing in the repo exercises v4.
- **Whether `eslint.config.mjs`'s `globalIgnores` replaces or merges with `eslint-config-next`'s built-in
  ignores.** The comment at `:8` says "Override default ignores" and the list (`:9-22`) re-declares the four
  defaults (`:11-14`) before adding generated/build paths, implying replace; flat-config merge semantics were
  not verified against the installed package.
- **Runtime bundle boundaries** are inferred from `use client` directives, `dynamic()/ssr:false` wrappers,
  and route-handler placement — not from reading `.next/` chunk manifests. Narrowed: the first-load surface
  is no longer inferred at all, because `scripts/bundle-budget.mjs` reads Next's own per-route artifact in
  CI (`MIN_ROUTES = 17`, ceiling 988,000 B, three.js in 0 routes' first-load sets) — but that gate
  reports first-load bytes and chunk paths, not which module put them there, so *why* a boundary falls
  where it does is still inference. The three.js single-chunk figure is measured twice over:
  `next.config.ts:185-196`'s recorded build and `scripts/bundle-budget.mjs:76`'s 897,249 B. **Neither was
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
  caller gates it, `layout.tsx:140`); `home/resume-view.tsx:13-16` "ViewEscapeHatch auto-rendered by
  view-router" (`view-router.tsx` never renders it; the non-classic views mount it themselves — `chat-view.tsx:85`,
  `anvil-view.tsx:35`, `developer-view.tsx:45`, `game-view.tsx:32` — and `resume-view.tsx` does not);
  `anvil-core-surface.tsx:26` "~200px reactive orb"; `use-trace-runner.ts:69-70` "Reset when the scenario changes";
  the ReadyPlayerMe wording in `avatar-mesh.tsx:13,94` and `rig.ts:47,54` (the shipped asset is an Avaturn
  export); `avatar-mesh.tsx:19-21` ("only runs when invalidate() is called (mousemove or touchmove from
  AvatarControls)" — `useAvatarIdle` also invalidates every frame, `use-avatar-idle.ts:27`);
  `.env.example:128-129`
  (an unset `GOOGLE_TTS_API_KEY` "hides" the Google engine option from settings — nothing client-side reads the
  key, `voice-settings-dialog.tsx` lists every `TtsEngine`, and `tts-google/route.ts:40` only turns the request
  into a 503); the `github-sync/route.ts:6-17` docstring ("Hourly GitHub stats cache warm", "1 GitHub API call per hour") against
  `vercel.json:5` (daily, `0 8 * * *`) and the 5400 s key TTL (`github-sync/route.ts:53`) — the idempotency
  skip (`github-sync/route.ts:26-30`) can only fire for a manual or duplicate invocation within 90 minutes of a
  run, never on the next scheduled one. (The `.env.example` comments for `TELEMETRY_ENABLED` ("disables all event
  emission") and `ADMIN_PASSWORD` ("renders auth instructions"), and the matching `Makefile` `env-check` message,
  used to head this list; they were corrected together with this index and now describe the real behaviour —
  `TELEMETRY_ENABLED` only gates the `/api/error` beacon, `error/route.ts:93`; an unset `ADMIN_PASSWORD` is a bare
  401, `admin-auth.ts:26-31`.)
- **Stale in-file comments found in this refresh:** `next.config.ts:19-20` ("shipped as Report-Only first" —
  the header at `:146` is enforced); `src/app/search/page.tsx:6` (bundle "generated post-build by
  `make search-index`" — it is the last step of `pnpm build`); `scripts/bundle-budget.mjs:27` (the header's
  "16 routes" measurement, against `MIN_ROUTES = 17`) and `:70,75,164` (cite lines 127–149 of `next.config.ts`, now
  `:183-199`); `src/app/api/github/stats/route.ts:6-7` (cites line 101 of `github.ts`, now `:142`); `.github/dependabot.yml:80`
  ("Pinned to 3.0.4" — `package.json:34` pins `3.1.1`); `src/app/articles/[slug]/page.tsx:26-29` (cites
  `:59` for the external-article redirect — it is `:77-81` — and line 103 of `velite.config.ts` for the optional
  `externalUrl` — it is `velite.config.ts:158`).
- **Four stale-comment items listed in earlier editions are FIXED** by the comment sweep on the fix branch,
  and are dropped from the carried-forward list rather than renumbered: `graph-data.ts:3` no longer counts
  systems ("every flagship work system + every OSS repo … see `graphNodes` below for the count");
  `game-model.ts:28` reads "a graph node id that does NOT equal its content slug" (count-free) and names the one affected id; `scene.tsx:18-19` is
  count-agnostic ("Count is taken from `graphNodes.length`"); and `agent-trace.ts:13-16` no longer claims the
  test "BLOCKS shipping" (see [§ Tests as a gate](#tests-as-a-gate--what-that-actually-means)).
- **Subsystems 11 and 12 (the API-policy change, in no release yet) were read from the source and the tests, not
  observed on a deployment by this edition.** The 429 behaviour (the 301st request in a minute answers with
  `Retry-After: 60`) was checked on a production build by the author of the change and is not re-measured here.
  The limit is counted per server instance: how many instances Vercel runs for this project, and so what
  a client really sees across them, is not knowable from the repository. The numbers 300 per 60 s and 180 days
  are defaults awaiting the owner. `public-api-paths.test.ts` relies on `unstable_doesMiddlewareMatch`, an
  experimental Next testing API whose behaviour on a Next upgrade is untested. The app adds no CORS headers (Vercel adds
  `Access-Control-Allow-Origin: *` to static responses, not to dynamic routes or the `use cache` pages); whether a browser client on another origin is wanted is open.
- **Subsystems 13 to 16 (round 3 of the API-policy change, in no release yet) were read from the source and the tests.** The one thing
  this edition ran is Vitest over the whole tree with the JSON reporter: 185 files and 2734 tests, of which 2733 passed, 1 was skipped
  and none failed (before the CLI-published flip; with it the lead's full run gives 2732 passed and 2 skipped, and this edition re-ran the two flag-sensitive files, `developer-tools.test.ts` and `tests/cli/readme.test.ts`: 26 passed, 2 skipped). `pnpm build`, `pnpm e2e`, `tsc --noEmit`, `eslint` and `node scripts/bundle-budget.mjs` were not run by this pass, the
  CLI was not started, and no request was made to a deployment. Not known from the repository: how a batch of 25 operations behaves
  inside a real Vercel function's memory and time limits (the unit tests call the handlers in process); whether the
  production deployment, which still runs the previous release (observed 2026-11-01), serves any of it before this change is released
  (it has no batch endpoint, MCP parameters, JSON-LD lists or published-CLI wording: its `/developers` still says there is no published CLI); whether search engines index `/developers`, `/mcp` and the new
  structured data (that is decided in the owner's Search Console and Bing Webmaster accounts); whether `npx anvilry` works as
  `cli/README.md` describes (0.1.0 is on npm and the lead verified `npx anvilry@0.1.0 version` and `status` from a clean directory, which this edition did not repeat; 0.1.1 is not published yet); and what a browser really receives in
  `Vary` on an HTML page (the comment at `next.config.ts:265-267` says Next replaces it).
- **Open decisions left open by round 3, not decided by this index:** publishing `cli/package.json` 0.1.1, the README-only patch (the owner's step);
  the Search Console and Bing Webmaster indexing requests; CORS, which the app does not add (Vercel's `*` on static responses is not the app's doing); the release version
  (everything stays under `[Unreleased]` and no version is chosen here); the `/articles.md` twin (`page-markdown-lists.ts`) and
  `related-writing.tsx`, which still keep their own copy of the notes-link rule that `article-href.ts` now holds for the card, the JSON-LD
  list and the homepage twin; and `/api/v1/articles` and the MCP tools, which still list articles when `NEXT_PUBLIC_ARTICLES_ENABLED` is
  `false` while the `/articles` pages answer 404 (production has articles on).
