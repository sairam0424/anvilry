import { allNotes } from "@/lib/content";
import { profile } from "@/lib/profile";

// Hand-rolled RSS (no dep), force-static — prerendered like the rest of the SSG surface.
// Empty-safe: with no published notes the feed is valid but item-less.
export const dynamic = "force-static";

const BASE = "https://anvilry.vercel.app";

/** Escape the 5 XML predefined entities so titles/summaries can't break the document. */
function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const items = allNotes
    .map(
      (n) => `    <item>
      <title>${xml(n.title)}</title>
      <link>${BASE}${n.url}</link>
      <guid>${BASE}${n.url}</guid>
      <pubDate>${new Date(n.date).toUTCString()}</pubDate>
      <description>${xml(n.summary)}</description>
    </item>`,
    )
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(profile.name)} — Engineering Notes</title>
    <link>${BASE}/notes</link>
    <description>Engineering notes &amp; writing by ${xml(profile.name)}.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(feed, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
