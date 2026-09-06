/**
 * Dark-mode design tokens for request-time metadata renderers.
 *
 * icon.tsx, apple-icon.tsx, opengraph-image.tsx (root + [slug] variants),
 * manifest.ts, and global-error.tsx render via ImageResponse / generateMetadata /
 * an error boundary — none of these have access to the CSS cascade (no `:root`
 * custom properties, no `[data-theme]` override), so the literal hex values must
 * live here in TS. These mirror the dark-mode `:root` block in `src/app/globals.css`
 * 1:1 by name — always the dark values, since these all render server-side with
 * no theme context to resolve a light/dark choice.
 */
export const METADATA_COLORS = {
  bgBase: "#07080d",
  bgSurface: "#0d0f17",
  bgElevated: "#141826",
  border: "#1f2433",
  borderStrong: "#2c3346",
  fg: "#e9ecf5",
  fgMuted: "#9aa3b8",
  fgSubtle: "#747e99",
  accent: "#38e1ff",
  accentStrong: "#0fb8db",
  violet: "#a78bfa",
  green: "#4ade80",
  amber: "#fbbf24",
} as const;
