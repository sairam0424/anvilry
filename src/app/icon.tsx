import { ImageResponse } from "next/og";

// Branded favicon — a bold "A" (Anvilry) in brand cyan on ink, generated from the
// same tokens as the OG image. Simple-by-design so it stays legible at 16x16.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07080d",
          color: "#38e1ff",
          fontSize: 26,
          fontWeight: 800,
          fontFamily: "monospace",
          borderRadius: 6,
          letterSpacing: "-0.05em",
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
