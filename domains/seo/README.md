---
kind: domain
domain: seo
status: active
goal: Maximize organic reach via llms.txt, structured data, sitemap, and canonical URLs
cadence: weekly
---

# seo — discoverability loop

Monitors and improves search engine and LLM discoverability. Consumes the sitemap, llms.txt,
structured data (JSON-LD), and Vercel Analytics. Produces updated SEO configs, structured data
improvements, and signals flagging crawl issues or missed opportunities.

## Current focus
Ensure all article and project pages have correct `og:image`, `og:description`, and
`DefinedTerm` JSON-LD structured data added in v2.5.0 is rendering correctly.

## Backlog
- [ ] Verify llms.txt is up to date with all content routes after v2.8.0 merge
- [ ] Check `sitemap.ts` includes all dynamic routes (articles, notes, work, projects)
- [ ] Confirm `robots.ts` allows crawling of all public routes
- [ ] Validate JSON-LD structured data on article pages (DefinedTerm + Article schema)
- [ ] Check canonical URLs are set correctly on all cross-posted articles
- [ ] Monitor Google Search Console for crawl errors (manual task — flag as signal if found)

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- `llms.txt` route status: `curl -s http://localhost:3000/llms.txt | wc -l`
- Sitemap entry count: `curl -s http://localhost:3000/sitemap.xml | grep -c '<url>'`
- Structured data: validate via Google Rich Results Test

## Timeline
2026-06-24 | bootstrap — domain charter created; v2.5.0 shipped llms.txt + DefinedTerm JSON-LD
