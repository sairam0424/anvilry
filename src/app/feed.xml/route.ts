import { allNotes, allArticles } from "@/lib/content";
import { profile } from "@/lib/profile";

// Hand-rolled RSS (no dep).
// Empty-safe: with no published notes the feed is valid but item-less.
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
  // Merge notes + articles sorted newest first for a unified writing feed.
  // External articles use the canonical externalUrl in <link>/<guid> so RSS readers
  // open the original publication, not the redirect stub on this domain.
  type FeedItem = { title: string; link: string; guid: string; pubDate: string; description: string };

  const noteItems: FeedItem[] = allNotes.map((n) => ({
    title: n.title,
    link: `${BASE}${n.url}`,
    guid: `${BASE}${n.url}`,
    pubDate: new Date(n.date).toUTCString(),
    description: n.summary,
  }));

  const articleItems: FeedItem[] = allArticles.map((a) => ({
    title: a.title,
    link: a.externalUrl ?? `${BASE}${a.url}`,
    guid: a.externalUrl ?? `${BASE}${a.url}`,
    pubDate: new Date(a.date).toUTCString(),
    description: a.summary,
  }));

  const allItems = [...noteItems, ...articleItems].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
  );

  const items = allItems
    .map(
      (i) => `    <item>
      <title>${xml(i.title)}</title>
      <link>${xml(i.link)}</link>
      <guid>${xml(i.guid)}</guid>
      <pubDate>${i.pubDate}</pubDate>
      <description>${xml(i.description)}</description>
    </item>`,
    )
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(profile.name)} — Writing</title>
    <link>${BASE}/articles</link>
    <description>Articles, notes &amp; engineering writing by ${xml(profile.name)}.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(feed, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
