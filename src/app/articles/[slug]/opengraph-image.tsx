import { ImageResponse } from "next/og";
import { allArticles, getArticle } from "@/lib/content";
import { profile } from "@/lib/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SOURCE_LABEL: Record<string, string> = {
  medium:   "> medium",
  substack: "> substack",
  linkedin: "> linkedin",
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
