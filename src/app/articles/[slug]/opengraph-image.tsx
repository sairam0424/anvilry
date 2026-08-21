import { ImageResponse } from "next/og";
import type { ArticleSource } from "@/components/platform-badge";
import { allArticles, getArticle } from "@/lib/content";
import { profile } from "@/lib/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * MUST be keyed by ArticleSource, not string. This map was `Record<string, string>` and had drifted
 * two members behind `velite.config.ts`'s `source` enum: `devto` and `hashnode` were missing, so
 * **9 of 15 articles** rendered the generic `> article` fallback on their OG card. The two sibling
 * copies (`platform-badge.tsx`, `articles/page.tsx`) are keyed by `ArticleSource`, which is why tsc
 * catches an omission there and structurally could not here.
 *
 * With the exact key type, adding a source to the Velite enum without adding it here is a
 * type error. Do not widen this back to `string`.
 */
const SOURCE_LABEL: Record<ArticleSource, string> = {
  medium:   "> medium",
  substack: "> substack",
  linkedin: "> linkedin",
  devto:    "> dev.to",
  hashnode: "> hashnode",
  native:   "> article",
};

export function generateStaticParams() {
  return allArticles.map((a) => ({ slug: a.slug }));
}

export const alt = "Article";

export default async function ArticleOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  const title = article?.title ?? profile.name;
  const date = article
    ? new Date(article.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : profile.role;
  const label = SOURCE_LABEL[article?.source ?? "native"] ?? "> article";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#07080d",
          backgroundImage:
            "radial-gradient(800px 500px at 80% -10%, rgba(255,103,25,0.14), transparent 70%), radial-gradient(700px 460px at 0% 10%, rgba(56,225,255,0.12), transparent 70%)",
          color: "#e9ecf5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#ff6719", fontSize: 26, fontFamily: "monospace" }}>
          {label}
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#9aa3b8", marginTop: 28 }}>{date}</div>
        <div style={{ display: "flex", gap: 24, marginTop: 48, fontSize: 24, color: "#5b6478" }}>
          <span>{profile.name}</span>
          <span>·</span>
          <span>anvilry.vercel.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
