import { ImageResponse } from "next/og";
import { METADATA_COLORS } from "@/lib/metadata-colors";

// Apple touch icon (home-screen). Larger 180x180 with the same Anvilry "A" mark
// plus a subtle accent glow, matching the favicon + OG image brand.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: METADATA_COLORS.bgBase,
        backgroundImage:
          "radial-gradient(120px 120px at 70% 20%, rgba(56,225,255,0.22), transparent 70%)",
        color: METADATA_COLORS.accent,
        fontSize: 120,
        fontWeight: 800,
        fontFamily: "monospace",
        letterSpacing: "-0.05em",
      }}
    >
      A
    </div>,
    { ...size },
  );
}
