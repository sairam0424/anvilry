import { ImageResponse } from "next/og";
import { allWork, getWork } from "@/lib/content";
import { METADATA_COLORS } from "@/lib/metadata-colors";
import { profile } from "@/lib/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pre-generate one OG card per work slug (statically). Every shared /work/<slug> link
// now unfurls with a card stamped with THAT system's name + register + top metric,
// instead of the identical generic root card.
export function generateStaticParams() {
  return allWork.map((w) => ({ slug: w.slug }));
}

export const alt = "Work case study";

export default async function WorkOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const work = getWork(slug);
  const name = work?.name ?? profile.name;
  const register = work?.register ?? profile.role;
  const metric = work?.metrics[0];

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
        {`> ${register}`}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 80,
          fontWeight: 700,
          lineHeight: 1.05,
          marginTop: 24,
        }}
      >
        {name}
      </div>
      {metric && (
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: METADATA_COLORS.fgMuted,
            marginTop: 28,
          }}
        >
          {`${metric.value} · ${metric.label}`}
        </div>
      )}
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
