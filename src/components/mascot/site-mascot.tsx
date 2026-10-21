import { Mascot } from "./mascot";
import { mascotSheets, type MascotCharacter } from "@/lib/mascots";

type SiteMascotProps = {
  character: MascotCharacter;
  /** Pixel number or any CSS length (e.g. `var(--mascot-size)` set by a wrapper). */
  size?: number | string;
  /** Screen-reader name: the button reads "Boop the {label}". */
  label?: string;
  className?: string;
  /**
   * Above the fold? Emit a preload for the directions sheet. Background images are discovered
   * when styles resolve, not by the preload scanner, so without this the head paints a
   * round-trip late. Rendered as a `<link>` (React 19 hoists it into `<head>` during SSR, so
   * the hint is in the HTML); `ReactDOM.preload()` from a server component was observed NOT to
   * reach the prerendered head on this build, so it is not used here.
   */
  priority?: boolean;
};

/**
 * Anvilry's mascot: picks a character from src/lib/mascots.ts and renders the vendored
 * page-mascot component. Server-safe (no hooks) so it can sit in server components; the
 * `Mascot` beneath it is the only client boundary. Position it with a wrapper element.
 */
export function SiteMascot({ character, size = 140, label = "mascot", className, priority = false }: SiteMascotProps) {
  const sheets = mascotSheets(character);
  return (
    <>
      {priority && <link rel="preload" as="image" href={sheets.directions} fetchPriority="high" />}
      <Mascot
        directions={sheets.directions}
        reactions={sheets.reactions}
        size={size}
        label={label}
        className={className}
      />
    </>
  );
}
