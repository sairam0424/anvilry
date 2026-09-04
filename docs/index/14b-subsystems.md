---
kind: doc
title: Cross-cutting subsystem maps (part 2 of 2)
domain: [content]
status: current
version: v3.6.0
---

# Cross-cutting subsystem maps — part 2 of 2

> Part of the Anvilry v3.6.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
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
| 7 | Auth & security surface | Two gates only: HTTP Basic on `/admin/*` (`src/proxy.ts`, Edge, `config.matcher = ["/admin/:path*"]`) and `Bearer ${CRON_SECRET}` on all five `/api/cron/*` routes | `401` or `NextResponse.next()`; everything else is public, guarded only by the enforced CSP + 4 headers, one shared rate limiter, and four sanitisation boundaries |
| 8 | Feature flags | Two mechanisms: build-time `NEXT_PUBLIC_*` reads (30 flags, a redeploy to change) and the Vercel Flags SDK when `FLAG_DRIVER=vercel` (seconds, exactly one migrated flag) | A boolean at each read site — threaded as a prop from `src/app/layout.tsx:66` for the one SDK flag — plus one `[flags]` log line per resolution |
| 9 | 3D / WebGL | Mounting `<Hero>` on `/` (both hero slots), entering the gamified view (`BuildGraph`), opening any voice surface (`VoiceOrb`), or the 404 page with `NEXT_PUBLIC_404_ORB=true` | Pixels in a `<canvas>`; every 3D surface is `aria-hidden` and decorative, with the accessible content elsewhere |
| 10 | Build & deploy | `git push` (CI runs on `branches: ["**"]`), a PR into `develop` or `main`, or a manual `make deploy-preview` / `make deploy-prod` | A Vercel Preview URL (from `develop`) or the production deployment (from `main`), five live cron schedules, and one `[config]` cold-start line per server process |

## Coverage

**Mapped in this file (4 of 10):** 7. auth & security surface · 8. feature flags · 9. 3D / WebGL ·
10. build & deploy — followed by the cross-subsystem coupling table (18 multi-site contracts), the
entry-point cheat sheet ("if you want to change X, start at file Y", ~45 tasks), and the UNVERIFIED /
carried-forward ledger for both parts.
**Subsystems 1–6 are in [`14-subsystems.md`](./14-subsystems.md):** content pipeline · view system ·
chat/LLM request path · voice pipeline · MCP server · telemetry & observability.
**Synthesized from** sections [01](./01-routes-pages.md)–[13](./13-dependencies-and-versions.md) (each cites
its own reads), plus one direct read recorded inline: a `force-static` grep across `src/` (returns nothing —
and `CLAUDE.md:140` now documents `/mcp` as "no segment config", so the mismatch this index recorded against
that line is gone). Subsystem 10's bundle-gate correction adds three more direct reads, all recorded where
they are used: `node_modules/next/dist/lib/bundler.js:142-144`,
`node_modules/next/dist/build/index.js:2843-2844`, and one read-only run of `scripts/bundle-budget.mjs`
against an already-present `.next/`.

---

## 7. Auth & security surface

There is exactly one authenticated surface (`/admin/*`), one bearer-token surface (`/api/cron/*`), and
everything else is public. The rest of the security posture is headers, a shared rate limiter, and four
sanitisation boundaries.

### Flow — the `/admin` gate

```
GET /admin/telemetry
   → src/proxy.ts  (Next 16 Proxy, EDGE; config.matcher = ["/admin/:path*"], :22-24)
        no ADMIN_PASSWORD                → 401 + WWW-Authenticate (never reveals the env state)  :38-43
        header not "Basic "              → 401                                                   :46-51
        atob() throws                    → 401                                                   :59-64
        sha256Hex(supplied) !== sha256Hex(ADMIN_PASSWORD)  → 401                                  :67-76
        otherwise                        → NextResponse.next()                                    :79
   → src/app/admin/telemetry/page.tsx   ← checks NO auth itself; comment at :425-426 records that
                                          the request is already authenticated upstream
```

`sha256Hex` is `crypto.subtle.digest("SHA-256", …)` → hex (`src/proxy.ts:26-31`); the final comparison is
a plain `!==` of two digests. The docblock at `:12-20` states plainly that this is a **first filter, not a
constant-time gate**. Credentials are decoded with `atob` (`:56`, a Web API, byte-oriented), and both
`password` and `username:password` forms are accepted (everything after the first colon).

**Why both implementations exist.** `src/lib/admin-auth.ts` is the Node twin: `requireAdmin(req)` using
`node:crypto` `createHash` + `timingSafeEqual` on the digests (`:57-61`), with `WWW-Authenticate` +
`Cache-Control: no-store` on deny (`:63-71`). `src/proxy.ts:11-13` states it is **intentionally not
imported** because the Edge runtime lacks `node:crypto`. At v3.4.2 `admin-auth.ts` has **zero runtime
importers** — the Edge proxy is the live gate; `admin-auth.ts` is guarded by
`src/lib/admin-auth.test.ts` (11 assertions) but unwired.

### Flow — the cron gate

All five routes implement the identical, verbatim guard:

```ts
const secret = process.env.CRON_SECRET;
const authHeader = req.headers.get("authorization");
if (!secret || authHeader !== `Bearer ${secret}`) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

Sites: `eval/route.ts:98-102`, `health-check/route.ts:146-150`, `github-sync/route.ts:18-22`,
`seo-audit/route.ts:16-20`, `content-audit/route.ts:19-23`. Properties exactly as implemented:
**fail-closed** (unset `CRON_SECRET` ⇒ 401, never open — stated at `eval/route.ts:14`), lower-case header
name, plain non-constant-time `!==`, no scheme-case tolerance, no trimming, no `x-vercel-*` alternative.
Schedules live in `vercel.json:3-7`; all five fire regardless and immediately 401 when the secret is unset.

### Headers and CSP

Defined in `next.config.ts`; applied to `/:path*` at `:214`, with a `/resume` + `/resume/:path*` variant
at `:216-217`.

| Header | Value | Cite |
|---|---|---|
| `Content-Security-Policy` | **ENFORCED** (the header key at `:94` is the enforcing one, not Report-Only) | `next.config.ts:37-71,94` |
| `X-Frame-Options` | `DENY` → `SAMEORIGIN` on `/resume*` | `:76`, `:199-200` |
| `X-Content-Type-Options` | `nosniff` | `:77` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `:78` |
| `Permissions-Policy` | `microphone=(self), camera=(), geolocation=(), browsing-topics=()` | `:79-83` |
| HSTS | **intentionally absent** — set by Vercel's platform default | `:73-74` |

Three CSP entries are load-bearing and non-obvious:

- **`'unsafe-eval'` in `script-src` is required in BOTH dev and prod** (`:43-51`). `MDXContent` evaluates
  Velite's serialized `code` string client-side with `new Function(code)`
  (`src/components/mdx-content.tsx:14-17`) on every page with an MDX body. Removing it crashes every
  project/work/note page with a React error boundary. The trust boundary is stated at
  `mdx-content.tsx:8-13`: `code` must only ever be build-time Velite output.
- **Three speech hosts in `connect-src`** (`:56-67`): `wss://speech.googleapis.com` (Chrome/Chromium Edge
  `SpeechRecognition`, subject to `connect-src` since Chrome 63 — without it every attempt fails
  `onerror.error === "network"`), `wss://speech.platform.bing.com` (Edge on Windows),
  `https://www.gstatic.com` (Chrome's online `SpeechSynthesis` voices). Recorded blind spot at `:60-61`:
  the Playwright zero-violation sweep never exercised live mic input.
- **The `/resume` override is a literal string replace** of `frame-ancestors 'none'` → `'self'`
  (`:204-207`). Editing `next.config.ts:41` (reorder or requote) silently makes the override a no-op and
  the résumé PDF iframe stops rendering.

### Rate limiting

One limiter, one budget: `Ratelimit.slidingWindow(8, "60 s")`, prefix `anvilry:chat`, `analytics: false`
(`src/lib/rate-limit.ts:22-25`). **Five routes share it** — `/api/chat`, `/api/tts`, `/api/tts-google`,
`/api/transcribe`, `/api/error` — so they are not independently budgeted. It **fails open** on both
paths: `{ ok: true }` when unconfigured (`:73`) and on any Upstash throw (`:79-82`), with a production-only
module-load warning as the sole signal (`:41-47`). `/api/visit` has its **own** limiter —
`slidingWindow(1, "30 m")`, prefix `anvilry:visit` (`api/visit/route.ts:27-34`) — and on denial returns
the current total with `today: 0` rather than a 429 (`:44-49`).

### The sanitisation boundaries

| Boundary | What it enforces | Cite |
|---|---|---|
| **Inbound chat payload** | 12 messages max, 600 chars per string block, image mediatype allowlist, `application/pdf` only, 10000-char cap on `"[PDF:"` text blocks, last message must be `user` | `src/app/api/chat/route.ts:61-62,194-249` |
| **Model output → card tokens** | Locked `[a-z0-9-]+` slug charset; resolution against the build-time Velite allowlist; unresolved tokens **dropped**, never echoed | `src/components/chat/parse-cards.ts:33,54-68`; gate `parse-cards.test.ts:55-75` |
| **Model output → markdown** | react-markdown vdom (never `dangerouslySetInnerHTML`) + `skipHtml` + default `urlTransform` + `rehype-sanitize` as defense-in-depth | `src/components/chat/markdown-message.tsx:10-16,88-93` |
| **Telemetry egress** | `redact()` on `message` and `stack` before `emit()`; salted 16-hex IP/UA hashes; transcript text and prompt text never emitted | `src/lib/telemetry/schema.ts:101-128`; `api/error/route.ts:145-166`; `api/transcribe/route.ts:105-112` |
| **External redirect** | `/articles/<slug>` redirects only after asserting an `https://` or `http://` prefix, else `notFound()` — the open-redirect guard | `src/app/articles/[slug]/page.tsx:77-81` |
| **JSON-LD** | `safeJsonLd` = `JSON.stringify(data).replace(/<\//g, "<\\/")`, because `JSON.stringify` alone does not escape `</script>` | `src/components/json-ld.tsx:4-10` |
| **Voice engine params** | `validateVoiceForEngine` rejects unknown ids, engine mismatches, and tier disagreements server-side; no `tier` field is accepted from the client | `src/lib/voice-catalog.ts:350-367`; `api/tts/route.ts:92-97` |
| **Analytics** | `commandEventName` returns the registered command word or the literal `"unknown"` — never raw input or args | `src/components/game/terminal/commands.ts:535-538` |

### Failure modes

| Failure | Mechanism |
|---|---|
| `/admin` open | `src/proxy.ts` not executing (matcher edited, file moved) — the page itself checks nothing (`admin/telemetry/page.tsx:425-426`). |
| `/admin` locked out entirely | `ADMIN_PASSWORD` unset — deliberate (`proxy.ts:38-43`). |
| Non-Latin-1 password fails | `atob` is byte-oriented (`proxy.ts:56`). |
| All five crons 401 | `CRON_SECRET` unset — deliberate fail-closed. |
| Every MDX page crashes | `'unsafe-eval'` removed from `script-src`. |
| Voice permanently broken in production | The Chrome speech WebSocket host removed from `connect-src`. |
| Résumé PDF iframe blank | The `frame-ancestors` string replace no longer matching `next.config.ts:41`. |
| Unbounded AWS spend | Rate limiting fails open in both failure modes; `/api/chat` is the cost-bearing endpoint. |
| `/admin/*` crawled | `src/app/robots.ts:5-6` is allow-all with **no** `disallow` entries; the protection is the proxy, not robots. |

### Flags / env that alter it

`ADMIN_PASSWORD`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`/`_TOKEN` (whether rate limiting exists at all),
`TELEMETRY_IP_SALT`, `TELEMETRY_ENABLED`, `FLAGS_SECRET` (what `verifyAccess` validates on
`/.well-known/vercel/flags`, `src/app/.well-known/vercel/flags/route.ts:6-7`). No `NEXT_PUBLIC_*` flag
gates any security control.

---

## 8. Feature flags

### The two mechanisms

```
MECHANISM A — build-time NEXT_PUBLIC_* env  (latency: a redeploy)
  Vercel dashboard / .env.local
    → inlined by Next at build time
    → read as `process.env.NEXT_PUBLIC_X === "true"` in the module or function that needs it
    → 30 flags across writing-flags.ts, enabled-views.ts, voice-picker-mode.ts, llm-sdk-mode.ts,
      and ~14 component-local reads

MECHANISM B — Vercel Flags SDK  (latency: seconds)
  FLAG_DRIVER=vercel  (read ONCE at module load, src/lib/flags.ts:13)
    → flag<boolean>({ key: "NEXT_PUBLIC_DISCOVERY_BADGES", defaultValue: false, decide: () => false })
      declared at src/lib/flags.ts:17-29 — the SDK checks the override cookie BEFORE decide(),
      which is why decide() returning false does not defeat a dashboard override (:25-28)
    → awaited server-side in getDiscoveryBadgesEnabled()  (:42-55)
    → /.well-known/vercel/flags exposes exactly this ONE flag (route.ts:11-22), verifyAccess-gated
```

### The resolver

```
getDiscoveryBadgesEnabled()                                     src/lib/flags.ts:41
  ├─ useVercelDriver (captured at module load, :13)
  │     true  → await the Flags SDK declaration        → logs [flags] {driver, value, flags_secret_present}
  │     false → process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true"   (:58)
  │             → logs [flags] {driver, value, source: "env_var" | "default_false"}   (:65-67)
  ▼
src/app/layout.tsx:66  awaits it server-side
  ▼
threaded as a PROP into <Providers discoveryBadgesEnabled>       layout.tsx:97
  ▼
src/components/providers.tsx:57  mounts <DiscoveryBadge> only when true
```

`flags.ts` migrated **exactly one** flag. Its docblock (`:7-8`) states that all other beast-mode flags
remain plain `NEXT_PUBLIC_` reads in their own files. `DiscoveryBadge` itself never reads the flag
(`src/components/game/discovery-badge.tsx`).

### Every flag, and what it gates

**`src/lib/writing-flags.ts` — 9 booleans + 1 enum, all build-time**

| Flag | Export | Default | Predicate | Gates |
|---|---|---|---|---|
| `NEXT_PUBLIC_ARTICLES_ENABLED` | `ARTICLES_ENABLED` | **true** | `!== "false"` (the only opt-out) `:20` | `/articles` subtree via `articles/layout.tsx:12`; nav link; sitemap; `WritingPreview` |
| `NEXT_PUBLIC_NOTES_ENABLED` | `NOTES_ENABLED` | false | `=== "true"` `:23` | `/notes` via `notes/page.tsx:21`; `/notes/[slug]` via `notFound()` at `:51`; article `linkedNote` redirects; nav; sitemap |
| `NEXT_PUBLIC_OPEN_TO_WORK` | `OPEN_TO_WORK` | false | `:26` | `OpenToWorkBanner`, gated in the caller (`layout.tsx:99`) |
| `NEXT_PUBLIC_STATS_ENABLED` | `STATS_ENABLED` | false | `:31` | **Nav + sitemap only** (`site-nav.tsx:22-23`, `sitemap.ts:80-88`) — `/stats` still renders and prerenders |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `SEARCH_ENABLED` | false | `:34` | **Nav + sitemap only** — same as `/stats` |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `TESTIMONIALS_ENABLED` | false | `:39` | `home/testimonials.tsx:13` (second gate is `hasTestimonials`) |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `INKFORGE_ARTICLES_ENABLED` | false | `:44` | `articles/page.tsx` inkforge block |
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `GITHUB_STATS_ENABLED` | false | `:49` | `GithubStatsStrip` on `/` (`page.tsx:31`) |
| `NEXT_PUBLIC_CHROME_TTS_BANNER` | `CHROME_TTS_BANNER_ENABLED` | false | `:87` | Chrome TTS advisory in `talk-mode.tsx:348-350` |
| `NEXT_PUBLIC_ARTICLE_DEDUP_KEY` | `ARTICLE_DEDUP_KEY` | `"linkedNote"` | enum `:72-74` | `article-grouping.ts:30` `DEFAULT_CONFIG.primaryKey`; only matters for articles with **both** `linkedNote` and `canonicalUrl` |

**`src/lib/enabled-views.ts`**

`NEXT_PUBLIC_ENABLED_VIEWS` — comma list intersected with `ALL_OPTIONAL = ["gamified","chat","developer","voice","resume"]`
(`:20-21`). **Unset ⇒ all on; empty string ⇒ all optional off**, distinguished at `:28`. `classic` and
`resume` are unconditionally true (`:20,:38`). Unknown entries are silently dropped (`:33`). Gates
`view-router.tsx:64-69` and `view-switcher.tsx:38`.

**Component-local reads**

| Flag | Read at | Gates |
|---|---|---|
| `NEXT_PUBLIC_ANVIL_ORB_MODE` | `header-orb-trigger.tsx:35` | `inplace \| modal \| off`, default `inplace` |
| `NEXT_PUBLIC_ENABLE_ANVIL_ORB` | `header-orb-trigger.tsx:37` | legacy `"false"` → `off` |
| `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE` | `header-orb-trigger.tsx:45` | `core \| classic` panel chrome |
| `NEXT_PUBLIC_VOICE_PICKER_MODE` | `voice-picker-mode.ts:20` | `descriptor` (default) \| `gender` layout |
| `NEXT_PUBLIC_VOICE_TEST_AUDIO` | `talk-mode.tsx:478` | the "🔊 Test audio" button |
| `NEXT_PUBLIC_ORB_POSTPROCESSING` | `voice-orb-3d.tsx:300` | Fluid/Bloom/Vignette/Noise/CA — **and** `getDeviceTier() === "high"` |
| `NEXT_PUBLIC_INK_TRANSITION` | `view-context.tsx:99` | WebGL2 ink-burn view-transition path |
| `NEXT_PUBLIC_SKILL_TREE` | `game-view.tsx:57` | the SVG skill tree in the Play view |
| `NEXT_PUBLIC_404_ORB` | `not-found.tsx:34` (module scope) | distressed orb on the 404 page |
| `NEXT_PUBLIC_VISITOR_COUNTER` | `site-footer.tsx:94` | footer visitor badge (client-side gate only; `/api/visit` has no flag check, `api/visit/route.ts:15-17`) |
| `NEXT_PUBLIC_RESUME_VARIANTS` | `resume/page.tsx:24`, `home/resume-view.tsx:42`, `command-palette-content.tsx:327`, `game/terminal/commands.ts:206` | all 5 résumé PDFs vs only `resumeVariants[0]`. **`developer-rail.tsx:35-47` is NOT gated** — it always lists all five. |
| `NEXT_PUBLIC_HERO_MODE` | `home/hero.tsx:16` (branched `:21`), re-checked `hero-avatar/index.tsx:50` | `"avatar"` → `HeroAvatar`, else `HeroGraph` |
| `NEXT_PUBLIC_AVATAR_POSITION` | `hero-avatar/index.tsx:51` | `hero-side` (default) \| `hero-split` \| `hero-top`; unknown values fall through to `hero-top` |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | `hero-graph/index.tsx:8` (**module scope**) | `./scene-physics` vs `./scene` |
| `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` | `chat-view.tsx:155` | the file picker |
| `NEXT_PUBLIC_PDF_ATTACHMENTS` | `file-picker-button.tsx:7` | `application/pdf` in the accept list |
| `NEXT_PUBLIC_EXTENDED_THINKING` | `chat-messages.tsx:159` | the thinking block (`!== "false"`, default ON) |
| `NEXT_PUBLIC_LLM_SDK` | `llm-sdk-mode.ts:26` | **nothing** — `llm-sdk-mode.ts` has zero importers; the `aws-sdk-bedrock` branch is unbuilt (`:13-15`) |
| `NEXT_PUBLIC_BUILD_YEAR` | written `next.config.ts:107`, read `site-footer.tsx:171` | the footer copyright year (an in-render `new Date()` fails the prerender under `cacheComponents`) |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | `flags.ts:58,65` | the ★ N/5 badge — the one flag on Mechanism B |

**Server-side, non-prefixed**

`EXTENDED_THINKING` (`api/chat/route.ts:263`, default ON — note `ARCHITECTURE.md:99` lists it among
`NEXT_PUBLIC_*` flags but the code reads the unprefixed name); `TELEMETRY_ENABLED`
(`api/error/route.ts:92`); `FLAG_DRIVER`, `FLAGS`, `FLAGS_SECRET`.

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
| All optional views vanish | Setting `NEXT_PUBLIC_ENABLED_VIEWS=""` (empty ≠ unset, `enabled-views.ts:28`). |
| A view silently disappears | A typo in the comma list — unknown entries are dropped by the `ALL_OPTIONAL.includes(v)` filter (`:33`). |
| A section's default flips | Mixing the two polarity conventions: `ARTICLES_ENABLED` is `!== "false"`; every other boolean is `=== "true"`. |
| `vi.stubEnv` stops working in tests | Hoisting a flag read from inside a function body to module scope. Deliberately inside the body at `resume/page.tsx:23-24`, `home/resume-view.tsx:41-43`, `command-palette-content.tsx:325-327`, `commands.ts:204-206`, `hero.tsx:15-16`, `hero-avatar/index.tsx:49`. |
| Route renders despite its flag being off | `/stats` and `/search` are not route-gated — only unlinked and un-sitemapped. |
| Discovery badge never appears | The flag is resolved server-side and threaded as a prop; `providers.tsx:57` is the gate, not the component. |

---

## 9. 3D / WebGL

Four independent canvases exist; at most one hero canvas and one orb canvas are live at a time.

### Flow

```
GATE (evaluated in a client component, before any import resolves)
  hero graph :  isDesktop(min-width:768px) && !reduced && view === "classic"       hero-graph/index.tsx:35
  hero avatar:  heroMode === "avatar" && isDesktop && !reduced && view === "classic"
                                                                  hero-avatar/index.tsx:54,:56
  build graph:  isDesktop && !reduced && webglOk && !webglFailed && !talkOpen      game/build-graph.tsx:50
                (talkOpen ORs all three voice stores, :38 → exactly one live context)
  voice orb  :  isDesktop && webgl && !reduced && !glFailed                        chat/voice-orb.tsx:42
        │  false on ANY term → CSS glow fallback / 2D canvas orb / DOM index; no WebGL at all
        ▼
LAZY BOUNDARY   next/dynamic(..., { ssr: false })
  hero-graph/index.tsx:16-18   → ./scene  OR  ./scene-physics   (target fixed at module eval, :8)
  hero-avatar/index.tsx:10-13  → ./avatar-scene
  game/build-graph.tsx:16      → ./build-graph-scene
  chat/voice-orb.tsx:11-16     → ./voice-orb-3d
        ▼
ERROR CONTAINMENT
  <WebGLBoundary> wraps: hero-avatar/index.tsx:59 · build-graph.tsx:60 · voice-orb.tsx:46 · not-found.tsx:26
  NOT wrapped: hero-graph/index.tsx  ← the one unwrapped hero slot
  render() returns null on failure; console.warn hardcoded "[build-graph]"   webgl-boundary.tsx:25,:30
  Boundaries catch only SYNC throws — R3F context-creation failure is an async unhandled rejection,
  which is why useWebGLSupported() probes proactively (use-media-query.ts:21-47).
  That probe is used by build-graph.tsx:29 and voice-orb.tsx:38 ONLY.
        ▼
BARREL      src/lib/r3f.ts  — named re-exports only; `export * as THREE from "three"` (:21)
            ONE module-graph node for the whole R3F universe → one shared chunk
            next.config.ts:149: "the barrel ... is load-bearing for the single-copy outcome"
            EXCEPTION: hero-graph/scene-physics.tsx:4-6 imports @react-three/fiber + three DIRECTLY
        ▼
CANVAS      hero graph  frameloop="demand"   scene.tsx:117
            avatar      frameloop="demand"   avatar-scene.tsx:22
            physics     frameloop="always"   scene-physics.tsx:20
            build graph frameloop="demand"   build-graph-scene.tsx:151
            voice orb   errorMode ? "demand" : "always"   voice-orb-3d.tsx:306
            all: dpr={[1, 1.75]} · resize={{offsetSize:true}} ·
                 gl={{antialias:true, alpha:true, powerPreference:"high-performance"}}
        ▼
SCENE       hero graph : 1 instancedMesh for all graphNodes + 1 lineSegments for all edges
                         + Rig eases rotation toward a module-level `ptr` singleton
            avatar     : useGLTF("/avatar/sairam.glb") → resolveRig(scene) → one useFrame loop
                         driving head/neck bones, 8 ARKit eye morphs, chest/spine breathing
            build graph: one mesh PER node (hover/click needs it) + one lineSegments + OrbitControls
            voice orb  : 5-octave fBm domain-warped icosahedron + inverted-fresnel halo shell
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/use-media-query.ts:14-15,28-47` | `useMediaQuery` (server snapshot `false`) and the memoized `useWebGLSupported` probe (`webgl2` → `webgl` → `experimental-webgl`, any throw ⇒ false). |
| 2 | `src/lib/use-reduced-motion.ts:9-21` | The native hook, written to avoid importing `motion/react` for this alone. |
| 3 | `src/components/home/hero.tsx:16,21` | The sole mount point for both hero slots. |
| 4 | `src/components/hero-graph/index.tsx:8,15-17,34,41-53` | Flag-fixed dynamic target; the triple gate; the always-rendered CSS glow fallback + radial mask + scrim. |
| 5 | `src/components/hero-avatar/index.tsx:49-62,65-110` | Flags read **inside** the function body (for `vi.stubEnv`); `WebGLBoundary`; three layout wrappers. |
| 6 | `src/components/game/build-graph.tsx:28-60` | The five-term gate incl. the three voice stores. |
| 7 | `src/components/chat/voice-orb.tsx:38-50` | Capability tiering with a permanent flip to the 2D orb on failure. |
| 8 | `src/components/game/webgl-boundary.tsx:19-30` | The only WebGL error boundary; class component because only class boundaries catch descendant render errors (`:11-12`). |
| 9 | `src/lib/r3f.ts:17-27` | The barrel. Also the **only** import site for `@react-three/drei` and `@react-three/postprocessing` in the repo. |
| 10 | `src/components/hero-graph/scene.tsx:7-8,15,19-46,48-69,71-90,105,116-125` | `SCALE = 1.6`; the `idx` map; the module-level `ptr` singleton; instanced nodes; batched edges; the `\|delta\| > 0.0006` settle threshold. |
| 11 | `src/components/hero-graph/scene-physics.tsx:20,33-44` | `frameloop="always"`; `DriftWrapper` **sets** (never accumulates) sinusoidal position; reduced motion handled inside the frame callback. |
| 12 | `src/components/hero-avatar/avatar-scene.tsx:18,22-29` | Owns `controlsRef` — the only channel between input and animation, never React state. |
| 13 | `src/components/hero-avatar/avatar-mesh.tsx:10,27,39-42,44-56,61-115` | Module-scope `useGLTF.preload` (a real network fetch on import); the one lazily-initialised rig ref; full dispose-on-unmount traversal; the single frame loop. |
| 14 | `src/components/hero-avatar/rig.ts:41-63` | Pure single-traversal bone/morph resolver; type-only `three` import to stay off the runtime graph (`:1-4`). |
| 15 | `src/components/hero-avatar/use-avatar-gaze.ts:22-35` / `use-avatar-idle.ts:14-27` | Pure signal generators returning refs; `useAvatarIdle` calls `invalidate()` **every** frame. |
| 16 | `src/components/hero-avatar/avatar-controls.tsx:31-48` | Window-level `mousemove`/`touchmove` (the canvas is `pointer-events: none`) → ref + `invalidate()`; renders `null`. |
| 17 | `src/components/game/build-graph-scene.tsx:10,26-44,67-75,95-96,151-167` | `SCALE = 1.6`; per-node meshes; hover lerp with a `> 0.005` invalidate threshold; OrbitControls with pan/zoom disabled. |
| 18 | `src/components/chat/voice-orb-3d.tsx:47-98,255-268,300-348` | GLSL fBm; the halo shell; the double-gated post-processing chain. |
| 19 | `public/avatar/sairam.glb` | 1,105,768 B glTF 2.0, `glTF-Transform v4.4.2`, meshopt + WebP + quantized, 13 images all `image/webp`, 5 skins, 57 nodes. |
| 20 | `src/lib/avatar-glb.test.ts` | The build-blocking asset invariant suite. |

### Entry point

Mounting `<Hero>` on `/` (both hero slots), entering the gamified view (`BuildGraph`), opening any voice
surface (`VoiceOrb`), or rendering the 404 page with `NEXT_PUBLIC_404_ORB=true`.

### Exit point

Pixels in a `<canvas>`. Every 3D surface in the app is `aria-hidden` and decorative — the accessible
content is elsewhere (`GraphIndex` for the graph, the visible caption + live region for the orb).

### Perf decisions, concretely

| Decision | Value | Cite |
|---|---|---|
| DPR clamp | `[1, 1.75]` on all hero/graph canvases | `scene.tsx:122`, `scene-physics.tsx:23`, `avatar-scene.tsx:25`, `build-graph-scene.tsx:154`; voice orb `voice-orb-3d.tsx:310` |
| Mobile cutoff | `(min-width: 768px)` — the whole WebGL layer is skipped below it | `hero-graph/index.tsx:32`, `hero-avatar/index.tsx:46`, `build-graph.tsx:28` |
| Draw-call batching (hero) | one `instancedMesh` for all nodes, one `lineSegments` for all edges | `scene.tsx:45,65-67` |
| Demand-loop settle | re-`invalidate()` only while `\|delta\| > 0.0006` | `scene.tsx:87` |
| Resize race fix | `resize={{ offsetSize: true }}` — fixes "canvas stuck at 300×150" when the ResizeObserver reports 0 on first measure | `scene.tsx:120` (rationale in the comment at `:118-119`) |
| Chunk dedup | the `src/lib/r3f.ts` barrel; `three`/`fiber`/`drei` deliberately **excluded** from `optimizePackageImports` (which is `["lucide-react","motion"]`) | `next.config.ts:126-131,146-150` |
| Recorded chunk measurement | 16.2.9: 2036 KB / 5 chunks (two 876 KB copies) → 16.3.0: 1160 KB / 4 chunks (one copy), −876 KB | `next.config.ts:133-144` |
| Live perf contract | exactly 1 three.js copy (`grep -l WebGLRenderer \| wc -l` must be 1 — the `react-three` grep returns 5 and is **not** the copy count), 1248 KB across R3F chunks, 113/113 static pages | `domains/performance/README.md:85-91` |
| Enforced in CI as of this branch | the same `WebGLRenderer` marker, asserted mechanically: the chunk carrying it (897,249 B) must appear in **zero** routes' first-load sets, and no route may exceed 1,285,000 B of first-load JS. Runs on the `e2e` job's existing build, reading `.next/diagnostics/route-bundle-stats.json` | `scripts/bundle-budget.mjs:50,62,124`; step at `.github/workflows/ci.yml:115-116`; § 10 The bundle budget gate |
| Asset budget | `MAX_BYTES = 1.5 * 1024 * 1024`; current asset 1,105,768 B | `src/lib/avatar-glb.test.ts:21,58-61` |
| LOD | **none exists** — no `<Detailed>`, no `THREE.LOD`, no distance swap. The only quality knobs are the dpr clamp and the 768 px cutoff. | verified absence, section 07 |
| Worker offload | **not present in source.** `@react-three/offscreen` was declared but imported by no file in `src/`, and was **removed from `package.json` in v3.5.0**. `CLAUDE.md:259` says the same ("no worker/OffscreenCanvas anywhere") — it previously claimed worker offload existed. | section 07, section 13 |
| Physics engine | **not present in source.** `@react-three/rapier` was imported by no file and was **removed from `package.json` in v3.5.0**; `scene-physics.tsx:12-13` states "No RigidBody / Rapier needed for this effect". The mount-side comment agrees now too: `hero-graph/index.tsx:12` says "despite the flag name, there is no physics engine involved" — it used to read as though the flag loaded Rapier, which is the reading this index carried. That comment now carries its own drift, one revision behind the removal: `hero-graph/index.tsx:13-14` still says rapier "is declared in package.json but imported nowhere in src/". | section 07, section 13 |

### The reduced-motion path

| Surface | Behaviour under `prefers-reduced-motion: reduce` |
|---|---|
| Hero graph | Never mounts; the two blurred CSS circles are the visual (`hero-graph/index.tsx:35,42-43`) |
| Hero avatar | Never mounts; `GlowFallback` duplicates those same two circles so switching hero modes causes no layout shift (`hero-avatar/index.tsx:16-26`) |
| Build graph | Never mounts; `GraphIndex` (the accessible DOM-first list) is the whole experience (`build-graph.tsx:50`) |
| Voice orb | 3D skipped; `VoiceOrbCanvas` draws **one static ring** and returns early with no rAF loop (`voice-orb-canvas.tsx:54-63`) |
| Physics variant | The `useFrame` callback early-returns, but `frameloop="always"` still renders every frame — a static scene, continuously drawn (`scene-physics.tsx:34-38`) |
| View transitions | JS snap branch (`view-context.tsx:80-92`) **and** a CSS `animation: none !important` kill switch (`globals.css:293-299`) |
| Global CSS | **Ten** separate `@media (prefers-reduced-motion: reduce)` blocks in `globals.css` (`:67,84,91,99,168,226,293,315,346,380`); the orb block deliberately keeps `blur(1.4px) contrast(4.5)` because dropping the filter shatters the metaballs (`:173-177`) |
| Skill tree | Injects an **unscoped** global `* { animation: none !important }` from inside the SVG (`skill-tree.tsx:576-578`) |

### Failure modes

| Failure | Mechanism |
|---|---|
| Two live WebGL contexts on low-end mobile | Dropping the `view === "classic"` term from the hero gates (`hero-graph/index.tsx:35`; the rationale is stated at `:21-23`), or changing the gamified branch in `view-router.tsx` from unmount to `hidden`. |
| Uncatchable crash on a GL-less client | Relying on `WebGLBoundary` alone: R3F surfaces context-creation failure as an async unhandled rejection (`use-media-query.ts:21-26`). `hero-graph/index.tsx` and `hero-avatar/index.tsx` neither probe nor (for the graph) wrap. |
| Demand loop becomes a perpetual loop | Removing the `> 0.0006` invalidate threshold (`scene.tsx:87`). Note the avatar's demand loop already never settles: `useAvatarIdle` invalidates unconditionally (`use-avatar-idle.ts:27`). |
| Avatar freezes between mouse moves | Removing `useAvatarIdle`'s `invalidate()` — it is one of only two wake sources on the avatar's demand loop (`avatar-scene.tsx:22`, `avatar-controls.tsx`). |
| Twin three.js chunks return (−876 KB lost) | Deleting `src/lib/r3f.ts`, or re-adding `three`/`@react-three/*` to `optimizePackageImports` (`next.config.ts:146-149`). **Still unguarded by CI:** `scripts/bundle-budget.mjs` asserts three.js stays *off the first-load critical path*, not that only one copy exists — two lazy copies change no route's first-load bytes and pass the gate. The barrel is the only defence. |
| three.js dragged onto the first-load critical path (+876 KB on every route) | An eager `import * as THREE` (or an R3F import outside a `next/dynamic(..., { ssr: false })` boundary) in anything a route renders on first load. **This one is guarded:** the `Bundle budget` step fails the `e2e` job, naming the offending chunks (`scripts/bundle-budget.mjs:124-129`, step at `ci.yml:115-116`). |
| Node unit tests fail `ECONNREFUSED` | Importing `avatar-mesh.tsx` from a node test — `useGLTF.preload` at module scope fires a real fetch. This is why `resolveRig` lives in `rig.ts` (`rig.ts:19-22`). |
| Avatar loads but never moves | Renaming a bone: `resolveRig` matches lowercased substrings `head`/`neck`/`chest`\|`spine1`/`spine`-not-`spine1` (`rig.ts:43-52`). No error anywhere. Pinned by `avatar-glb.test.ts:98-129`. |
| Eye gaze silently inert (**current state**) | `rig.morph` requires a `SkinnedMesh` whose name contains `"head"` **and** has a `morphTargetDictionary` (`rig.ts:57-63`). `sairam.glb` is an Avaturn export (`avaturn_body`, `avaturn_hair_0`, …) with **zero** morph targets, so all 8 ARKit `setMorph()` calls are skipped. Asserted deliberately at `avatar-glb.test.ts:132-157`; shipping a blendshape avatar requires flipping `:148` to `toBeGreaterThan(0)` or the build fails. |
| Uncatchable unhandled rejection offline | drei/troika `<Text>` without a local `font` prop fetches font metadata from `cdn.jsdelivr.net` — which is why the 3D hover label is commented out (`build-graph-scene.tsx:98-118`) while `Node` still takes an unused `label` prop (`:49`). |
| Skill tree throws at render | `skills.find(s => s.group === groupName)!` is a non-null assertion against six hardcoded group names (`skill-tree.tsx:60-61,155`); renaming a group in `src/lib/profile.ts:42-64` throws. |
| Build fails on an avatar re-export | Re-exporting without meshopt/quantization, or with PNG/JPEG textures, or above 1.5 MB — `avatar-glb.test.ts` runs inside `pnpm build` (`:69-95`). |
| Wrong scene named in the console | `WebGLBoundary` hardcodes a `[build-graph]` prefix (`webgl-boundary.tsx:25`) even when the failing surface is the hero avatar, the voice orb, or the 404 orb. |
| Nodes clip out of frustum | `graph-data.ts:37` records the budget: camera z=7, fov=45 ⇒ visible half-height ≈ 2.9 / SCALE 1.6 ≈ 1.8 units. |

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
        ▼  git push (any branch)
CI  .github/workflows/ci.yml   — 4 jobs, NO `needs:`, all parallel
   job `ci`   : pnpm install → pnpm content → pnpm lint → npx tsc --noEmit → pnpm test
                             → node scripts/check-index-citations.mjs   (ci.yml:65-66)
                ↑ the ONLY place lint and tsc run; neither is in pnpm build
                ↑ the index-citation check is deliberately a CI step and NOT in `pnpm build`, so a
                  stale doc fails the PR instead of blocking a production deploy (ci.yml:55-61)
   job `e2e`  : pnpm install → playwright install --with-deps chromium → pnpm build
                             → node scripts/bundle-budget.mjs (ci.yml:115-116) → pnpm e2e
                ↑ pnpm build re-runs vitest, so tests execute TWICE per CI run
                ↑ playwright.config.ts webServer runs `pnpm start`, which needs a prior build
                ↑ the budget rides on THAT build — no second compile. It reads
                  .next/diagnostics/route-bundle-stats.json, which only Turbopack writes.
                  NO continue-on-error: unmeasurable is red (§ The bundle budget gate)
   job `security-alerts` : continue-on-error: true; exits 0 either way (ci.yml:202,254)
  - bundle-analysis.yml: DELETED on this branch. 222 runs, 211 green, ZERO artifacts — it never
    measured anything; the `Bundle budget` step above replaces it (§ The bundle budget gate)
  + codeql.yml (develop AND main, + weekly cron 35 1 * * 1) — main added so a hotfix
                                     pushed straight to main cannot deploy unscanned
  + dependency-review.yml (PRs → develop/main): fail-on-severity high, fail-on-scopes runtime
        │
        ▼  PR: feature → develop  (make pr)      Vercel PREVIEW deploy
        ▼  PR: develop → main    (make pr-prod)  Vercel PRODUCTION deploy
VERCEL BUILD
  pnpm build  =  velite --clean  &&  vitest run  &&  next build
                 └─ 1. generate .velite  └─ 2. TEST GATE  └─ 3. compile
                 a non-zero exit anywhere in the chain never reaches the next step
                 ↑ the Bundle budget gate does NOT run here — like the index-citation check it is a
                   MERGE gate, not a deploy gate; a bundle regression fails the PR, not the deploy
  no buildCommand / framework / regions / functions keys in vercel.json — auto-detection + this script
        ▼
RUNTIME
  vercel.json crons: health-check 0 5 * * * · github-sync 0 8 * * * · seo-audit 0 6 * * 1
                     content-audit 0 7 * * 1 · eval 0 9 * * 1     (all GET, all Bearer CRON_SECRET)
POST-BUILD, MANUAL, NOT WIRED
  make search-index → pnpm pagefind --site .next/server/app --output-path public/pagefind
                      (Makefile:64-66 — the ONLY pagefind invocation in the repo)
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `package.json:8-23` | **12** scripts as of this branch — `analyze` is new (`:12`). `predev` = bare `velite` (`:9`); `build` = the three-step chain (`:11`); `clean` deletes `.velite` (`:18`). `engines.node` is `">=22 <23"` (`:5-7`), matching `.nvmrc`. |
| 2 | `velite.config.ts` | Content compile step 1. |
| 3 | `vitest.config.ts:17,26-45` | Two projects (`node` / `dom`); `resolve.tsconfigPaths`; `env: { NODE_ENV: "test" }`. |
| 4 | `next.config.ts` | Headers/CSP, `cacheComponents`, `inlineCss`, Turbopack root pin, 4 `.md` rewrites, `NEXT_PUBLIC_BUILD_YEAR`, the dev-only Velite watcher, `withBundleAnalyzer` (`:5-7` — still wrapping, but now reachable only through `pnpm analyze`; see § The bundle budget gate). |
| 5 | `.github/workflows/ci.yml` | The merge gate. `pnpm/action-setup` SHA-pinned at `8912a91…` (v6.0.5) in both jobs — the only SHA-pinned action in the repo. Also carries the `Bundle budget` step (`:110-111`). |
| 6 | `scripts/bundle-budget.mjs` | The bundle gate that replaced `bundle-analysis.yml`. Reads `.next/diagnostics/route-bundle-stats.json` (`:32`); asserts a per-route first-load ceiling (`:45`) and that three.js stays off the first-load critical path (marker `:57`, checked at `:119`). Exits 1 when the artifact is unreadable (`:66`) or its shape has changed (`:75`, `:81`). |
| 7 | `playwright.config.ts:15-40` | One `chromium` project; `baseURL http://localhost:3000`; `retries: 2` in CI; `webServer.command = "pnpm start"`, `reuseExistingServer: !CI`. |
| 8 | `vercel.json:3-7` | The five cron schedules — the file's only key. |
| 9 | `Makefile` | 36 targets: `pr`/`pr-prod`, `deploy-preview`/`deploy-prod`/`rollback`, `logs`/`logs-llm`/`logs-flags`, `trace`, `health`, `admin`, `env-check`/`env-setup`/`env-vercel`, `flags-show`, four `new-*` scaffolds, `search-index`. |
| 10 | `.github/dependabot.yml` | Weekly, `target-branch: develop`, 6 first-match-wins groups, 3 `ignore` rules. |
| 11 | `pnpm-workspace.yaml:18-28` + `pnpm-lock.yaml:7-17` | The 10 security overrides. **No longer in `package.json`** — the whole `pnpm` field (overrides, `onlyBuiltDependencies`, `ignoredBuiltDependencies`) moved to `pnpm-workspace.yaml` in v3.5.0 because pnpm 11 stopped reading that field, which had silently disarmed the v3.4.2 overrides on any pnpm-11 install (rationale at `pnpm-workspace.yaml:1-12`). |

### Entry point

`git push` (CI runs on `branches: ["**"]`), a PR into `develop` or `main`, or a manual
`make deploy-preview` / `make deploy-prod`.

### Exit point

A Vercel Preview URL (from `develop`) or the production deployment (from `main`), plus five live cron
schedules and a `[config]` cold-start log line per server process.

### Tests as a gate — what that actually means

`pnpm build` is `velite --clean && vitest run && next build` (`package.json:11`). The `&&` chain is the
gate: a failing Vitest assertion aborts before `next build`, so every one of the 65 test files is a deploy
blocker on the Vercel build path. Concretely, these invariants block a deploy:

- graph↔content bijection — `src/lib/game-model.test.ts:22-58`
- the 1.5 MB avatar budget + compression/rig assertions — `src/lib/avatar-glb.test.ts:21,58-129`
- snake_case Anthropic usage keys — `src/lib/llm.test.ts:244-249`
- card-token fail-closed behaviour — `src/components/chat/parse-cards.test.ts:55-75`
- redact-before-emit — `src/app/api/error/route.test.ts:218-255`
- last-XFF-segment IP derivation — `src/lib/telemetry/with-trace.test.ts:220-230`, and, across **all
  three** `clientIp` copies, `src/lib/client-ip-consistency.test.ts` (`:26-30` the enumerated copies —
  `rate-limit.ts`, `telemetry/with-trace.ts`, `api/visit/route.ts`; `:101` a discovery check that fails
  if a fourth copy appears unguarded; `:140` "takes the LAST x-forwarded-for segment, never the
  first"). This is the guard added when `api/visit/route.ts` was corrected from the leftmost segment to
  `xff.split(",").pop()!.trim()` (`:34`) — the divergence this index used to record there is gone.
- SSR-is-always-Classic — `src/components/view-context.test.ts:30-34`

**Playwright is a separate CI job and does *not* block `pnpm build`** (`ci.yml:68-127`).
`agent-trace.test.ts` is a **consistency** check, not a ship block: `expect(traceApproved).toBe(!hasSentinel)`
(`src/lib/agent-trace.test.ts:56`) passes in both states. The sentinel is currently present, so
`traceApproved === false` and `src/components/game/glass-box-demo.tsx:40` returns `null` — the demo is
dark and nothing is blocked. The file used to contradict itself on this — its header banner claimed the
test "BLOCKS shipping" while the `traceApproved` docblock said "NOT a hard build failure", and the banner
is what this index and `CLAUDE.md` originally believed. **Fixed in the comment sweep on this branch:** the
banner now states outright that the test does **NOT** block the build and that the demo renders nothing
while the sentinel remains (`src/lib/agent-trace.ts:13-16`), which agrees with the docblock at `:114-119`
(the phrase at `:118`), the declaration at `:120`, and what the test actually asserts.

### The bundle budget gate — what replaced `bundle-analysis.yml`

`.github/workflows/bundle-analysis.yml` is **deleted on this branch**. A `Bundle budget` step inside the
existing `e2e` job took over (`ci.yml:115-116` → `scripts/bundle-budget.mjs`), riding on the `pnpm build`
at `ci.yml:101-102`, so CI still compiles exactly once.

**Why the old workflow was deleted rather than repaired.** Its run history (`gh run list`, not inspectable
from the working tree) records 222 runs — 211 green, 11 red — and **zero** artifacts across the 25 most
recent. Three independent causes, each sufficient on its own:

| Cause | Mechanism |
|---|---|
| `next build` in Next 16 is **Turbopack**, not webpack | Nothing here configures a bundler, and `node_modules/next/dist/lib/bundler.js:142-144` — "The default is turbopack when nothing is configured" — sets `TURBOPACK='auto'`. `@next/bundle-analyzer` then no-ops: `node_modules/@next/bundle-analyzer/index.js:7-14` is `if (process.env.TURBOPACK) { console.warn(…); return nextConfig }`, warning "not compatible with Turbopack builds, no report will be generated" and handing back the **untouched** config, so the `webpack()` hook at `:20` is never added. The `ANALYZE=true` build therefore produced **nothing**. The workflow's own comment asserted the opposite — that comment is the origin of the false claim this index carried (see the Resolved ledger below). |
| The `compare` step read a Pages-Router manifest | `nextjs-bundle-analysis` (last published 2023) reads `build-manifest.json.pages`, which is `{"/_app": []}` in this App Router app. Even fully wired it emits `{"raw":0,"gzip":0}` — "this PR introduced no changes to the JavaScript bundle", on every PR, forever. It was also never wired: its ten steps (now readable only in git history, at the revision before the deletion) went straight from the analyse build to `compare`, skipping the `report` step that writes `__bundle_analysis.json`, and `package.json` still has no `nextBundleAnalysis` block — checkable today. |
| Failure was unobservable | `if-no-files-found: warn` plus `continue-on-error: true`. |

`develop` is not branch-protected, so no required check disappeared with it.

**What the replacement measures.** `next build` writes `.next/diagnostics/route-bundle-stats.json` with no
flag and no second build — but **only** under Turbopack (`node_modules/next/dist/build/index.js:2843-2844`
gates `writeRouteBundleStats` on `bundler === Bundler.Turbopack`). So it describes exactly what ships.
Records are `{ route, firstLoadUncompressedJsBytes, firstLoadChunkPaths }`; 16 routes today.

| Assertion | Value | Cite |
|---|---|---|
| Per-route first-load ceiling | 1,285,000 B — ~5% headroom over today's largest, `/` at 1,220,794 B | `scripts/bundle-budget.mjs:50` |
| Route-count floor | 16; fewer means the artifact's shape changed and the gate is lying about coverage | `:35` |
| three.js off the first-load critical path | exactly **1** chunk contains `WebGLRenderer` — 897,249 B (876.2 KiB), i.e. the single "876 KB" copy recorded at `next.config.ts:133-144` — and it appears in **0** of the 16 routes' first-load sets | `:57` (marker), `:119` (check) |
| Every first-load chunk path exists on disk | otherwise the artifact and the build output disagree and the measurement is untrustworthy | `:110` |
| Missing or malformed artifact ⇒ exit 1 | by design; the predecessor's defining flaw was reporting success while measuring nothing | `:25-26`, `:66`, `:75`, `:81` |

**What it deliberately does not do.** No `continue-on-error`, no `if-no-files-found` — the two settings
that made the predecessor unfailable; the rationale is recorded inline at `ci.yml:109-114`. It also does
**not** assert total emitted bytes, so a three.js *twin-chunk* return (two copies, both still lazy) passes
it untouched — that regression is still guarded only by the barrel, per the twin-chunk row in § 9's
failure table. And like the index-citation check it is a **merge** gate, not a **deploy** gate: Vercel runs
`pnpm build` alone, so a bundle regression fails the PR rather than blocking a production deploy.

**`@next/bundle-analyzer` survives as a local attribution tool.** It is still a devDependency
(`package.json:58`) and `next.config.ts:5-7` still wraps the config with it, but the only thing that sets
`ANALYZE` is now the `pnpm analyze` script — `package.json:12`, which is
`velite --clean && ANALYZE=true next build --webpack`, and the explicit `--webpack` is what makes the
plugin do anything at all; it writes `.next/analyze/{client,edge,nodejs}.html`.
The consequence is deliberate and one-directional: a `--webpack`
build emits no `route-bundle-stats.json`, so `scripts/bundle-budget.mjs` fails after `pnpm analyze` and
names `--webpack` as the cause (`:70`). Re-run `pnpm build` before the gate. The plugin says as much
itself: its Turbopack warning ends "To run this analysis pass the `--webpack` flag to `next build`", and it
suggests a Turbopack-native analyzer (`node_modules/@next/bundle-analyzer/index.js:10,12`). Note the
plugin's wording for that alternative — `next experimental-analyze` — is not the installed CLI's shape:
16.3.0 takes it as a **flag** on the build, `next build --experimental-analyze`, and refuses it under any
non-Turbopack bundler (`node_modules/next/dist/cli/next-build.js:57-58`). Nothing in `package.json` or the
`Makefile` wires it up, so it remains an unexplored alternative to the `--webpack` path, not a live one.

### Branch model

`develop` is the integration branch (all feature work targets it; Vercel Preview). `main` is the release
branch, merged from `develop` only (Vercel Production). `make pr` opens feature → `develop`;
`make pr-prod` opens `develop` → `main`. Two consequences recorded in the repo: `codeql.yml` runs on
`develop` **and `main`** pushes/PRs plus a weekly cron (`main` added because a hotfix straight to `main`
would otherwise deploy unscanned); and Dependabot reads `dependabot.yml` from the
**default branch only**, so the `typescript`/`eslint` ignores were inert while they lived on `develop`
(`CHANGELOG.md:252-253`).

### The Pagefind search-index step

`/search` loads `/pagefind/pagefind-ui.css` and `/pagefind/pagefind-ui.js` at runtime by injected tag
(`src/app/search/page.tsx:16-31`). Those files come from `make search-index`
(`Makefile:64-66`), whose `--site .next/server/app` input only exists after `pnpm build`. **There is no
`pnpm search-index` script** — `package.json` has 12 scripts (`:8-21`) and none is named that;
`CLAUDE.md:38-39` now says so explicitly ("this is a Makefile target only"), where it previously
documented the non-existent script. `public/pagefind/` is absent from the working tree and untracked,
so `/search` 404s its Pagefind assets until that target is run against a fresh build. `SEARCH_ENABLED`
does not gate the route — only the nav link and the sitemap entry.

### Failure modes

| Failure | Mechanism |
|---|---|
| Module resolution failure in vitest and next build | `pnpm content` / `velite --clean` skipped; `.velite/` is gitignored. |
| "React.act is not a function" ⇒ every DOM test fails ⇒ deploy fails | Removing `env: { NODE_ENV: "test" }` (`vitest.config.ts:26`). Vitest only defaults `NODE_ENV=test` when unset, but the Vercel build shell sets `production`, which makes React load its prod bundle without `act` (`:19-25`). |
| Every DOM suite runs twice, once without happy-dom globals | Removing the `node` project's `exclude: ["**/*.dom.test.{ts,tsx}", …]` (`vitest.config.ts:34`) — `src/x.dom.test.ts` also matches `src/**/*.test.ts`. |
| "Failing test blocks deployment" property lost | Reordering or splitting the `build` chain into independent commands. |
| Playwright tests a stale build | Without the `webServer` block, a leftover process on :3000 is silently tested — recorded as having produced 5 phantom failures during a release audit (`playwright.config.ts:23-32`). |
| `Executable doesn't exist at .../chromium_headless_shell-<rev>` | Installing browsers with anything other than `pnpm exec playwright install --with-deps chromium`, which pins to the installed `@playwright/test` (`ci.yml:95-98`). |
| Dev server dies with "Can't resolve './projects.json'" | Passing `--clean` to Velite in dev, or setting `clean: true` in `velite.config.ts:125`. |
| Prerender fails "encountered the unstable value `Date.now()`" | An in-render `new Date()`/`Date.now()` under `cacheComponents`. Two live workarounds: the build-time `NEXT_PUBLIC_BUILD_YEAR` (`next.config.ts:107` → `site-footer.tsx:171`) and `/admin/telemetry`'s `export const instant = false` (`:11`) **plus** `await connection()` (`:434`) — the comment at `:428-433` records that `instant=false` alone does **not** clear it. |
| Build fails with "26 errors" | Re-adding any `export const runtime`, `revalidate`, or `dynamic` segment config under `cacheComponents: true`. The RSC transform rejects the mere *presence* of `runtime`, so `"nodejs"` and `"edge"` are indistinguishable to it. `maxDuration` and `preferredRegion` are **not** rejected. |
| Build fails on an empty `generateStaticParams` | `cacheComponents` requires ≥1 result — which is why `src/app/notes/[slug]/page.tsx:34-42` no longer short-circuits on `!NOTES_ENABLED` and instead prerenders those routes as 404s via `notFound()` at `:51`. |
| GitHub polling cadence silently changes | `/api/github/stats` has no segment `revalidate`; the 1-hour cadence lives only in two fetch options (`api/github/stats/route.ts:31` and `src/lib/github.ts:101`, recorded at `:3-7`). |
| `security-alerts` reports nothing while showing green | The default `GITHUB_TOKEN` cannot read the Dependabot alerts API even with `security-events: read` — the restriction is on token **type**; a fine-grained PAT stored as `SECURITY_ALERTS_TOKEN` is required (`ci.yml:198-198`). |
| **CI red immediately after the build step**, "cannot read .next/diagnostics/route-bundle-stats.json" | Only Turbopack writes that artifact (`node_modules/next/dist/build/index.js:2843-2844`), so any build that opted into webpack — `pnpm analyze`, or a `--webpack` flag added to `pnpm build` — leaves the gate nothing to read. It exits 1 and names `--webpack` (`scripts/bundle-budget.mjs:75`). This is the intended behaviour, not a false positive: unmeasurable must be red. |
| First-load JS grows past the ceiling, or three.js lands on the critical path | `scripts/bundle-budget.mjs` fails the `e2e` job (`ci.yml:115-116`). Raising `MAX_FIRST_LOAD_BYTES` (`:45`) is allowed but must be its own commit quoting measured before/after bytes (`:42-43`); an eager `import * as THREE` in a shell component is the failure the byte ceiling alone would miss, because the bytes were always shipped — they just stopped being deferred (`:52-55`). |
| A bundle regression ships green again | Re-adding `continue-on-error` / `if-no-files-found` to the budget step, which is exactly how `bundle-analysis.yml` ran 222 times (211 green, 11 red) and produced zero artifacts, ever (`ci.yml:109-114`). |
| The `@react-three/postprocessing` types regression returns | Loosening the exact `3.0.4` pin (`package.json:32`) or the version-scoped Dependabot `ignore` for `["3.0.5"]` without the other — they are a matched pair. |
| eslint chain breaks | Collapsing the two `brace-expansion` overrides (`@1` → `^1.1.16`, `@>=3` → `^5.0.7`) into one blanket pin, which forces `minimatch@3` onto 5.x (`CHANGELOG.md:223-225`). |
| Dependabot cannot move a transitive advisory | `@modelcontextprotocol/sdk` is exact-pinned to `1.26.0` (`mcp-handler`'s literal peer), producing `security_update_not_possible` — the reason all 10 `pnpm.overrides` exist. |
| `three` bump breaks a peer | `postprocessing@6.39.4` declares `three: >= 0.168.0 < 0.186.0` (`pnpm-lock.yaml:4003`) against a declared `^0.185.1` — one minor of headroom. |

### Flags / env that alter it

`ANALYZE` (`next.config.ts:6`; nothing in CI sets it any more — its one setter is the local `pnpm analyze`
script, `package.json:12`, and without that script's explicit `--webpack` it is inert under Turbopack),
`VELITE_STARTED` (internal re-entrancy guard, `next.config.ts:13-14`),
`CI` (`playwright.config.ts:6-8,36`), `NODE_ENV` (forced to `test` for
the Vitest worker), `NEXT_PUBLIC_BUILD_YEAR` (written by the config), `VERCEL_URL`/
`VERCEL_PROJECT_PRODUCTION_URL` (the alias the health cron must probe, `health-expectations.ts:51-59`)/
`VERCEL_ENV`/`VERCEL_REGION`/`VERCEL_GIT_COMMIT_SHA`/`NEXT_RUNTIME` (platform-set), `CRON_SECRET` (whether the five
schedules do anything), `SECURITY_ALERTS_TOKEN` (repo secret). Note on version pinning: as of v3.5.0
`engines.node` is `">=22 <23"` (`package.json:5-7`) and `.nvmrc` holds the single line `22` — both now
exist (same fact as the scripts row above). Still absent: **no `packageManager`** and **no `.npmrc`**.
The `packageManager` omission is deliberate — commit `ceae0d1` records that adding it would make every
local command resolve a specific pnpm through corepack, judged a separate workflow decision rather than
part of that fix. CI runs Node 22 + pnpm 10 while the gitignored `.vercel/project.json` records
`"nodeVersion": "24.x"` for production.

---

## Cross-subsystem coupling points

Places where one subsystem's change breaks another, gathered from all ten maps — subsystems 1–6 in
[`14-subsystems.md`](./14-subsystems.md), 7–10 above.

| Coupling | Sites that must agree |
|---|---|
| Project group names (3 copies) | `velite.config.ts:4-8` · `src/lib/content.ts:30-34` · `src/lib/game-model.ts:177-181` |
| Graph node ↔ content slug | `src/lib/graph-data.ts:18-41` (`graphNodes`, 16 entries) · `src/lib/game-model.ts:28-50` · gate `src/lib/game-model.test.ts:55-58` |
| Base URL `https://anvilry.vercel.app` (**18 non-test files / 24 occurrences**; `CLAUDE.md:335` now says **19 / 25**, counting `src/lib/mcp-tools.test.ts:69`, and no longer says "four") | The per-file table in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url) is the single authority; re-verify with `grep -rn 'anvilry\.vercel\.app' src Makefile \| grep -v '\.test\.'`. Densest site: `src/components/json-ld.tsx:29,101,125,131,160,168,214` (7 of the 24, one of them inside FAQ prose at `:214`) |
| Error dedupe flag string | `src/app/error.tsx:39` · `src/app/global-error.tsx:33` · `src/instrumentation-client.ts` |
| Beacon `source` enum | `src/lib/telemetry/beacon.ts:42` · `src/app/api/error/route.ts:83` (declared source of truth) |
| Telemetry kind union | `src/lib/telemetry/schema.ts:37-45` · the `/admin/telemetry` kind filter · `scripts/replay-trace.mjs:47-55` |
| Redis key literals | `src/app/admin/telemetry/page.tsx:25,217,251,254,257,260,265` · the five `api/cron/*` writers · `src/lib/telemetry/emit.ts:58` · `src/instrumentation.ts:95` |
| Nav height `3.5rem` / `h-14` | `src/components/site-nav.tsx:57` · `src/components/ui/skeleton.tsx` (`SkeletonViewTransition`) · `chat-view.tsx:52-60` · `developer-view.tsx:36` · `globals.css:58-65` (`scroll-padding-top`) |
| View-transition names | `view-router.tsx:56` · `site-nav.tsx:40` · `globals.css:270-289` |
| Résumé label | `src/lib/profile.ts:77` · `src/lib/mcp-tools.ts:20-26` (`ROLE_TO_LABEL`) · `public/resume/*.pdf` filenames |
| Article `source` enum | `velite.config.ts:109` · `src/components/platform-badge.tsx:13-23` · `src/app/articles/page.tsx:25-32` (`SOURCE_LABELS`) · `articles/[slug]/opengraph-image.tsx:19-26`. **All four are now keyed by `ArticleSource` (`platform-badge.tsx:5-11`), so adding a source to the Velite enum without adding it everywhere is a `tsc` error.** `opengraph-image.tsx` was the exception — `Record<string, string>` with a `?? "> article"` fallback — and it had silently drifted two members behind: `devto` and `hashnode` were missing, so **9 of 15 article OG cards rendered the generic `> article`**. Widening any of these back to `Record<string, …>` re-opens the hole, because the fallback then absorbs the omission instead of failing the build |
| Terminal command visibility filter | `src/components/game/terminal/commands.ts:525-527` (`COMMAND_NAMES`) · `terminal.tsx:17-19` (independent re-filter for the fuzzy dropdown) |
| Terminal input selector | `terminal.tsx:254` (`aria-label="Terminal command input"`) · `terminal-overlay.tsx:39-41` (queries that exact string) |
| CSP `frame-ancestors` string | `next.config.ts:41` (the literal) · `:204-207` (the replace that depends on it) |
| Palette `value` pinning | `command-palette-content.tsx:321-323` (`copy-email`), `:454-455` (`voice-tts`), plus four other voice toggles — cmdk re-scores when a label mutates |
| `MDXContent` ↔ CSP | `src/components/mdx-content.tsx:14-17` · `next.config.ts:43-51` (`'unsafe-eval'`) |
| `.md` passthrough (two implementations) | `next.config.ts:220-228` (4 rewrites → `/api/md/*`) · `src/app/<collection>/[slug].md/route.ts` (4 filesystem handlers). Byte-identical output; resolution order not exercised. |

---

## Entry-point cheat sheet

"If you want to change X, start at file Y." All paths are repo-relative to
`/Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/`.

| If you want to change… | Start at | Then also touch / be aware of |
|---|---|---|
| Add or edit a case study / OSS project / note / article | `content/<collection>/<slug>.mdx` (or `make new-work SLUG=…`) | Run `pnpm content`. A new work/project **requires** a matching node in `src/lib/graph-data.ts:18` (`graphNodes`) and an entry in `src/lib/game-model.ts:28` or `game-model.test.ts:55-58` fails `pnpm build`. |
| Add or change a content **field** | `velite.config.ts` (the relevant `defineCollection`) | Make it `.optional()` or every existing file fails validation at once. Then `src/lib/content.ts`, plus any projection that should surface it. |
| Change how content is sorted / filtered / subsetted | `src/lib/content.ts:18-71` | `pinned` without `pinRank` is dropped (`:26-28`); notes/articles sort by ISO **string** compare (`:50,:68`). |
| Change what the chatbot knows | `src/lib/corpus.ts:13-76` | Guarded by `src/lib/corpus.test.ts`. `register` flows verbatim from `:17`. Also feeds `/llms-full.txt` and the terminal `grep`. |
| Change the LLM model chain, provider, or credentials | `src/lib/llm.ts:31-38` (chains), `:52-54` (provider), `:63-97` (creds/region) | Both docs now state the chain correctly and Sonnet-primary — `CLAUDE.md:200` and `DEPLOY.md:92-101` (the "inverted chains" discrepancy this index recorded in `DEPLOY.md` is fixed; `:101` says so outright). `src/lib/llm.test.ts:156,282` pins two model ids. Update `BEDROCK_PRICE` (`api/chat/route.ts:24-46`) or `cost_usd` will be wrong-but-non-zero. |
| Change the streaming fallback rule | `src/lib/llm.ts:433` | `emittedAny` also gates trace-frame emission (`:405`) and the thinking sentinel (`:330`). Pinned by `src/lib/llm.test.ts:253-309`. |
| Change chat request limits / validation | `src/app/api/chat/route.ts:61-62,177-249` | `MAX_MESSAGES`, `MAX_CHARS`, the 2 MB ceiling, the 10000-char PDF-block cap, the mediatype allowlists. |
| Change the chat wire protocol | `src/lib/llm-trace.ts:23-25` | Pinned byte-for-byte by `src/lib/llm-trace.test.ts`. `use-chat.ts:60-116` parses it; `api/cron/eval/route.ts:95` duplicates `TRACE_DELIMITER` as a literal. |
| Add a card or command token the model can emit | `src/components/chat/parse-cards.ts:33` (grammar) + `:54-68` (resolution) | Charset is locked to `[a-z0-9-]`. Dispatch lives in `chat-messages.tsx:297-311`. Gate: `parse-cards.test.ts`. |
| Change markdown rendering of assistant text | `src/components/chat/markdown-message.tsx:47-93` | Do not remove `skipHtml` or override `urlTransform` — that is the XSS posture (`:10-16`). |
| Add or reorder a **view** | `src/components/view-context.tsx:24-37` (union, `VIEWS`, `VIEW_ORDER`) | Then `view-router.tsx:58-69`, `enabled-views.ts:20-21`, `view-switcher.tsx:16-28`, and `parse-cards.ts:60-63` (which validates `cmd:view` against `VIEWS`). `view-context.test.ts` pins the SSR default. |
| Change the view-transition animation | `src/app/globals.css:257-299` | The named groups come from `view-router.tsx:56` and `site-nav.tsx:40`; direction from `view-context.tsx:133-136`. |
| Change SSR/first-paint view behaviour | `src/components/view-context.tsx:64-65` | `getServerSnapshot` must stay `DEFAULT_VIEW` — `view-context.test.ts:30-34` is the guard. |
| Add or change a voice engine | `src/lib/voice-catalog.ts` (add to `CURATED_VOICES`/`EXTENDED_VOICES`) | Three lookup Maps build at module load (`:298-312`); adding a voice anywhere else leaves it un-lookupable and un-allowlisted. Then `use-speech-synthesis.ts` and, for a new server engine, a new `api/tts-*` route + cache. |
| Change voice defaults or add a persisted setting | `src/lib/voice-settings-context.tsx:77-88` (`DEFAULTS`) + `:92-158` (`parse`) | Every capability must stay default-OFF; `voice-settings-context.test.ts` asserts it. `parse` must never throw. |
| Add a voice surface | `src/components/chat/voice-surface-mutex.ts:23` (`VoiceSurfaceId`) | Create a store that calls `registerVoiceSurface` at module scope and `claimVoiceSurface` at the top of `open*()`; then route to it from `header-orb-trigger.tsx:69-78`. |
| Change how the mic opens | `src/components/chat/use-speech-recognition.ts:161-164` | `continuous = false` is load-bearing for the whole half-duplex loop (`use-voice-session.ts:26-31`). `mic-button.tsx:60-63` is the consent gate. |
| Add an MCP tool | `src/lib/mcp-tools.ts` (impl + Zod raw-shape schema) | Then register it in `src/app/api/mcp/[transport]/route.ts`. Also update the hand-written `TOOLS` table at `src/app/mcp/page.tsx:35-45`. The count drift is **fixed**: the page listed 7 while the route registered 9 (`list_all_content` and `get_content_item` were live but undocumented); the page now documents all nine, and `route.ts:22` + `CLAUDE.md:212,303` say 9 too. It is now enforced, not just corrected — `src/app/mcp/tools-documented.test.ts` reads both the page's `TOOLS` block and the route's `registerTool` calls from source and fails the build if they disagree (`:25-40`), so it cannot silently drift again. Never import `personal.ts` (`mcp-tools.test.ts:22`). |
| Change the MCP not-found contract | `src/lib/mcp-tools.ts:42-48` | `route.ts:13` keys `isError` on the literal `notFound` property; renaming it turns errors into successes. |
| Add a telemetry span kind | `src/lib/telemetry/schema.ts:37-45` | Then the `/admin/telemetry` kind filter and `scripts/replay-trace.mjs:47-55` (hardcoded `KINDS`). `schema.test.ts:150` pins the 7-kind union. |
| Change what is redacted from telemetry | `src/lib/telemetry/schema.ts:83-106` | Order is load-bearing (email → 32-char token → 12–19 digit run). Callers must redact **before** `emit` — `emit` does none (`emit.ts:30-35`). |
| Change telemetry retention | `src/lib/telemetry/emit.ts:42` (`SEVEN_DAYS_MS`) | Also `scripts/replay-trace.mjs:64`, which computes its own `since` from the same window. |
| Add a dashboard tile | `src/app/admin/telemetry/page.tsx` | Add the Redis read to the `Promise.all` at `:449-459`; every fetch helper must stay fail-soft (`:22-38,203-212`). Warn thresholds are inline magic numbers (`:545,567,689,708,718-719`). |
| Change `/admin` auth | `src/proxy.ts:22-79` | `src/lib/admin-auth.ts` is the unwired Node twin — keep them in agreement or `/admin` can pass one and fail the other (`proxy.ts:11-20`). The page itself checks nothing. |
| Add an authenticated route | `src/proxy.ts:22-24` (`config.matcher`) | Currently exactly `["/admin/:path*"]`. |
| Add a cron job | `vercel.json:3-7` + a new `src/app/api/cron/<name>/route.ts` | Copy the fail-closed `CRON_SECRET` guard verbatim (e.g. `github-sync/route.ts:18-22`). `CLAUDE.md:156-157` now lists all five and records that they are all fail-closed; it previously listed one. |
| Change the CSP or a security header | `next.config.ts:37-95` | `'unsafe-eval'` is required by `MDXContent`; the three speech WebSocket hosts keep voice working in Chrome/Edge; the `/resume` override is a literal string replace of `:41`. HSTS is deliberately absent. |
| Change rate limits | `src/lib/rate-limit.ts:22-25` | One budget shared by chat, tts, tts-google, transcribe, error. `/api/visit` has its own (`api/visit/route.ts:27-34`). Both fail-open paths are deliberate (`:73,79-82`). |
| Add a build-time feature flag | `src/lib/writing-flags.ts` (or a component-local read) | Match the `=== "true"` convention (only `ARTICLES_ENABLED` is `!== "false"`). Read it **inside** a function body if a test needs `vi.stubEnv`. Then `.env.example`, `docs/configuration.md`, and `Makefile:154-180` (`flags-show`). |
| Migrate a flag to runtime toggling | `src/lib/flags.ts:17-29` | Also declare it in `src/app/.well-known/vercel/flags/route.ts:11-22`; requires `FLAG_DRIVER=vercel` + `FLAGS_SECRET`. `FLAG_DRIVER` is captured at module load (`:13`). |
| Gate which views exist in a build | `src/lib/enabled-views.ts:20-40` | Unset ⇒ all on; empty string ⇒ all optional off. `classic` and `resume` cannot be disabled. |
| Change a 3D scene | `src/components/hero-graph/scene.tsx` · `hero-avatar/avatar-scene.tsx` · `game/build-graph-scene.tsx` · `chat/voice-orb-3d.tsx` | Import from `@/lib/r3f`, never directly (`scene-physics.tsx:4-6` is the one exception). On a demand frameloop something must call `invalidate()`. |
| Change when 3D mounts at all | `src/components/hero-graph/index.tsx:35` · `hero-avatar/index.tsx:56` · `game/build-graph.tsx:50` · `chat/voice-orb.tsx:42` | All four gates include the desktop + reduced-motion terms; the hero gates also include `view === "classic"`. |
| Swap the avatar model | `public/avatar/sairam.glb` + `src/components/hero-avatar/avatar-mesh.tsx:10,27,54` (path in 3 places) | `src/lib/avatar-glb.test.ts` blocks the build on size (<1.5 MB), glTF 2.0, meshopt+quantization+WebP, named bones, and the current **zero** morph targets (`:132-157`). |
| Add a terminal command | `src/components/game/terminal/commands.ts:503-508` (registry) | 31 entries today (27 visible + 4 hidden) — `CLAUDE.md:115` and `ARCHITECTURE.md:74` now both say 31; the "~16" this index flagged in those two docs is fixed. Keep `COMMAND_NAMES` `!hidden`-filtered (`:525-527`) **and** the independent re-filter at `terminal.tsx:17-19`. Return a `NavAction`; never import the router. |
| Change build ordering or add a build step | `package.json:11` | The `&&` chain is the deploy gate. `lint` and `tsc --noEmit` are CI-only (`ci.yml:46-50`), as is the bundle budget (`ci.yml:115-116`). Do **not** add `--webpack` to `build`: it silently stops `.next/diagnostics/route-bundle-stats.json` being written and the budget gate then fails by design (`scripts/bundle-budget.mjs:75`). |
| Raise the first-load JS budget, or profile what is in a chunk | `scripts/bundle-budget.mjs:50` (`MAX_FIRST_LOAD_BYTES`) · `pnpm analyze` (`package.json:12`) for attribution | Raise the constant in its **own** commit quoting measured before/after bytes (`:42-43`) — never by adding `continue-on-error` to the step. `pnpm analyze` is local-only, needs the explicit `--webpack`, and writes `.next/analyze/{client,edge,nodejs}.html`; re-run `pnpm build` afterwards or the gate has no artifact to read. |
| Change the test runner setup | `vitest.config.ts` | Do not remove `env: { NODE_ENV: "test" }` (`:26`) or the `node` project's `dom` exclude (`:34`). |
| Change E2E coverage | `e2e/views.spec.ts` · `e2e/resume.spec.ts` · `playwright.config.ts` | `webServer` runs `pnpm start`, so CI builds first (`ci.yml:100-102`). E2E does not block `pnpm build`. |
| Point a custom domain at the deployment | `src/app/layout.tsx:26` | Then the other **17 files** (24 occurrences in total, plus `src/lib/mcp-tools.test.ts:69` and the `next.config.ts:195` comment) — the enumerated table in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url) is the single authority. `CLAUDE.md:335` now gives the full count (19 files / 25 occurrences, test included) instead of four. |
| Regenerate the search index | `Makefile:64-66` (`make search-index`) | Must run **after** `make build`; `pnpm search-index` does not exist. Output goes to the untracked `public/pagefind/`. |
| Add or bump a dependency | `package.json:23-74` (33 prod + 17 dev) | Respect the exact pins (`next`/`eslint-config-next` 16.3.0, `react`/`react-dom` 19.2.8, `@modelcontextprotocol/sdk` 1.26.0, `@react-three/postprocessing` 3.0.4), the `three < 0.186.0` ceiling from `postprocessing`, and the 10 overrides — which now live in `pnpm-workspace.yaml:18-28`, **not** a `pnpm` field in `package.json`. |
| Add a Dependabot hold | `.github/dependabot.yml` | It is read from the **default branch only** — on any other branch it is inert. `ignore` entries accept a version-scoped `versions: ["x.y.z"]` form as well as a bare package name. |
| Replay one request end to end | `make trace TRACE_ID=…` → `scripts/replay-trace.mjs` | The id comes from the `x-anvilry-trace-id` response header (`with-trace.ts:207`). Needs both Upstash vars; window is 7 days. |
| Audit which env vars are set | `make env-check` / `make flags-show` | Both read the **process** environment, not `.env.local`, so they under-report locally (`Makefile:288-314,154-180`). |

---

## UNVERIFIED / carried forward

Every item below was left open by the section it came from, or is a limitation of this two-part synthesis
(subsystems 1–6 are in [`14-subsystems.md`](./14-subsystems.md)). Two prior open questions were resolved
and are recorded in the subsystem maps themselves — subsystem 4 and subsystem 6, both in part 1 — rather
than here.

**Resolved**

The first two were resolved while writing this section. The rest were resolved afterwards — by the fix
branch, or (for the last entry) by the v3.5.0 dependency removals; those entries record the outcome rather
than the original open question.

- `budget.tick` has **no producer** in `src/` — declared at `src/lib/telemetry/schema.ts:44`, asserted at
  `schema.test.ts:150`, consumed at `src/app/admin/telemetry/page.tsx:376`, and emitted nowhere
  (grep of `src/` for `budget.tick` returns only those four sites). Section 04 left this open.
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
  also sets `redirect: "manual"` (`src/app/api/cron/health-check/route.ts:78`) and fails **any** 3xx,
  naming Vercel SSO when the `location` matches (`:86-98`), so a redirect can never be silently
  followed to a healthy-looking 200. (2) Expectations are per-check, with `mcp_get: 405` in
  `EXPECTED_STATUS_OVERRIDES` (`health-expectations.ts:30-32`), applied via
  `isExpectedStatus` at `src/app/api/cron/health-check/route.ts:103`; the probed row itself is
  `route.ts:61`. The 405 is mcp-handler's own unconditional JSON-RPC reply on the Streamable-HTTP
  endpoint — verified live, alongside `GET /api/mcp/sse → 404` and a POSTed `initialize → 200` — so it
  still proves the route is mounted and the handler is alive; the reasoning and the upgrade caveat are
  at `health-expectations.ts:1-29`, guarded behaviourally by `src/lib/health-expectations.test.ts`
  (`:28` the 405 expectation, `:73` the `probeBase` alias-over-deployment suite, `:161` the
  mcp-handler version pin, `:173` the "405 branch is still unconditional" check). Note the route's own
  comment at `route.ts:99-100` still repeats the old "failed on every single run" reading — the code is
  right, that one comment is not. The old `EXPECTED_STATUS` map and its source-grep guard
  `expected-status.test.ts` are **deleted**, and the caveat comment no longer points at the dead file:
  it now names `health-expectations.test.ts` as what pins the mcp-handler version and asserts the GET
  branch is still unconditional (`health-expectations.ts:26`). An earlier reading of this index
  recorded that comment as still naming `expected-status.test.ts` — that dangling reference is gone.
- **`/mcp` as `(force-static)`** — the documentation/source mismatch this index recorded is gone.
  `src/app/mcp/page.tsx` still exports no segment config and a grep for `force-static` across `src/`
  still returns nothing (re-verified), and `CLAUDE.md:140` now documents the route as "no segment
  config" instead of `(force-static)`.
- **Whether `next build` still uses webpack by default in Next 16 — it does NOT, and the claim this index
  carried was FALSE.** It is **Turbopack**. The claim's only source was the now-deleted
  `bundle-analysis.yml`'s own comment ("`next build` uses webpack by default in Next.js 16 (Turbopack is
  opt-in via --turbopack flag, dev-only)"), which this index recorded as the repo's own claim rather than
  as fact — correctly cautious, and the caution was warranted. Nothing in this repo configures a bundler,
  and `node_modules/next/dist/lib/bundler.js:142-144` — "The default is turbopack when nothing is
  configured" — sets `process.env.TURBOPACK = 'auto'`; a bare `next build` on this branch banners
  `▲ Next.js 16.3.0 (Turbopack)` (the version agrees with `.next/diagnostics/framework.json`). `next dev`
  resolves its bundler through the same function (`node_modules/next/dist/cli/next-dev.js:173`). Two
  consequences, both recorded in § 10 The bundle budget gate: the deleted workflow's `ANALYZE=true` build
  could never emit a report, because `@next/bundle-analyzer` is webpack-only; and the artifact the
  replacement gate reads, `.next/diagnostics/route-bundle-stats.json`, exists *because* the build is
  Turbopack (`node_modules/next/dist/build/index.js:2843-2844`). **What does not change:** the 876 KB
  single-chunk three.js result at `next.config.ts:133-144` was always a **Turbopack** measurement — its
  own text says the flag "does NOT collapse the R3F twin-chunk in Turbopack" (`:128-129`) — and
  `scripts/bundle-budget.mjs:54` re-measures the same chunk at 897,249 B. That invariant and
  `src/lib/r3f.ts`'s load-bearing role both stand; only the bundler attribution was wrong.
- **Whether `@react-three/offscreen` and `@react-three/rapier` were retained intentionally** — answered by
  deletion. Neither was imported anywhere in the repo, and **both were removed from `package.json` in
  v3.5.0** (prod dependency count 35 → 33). `docs/superpowers/plans/2026-06-23-c4-r3f-physics.md:5,7,9` is
  the origin of the rapier install and never said why it stayed after the physics variant shipped without
  it; the answer is that it should not have. The two absence observations this index recorded still hold and
  are now permanent rather than provisional: there is no worker/OffscreenCanvas path
  (see [§ Perf decisions](#perf-decisions-concretely)), and `NEXT_PUBLIC_GRAPH_PHYSICS` gates a sinusoidal
  drift variant, not a physics engine. Two artefacts outlive the packages and are **not** cleaned up:
  the CSP still carries `worker-src 'self' blob:` (`next.config.ts:68`) for a worker that never existed,
  and the mount-side comment at `hero-graph/index.tsx:13-14` still describes rapier as declared-but-unused.

**Still open**

- **Which `.md` implementation serves a live request.** `next.config.ts:220-228` returns the bare-array
  (afterFiles) `rewrites()` form pointing at `/api/md/<collection>/:slug`, and filesystem handlers also
  exist at `src/app/<collection>/[slug].md/route.ts`. Resolution order was not exercised against a running
  server. Both paths produce byte-identical output.
- **That `src/proxy.ts` executes on the Edge runtime.** Its docblock (`:5`) and `CLAUDE.md` both assert it,
  the code uses only Web Crypto + `atob`, and no Node-proxy opt-in exists in `next.config.ts` (verified
  absent) — but the app was not run to confirm the runtime Next 16 assigns.
- **That Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}` automatically.** The claim comes from
  the route docstring (`src/app/api/cron/eval/route.ts:12-13`); platform behaviour was not verified.
- **Runtime cache/CDN behaviour of the statically-eligible routes** (`/llms.txt`, `/llms-full.txt`,
  `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/api/resume.json`). None sets `Cache-Control` and none reads
  the request, so all are prerenderable under `cacheComponents`, but no build manifest was inspected to
  confirm each was actually prerendered.
- **Render-mode / revalidate / prerendered-slug values** in section 01's route matrix came from a local,
  gitignored build dated 15 Aug and reflect that machine's `.env.local` flag values (notably
  `NEXT_PUBLIC_NOTES_ENABLED` was on). A production build with different `NEXT_PUBLIC_*` values prerenders
  a different slug set. Segment-config columns are read from source and are env-independent.
- **Whether `/articles/<slug>` routes that `redirect()` emit a prerendered page artifact.** Several slugs
  present in `generateStaticParams` have an `opengraph-image` manifest entry but no page entry — consistent
  with the redirect path, not proven.
- **Whether the CSP was ever actually deployed as `Content-Security-Policy-Report-Only`,** and the contents
  of the Playwright zero-violation sweep referenced at `next.config.ts:84-88`. No such audit script or spec
  was located in `e2e/`.
- **Whether `SECURITY_ALERTS_TOKEN` is configured** (not inspectable from the working tree), so whether
  `ci.yml`'s `security-alerts` job reports anything today is unknown.
- **Whether the E2E CI job is a required check** on `develop`/`main` — the job exists
  (`ci.yml:68-127`) but branch-protection settings are not in the repo. Partially answered on this branch:
  `develop` is **not** branch-protected, which is what made deleting `bundle-analysis.yml` safe.
- **Whether Vercel sets HSTS by platform default** (`next.config.ts:73-74`) — asserted in a comment, not
  verifiable from this repo.
- **Whether the Vercel build shell sets `NODE_ENV=production`** (the stated reason for
  `vitest.config.ts:26`) — taken from the config comment.
- **What generates `public/static/`.** It is an empty, untracked directory; the only references are
  `src/lib/case-study-depth.test.ts:24` and `eslint.config.mjs:19`. No script writes to it. The related
  defect this index recorded — `manifest.ts` declaring PWA screenshots at
  `/static/screenshot-{desktop,mobile}.png` with no such file under `public/`, so both URLs 404 — is
  **fixed**: `src/app/manifest.ts` no longer has a `screenshots` key at all (`icons` at `:14-18` is the
  last entry), and the comment at `:19-24` records what was dropped, why, and how to re-add it.
  `src/app/manifest.test.ts` now pins the current shape (`:66` asserts zero screenshots) and walks
  whatever *is* declared, so a re-added screenshot with no file behind it fails the build.
- **Actual PDF text extraction under `pdfjs-dist` 6.2.108.** Commit `2f309d2` flags it as NOT VERIFIED
  (needs a real browser upload); build and typecheck pass but the extraction path was never exercised
  post-bump.
- **Whether migrating `zod` from `^3.25.76` to v4 breaks the raw-shape schema handoff** to `mcp-handler`'s
  `registerTool` (`src/lib/mcp-tools.ts:29-36`). Both constraining peers already permit v4
  (`pnpm-lock.yaml:911`), but nothing in the repo exercises v4.
- **Whether `eslint.config.mjs`'s `globalIgnores` replaces or merges with `eslint-config-next`'s built-in
  ignores.** The comment at `:8` says "Override default ignores" and the list re-declares the four
  defaults, implying replace; flat-config merge semantics were not verified against the installed package.
- **Runtime bundle boundaries** are inferred from `use client` directives, `dynamic()/ssr:false` wrappers,
  and route-handler placement — not from reading `.next/` chunk manifests. Narrowed on this branch: the
  first-load surface is no longer inferred at all, because `scripts/bundle-budget.mjs` reads Next's own
  per-route artifact in CI (16 routes, largest `/` at 1,220,794 B, three.js in 0 of them) — but that gate
  reports first-load bytes and chunk paths, not which module put them there, so *why* a boundary falls
  where it does is still inference. The three.js single-chunk figure is now measured twice over:
  `next.config.ts:133-144`'s recorded build and `scripts/bundle-budget.mjs:54`'s 897,249 B.
- **No command was executed for either part of this synthesis** beyond four read-only greps/`sed` reads
  (`budget.tick` sites, `getDefaultVoiceId`, `force-static`, and the two source excerpts quoted in
  [`14-subsystems.md`](./14-subsystems.md)) — plus, in this branch's bundle-gate correction, one read-only
  `node scripts/bundle-budget.mjs` against an already-present `.next/` (exit 0, numbers as quoted above).
  `pnpm build`, `pnpm test`, `pnpm lint`, `tsc --noEmit`, and `pnpm e2e` were **not** run; all behaviour
  described is read from source, not observed at runtime.
- **Stale-comment / doc-drift items carried forward** without further investigation (each cited in its
  originating section): the `highlight-store.ts:9-10` claim that `project-card.tsx` subscribes;
  `open-to-work-banner.tsx:6-8` "hidden via CSS (h-0)";
  `home/resume-view.tsx:12-14` "ViewEscapeHatch auto-rendered by view-router";
  `anvil-core-surface.tsx:20-22` "~200px reactive orb"; `easter-eggs.tsx:57-66` "once per session";
  `use-trace-runner.ts:69-70` "Reset when the scenario changes";
  `CLAUDE.md:249`'s `src/lib/voice-settings.ts` (the real file is `voice-settings-context.tsx`);
  `ARCHITECTURE.md:99` listing `EXTENDED_THINKING` among `NEXT_PUBLIC_*` flags.
- **Four stale-comment items previously listed above are now FIXED** by the comment sweep on the fix
  branch, and are dropped from the carried-forward list rather than renumbered: `graph-data.ts:3` no
  longer counts systems ("every flagship work system + every OSS repo … see `graphNodes` below for the
  count"); `game-model.ts:19` now reads "3 of the **16** graph node ids" and names the three affected ids
  instead of quoting a stale percentage; `scene.tsx:17-18` is count-agnostic ("Count is taken from
  `graphNodes.length`"); and `agent-trace.ts:13-16` no longer claims the test "BLOCKS shipping" (see
  [§ Tests as a gate](#tests-as-a-gate--what-that-actually-means)).
