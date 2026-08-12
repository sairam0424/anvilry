---
kind: domain
domain: seo
status: active
goal: Maximize organic reach via structured data, sitemap, and canonical URLs (NOT llms.txt — see below)
cadence: weekly
---

# seo — discoverability loop

Monitors and improves search engine and LLM discoverability. Consumes the sitemap, structured data
(JSON-LD), and Vercel Analytics. Produces updated SEO configs, structured data improvements, and
signals flagging crawl issues or missed opportunities.

## Current focus
Ensure all article and project pages have correct `og:image`, `og:description`, and
`DefinedTerm` JSON-LD structured data added in v2.5.0 is rendering correctly.

## llms.txt — retained for coding agents ONLY, not for search (corrected 2026-08-12)

The original charter listed llms.txt as an organic-reach mechanism. That rationale is **empirically
wrong** and has been removed. Evidence:

- **Google Search ignores it, explicitly.** Search Central's AI-optimization guide (llms.txt note added
  2026-06-15): "you don't need to create new machine readable files, AI text files, markup, or
  Markdown … Doing so will **neither harm nor help** your site's visibility or rankings in Google
  Search, as Google Search **ignores them**."
- **Almost nothing fetches it.** In a 137,210-domain first-party-log census (May 2026), 28% publish a
  200-returning llms.txt and **97% of those saw zero requests** that month. Of the traffic that did
  occur, AI **retrieval** bots — the ones that actually produce citations — were **1.1%** (233 requests).
  Slackbot alone out-fetched PerplexityBot. OAI-SearchBot 0.74%, ClaudeBot 0.80%.
- **Corroborated by six independent datasets**, including SE Ranking (~300K domains) finding that
  *removing* llms.txt as a model feature **improved** prediction accuracy, and Trakkr (n=37,894)
  finding 6.8 vs 6.7 citations, Mann-Whitney p=0.85 (i.e. no effect).
- **The one real consumer: coding/agentic infrastructure — 10.5% of AI fetches, with Claude-Code
  ranked #2 among all named AI tools**, out-fetching every AI retrieval bot, assistant, and training
  crawler. *That* is the defensible reason to keep the file.

**Therefore:** keep `llms.txt` / `llms-full.txt` / the per-route `.md` endpoints, justified as an
**agent-facing developer surface**. The footer already links it (`site-footer.tsx`), so the
discoverability precondition is met. **Do not invest further surface area, and do not attribute any
search benefit to it.** Caveat on the 97%: it rests on Cloudflare-Logpush coverage that is not
per-domain disclosed, so read it as "≤97% confirmed-unfetched," and "fetched" ≠ "read" either way.

**Also note:** the per-route `.md` endpoints are *not* covered by Google's "ignores them" assurance —
Google treats them as ordinary crawlable documents, so the duplicate-content question for
`/work/[slug].md` vs `/work/[slug]` is **unresolved**, not answered. Worth a canonical check.

## No separate GEO/AEO discipline

Google: "optimizing for generative AI search is optimizing for the search experience, and thus **still
SEO**." Its own mythbusting section names **content "chunking"** and **rewriting content just for AI**
as things you do *not* need to do. There is no generative-AI-specific schema.org type, so do not add
AI-targeted schema hoping for a lift. Conversely, **do not cut the existing JSON-LD** — the claim that
it is justified only by classic rich results was tested and **refuted**. The six shipped schemas
(Person, BreadcrumbList, SoftwareSourceCode, FAQPage, ProfilePage, WebSite) stay as maintained infra.

The one genuinely actionable item is an eligibility gate, not a content tactic: a page must be indexed
and snippet-eligible, **and** the site must be included via Search Console → Settings → **Search
generative AI** (in effect 2026-06-17; states Include/Exclude/Inherit; defaults to Include, so for most
owners this is a verification step). Scoped to Google only — it explicitly declines to speak for
ChatGPT/Claude/Perplexity.

## Backlog
- [ ] **Verify Search Console → Settings → Search generative AI = Include** (5 min, no code)
- [ ] Resolve the `.md`-endpoint duplicate-content question — are canonicals set for `/work/[slug].md`?
- [ ] Check `sitemap.ts` includes all dynamic routes (articles, notes, work, projects)
- [ ] Confirm `robots.ts` allows crawling of all public routes
- [ ] Validate JSON-LD structured data on article pages (DefinedTerm + Article schema)
- [ ] Check canonical URLs are set correctly on all cross-posted articles
- [ ] Monitor Google Search Console for crawl errors (manual task — flag as signal if found)
- [ ] ~~Verify llms.txt is up to date after v2.8.0 merge~~ — deprioritized; keep it correct, stop growing it

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- `llms.txt` route status: `curl -s http://localhost:3000/llms.txt | wc -l`
- Sitemap entry count: `curl -s http://localhost:3000/sitemap.xml | grep -c '<url>'`
- Structured data: validate via Google Rich Results Test

## Timeline
2026-06-24 | bootstrap — domain charter created; v2.5.0 shipped llms.txt + DefinedTerm JSON-LD
2026-08-12 | llms.txt rationale corrected from "organic reach" to "coding-agent surface only" after an
            adversarial research pass (Google Search Central + a 137,210-domain log census + 6
            corroborating datasets). GEO/AEO recorded as not-a-discipline. JSON-LD retained — the
            deflationary case against it was refuted.
