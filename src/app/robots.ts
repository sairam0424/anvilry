import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Cloudflare Content Signals Policy (CC0 convention) — a stated preference,
      // not a technical block. No crawler/LLM is confirmed to act on this directive
      // as of this writing; it makes this repo's existing LICENSE content-exclusion
      // clause machine-visible at the one place a crawler actually looks.
      // ai-input=yes is deliberate: it protects the MCP server + llms.txt/llms-full.txt
      // investment's entire purpose (being cited/grounded-against by an AI agent).
      other: { "Content-Signal": "search=yes, ai-input=yes, ai-train=no" },
    },
    sitemap: "https://anvilry.vercel.app/sitemap.xml",
  };
}
