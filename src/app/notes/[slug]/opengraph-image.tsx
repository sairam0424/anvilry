import { ImageResponse } from "next/og";
import { allNotes, getNote } from "@/lib/content";
import { METADATA_COLORS } from "@/lib/metadata-colors";
import { profile } from "@/lib/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pre-generate one OG card per note slug (statically), mirroring the work/projects
// pattern — so a shared /notes/<slug> link unfurls with a card stamped with THAT
// note's title + date instead of the identical generic root card.
export function generateStaticParams() {
  return allNotes.map((n) => ({ slug: n.slug }));
}

export const alt = "Note";

export default async function NoteOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = getNote(slug);
  const title = note?.title ?? profile.name;
  const date = note
    ? new Date(note.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : profile.role;

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
        {"> note"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.05,
          marginTop: 24,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: METADATA_COLORS.fgMuted,
          marginTop: 28,
        }}
      >
        {date}
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
        <span>{profile.name}</span>
        <span>·</span>
        <span>anvilry.vercel.app</span>
      </div>
    </div>,
    { ...size },
  );
}
