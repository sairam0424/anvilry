import { ImageResponse } from "next/og";
import { allProjects, getProject } from "@/lib/content";
import { profile } from "@/lib/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// One statically-generated OG card per project slug (name + tagline + group).
export function generateStaticParams() {
  return allProjects.map((p) => ({ slug: p.slug }));
}

export const alt = "Open-source project";

export default async function ProjectOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  const name = project?.name ?? profile.name;
  const tagline = project?.tagline ?? profile.role;
  const group = project?.group;

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
            "radial-gradient(800px 500px at 80% -10%, rgba(167,139,250,0.18), transparent 70%), radial-gradient(700px 460px at 0% 10%, rgba(56,225,255,0.16), transparent 70%)",
          color: "#e9ecf5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#38e1ff", fontSize: 26, fontFamily: "monospace" }}>
          {group ? `> ${group}` : "> open source"}
        </div>
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#9aa3b8", marginTop: 28, maxWidth: 980 }}>
          {tagline}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 48, fontSize: 24, color: "#5b6478" }}>
          <span>{profile.name}</span>
          <span>·</span>
          <span>github.com/{profile.githubUser}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
