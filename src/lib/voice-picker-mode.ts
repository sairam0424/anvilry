/**
 * Build-time feature flag for the voice picker's UX mode.
 *
 * NEXT_PUBLIC_VOICE_PICKER_MODE = "descriptor" | "gender"
 *   "descriptor" (DEFAULT) — modern named cards with 2-word descriptors
 *      (the ChatGPT/Siri pattern: "Stephen — warm & direct"). No gender label.
 *   "gender" — explicit Male / Female / System default toggle. The picker
 *      renders a 2-column layout with cards stacked under each gender.
 *
 * Read once at module load (NEXT_PUBLIC_ is inlined at build time). A redeploy
 * is needed to switch modes — same constraint as every other Anvilry env flag
 * (see enabled-views.ts, header-orb-trigger.tsx). The two modes share the same
 * underlying voice catalog; only the picker's grouping + labeling differs.
 */

export type VoicePickerMode = "descriptor" | "gender";

const DEFAULT_MODE: VoicePickerMode = "descriptor";

const raw = process.env.NEXT_PUBLIC_VOICE_PICKER_MODE;

const resolvedMode: VoicePickerMode = raw === "gender" ? "gender" : DEFAULT_MODE;

/** The active picker mode for this build. The picker UI reads this to choose its
 *  layout; everything else (catalog, settings store, /api/tts allowlist) is
 *  mode-agnostic. */
export function getVoicePickerMode(): VoicePickerMode {
  return resolvedMode;
}

/** Convenience for inline conditionals in the picker JSX. */
export const VOICE_PICKER_MODE: VoicePickerMode = resolvedMode;
