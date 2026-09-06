import { ImageResponse } from "next/og";
import { METADATA_COLORS } from "@/lib/metadata-colors";
import { profile } from "@/lib/profile";

export const alt = `${profile.name} — ${profile.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded OG image for rich link previews (LinkedIn/Slack/Twitter unfurls).
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: METADATA_COLORS.bgBase,
        backgroundImage:
          "radial-gradient(800px 500px at 80% -10%, rgba(167,139,250,0.18), transparent 70%), radial-gradient(700px 460px at 0% 10%, rgba(56,225,255,0.16), transparent 70%)",
        color: METADATA_COLORS.fg,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          color: METADATA_COLORS.accent,
          fontSize: 26,
          fontFamily: "monospace",
        }}
      >
        {`> ${profile.role} @ ${profile.company}`}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 84,
          fontWeight: 700,
          lineHeight: 1.05,
          marginTop: 24,
        }}
      >
        {profile.name}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 34,
          color: METADATA_COLORS.fgMuted,
          marginTop: 28,
          maxWidth: 900,
        }}
      >
        Multi-agent LLM systems · event-driven backends · open-source AI
        infrastructure
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 48,
          fontSize: 24,
          color: METADATA_COLORS.fgSubtle,
        }}
      >
        <span>anvilry.vercel.app</span>
        <span>·</span>
        <span>github.com/{profile.githubUser}</span>
      </div>
    </div>,
    { ...size },
  );
}
