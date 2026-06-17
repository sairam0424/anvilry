import type { View } from "@/components/view-context";

/**
 * Build-time feature flag for which views are available beyond Classic.
 *
 * NEXT_PUBLIC_ENABLED_VIEWS = comma-separated list of view keys to enable.
 *   Example: "gamified,chat,developer,voice" (all on — the default if unset)
 *   Example: "chat,voice" (only Chat + Voice; Play + Dev hidden)
 *   Example: "" (empty — Classic only, everything else disabled)
 *
 * Classic is ALWAYS enabled (it's the SSG/crawler/no-JS default and the
 * getServerSnapshot contract — it cannot be disabled). The flag controls only
 * the ADDITIONAL views: gamified (Play), chat, developer, voice.
 *
 * Read once at module load (NEXT_PUBLIC_ is inlined at build time). A redeploy
 * is needed to change which views are active.
 */

// "resume" is always enabled — it's a static, no-cost view with no env prerequisite.
const ALWAYS_OPTIONAL: View[] = ["resume"];
const ALL_OPTIONAL: View[] = ["gamified", "chat", "developer", "voice", ...ALWAYS_OPTIONAL];

const raw = process.env.NEXT_PUBLIC_ENABLED_VIEWS;

// If the flag is unset/undefined → ALL views enabled (current default behavior).
// If set (even empty string) → parse the comma list.
const enabledSet: Set<View> = (() => {
  if (raw === undefined || raw === null) return new Set(ALL_OPTIONAL);
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as View[];
  return new Set(items.filter((v) => ALL_OPTIONAL.includes(v)));
})();

/** Whether a given optional view is enabled for this build. Classic + resume are always true. */
export function isViewEnabled(view: View): boolean {
  if (view === "classic" || ALWAYS_OPTIONAL.includes(view)) return true;
  return enabledSet.has(view);
}

/** The list of enabled optional views (for the switcher to filter OPTIONS). */
export const ENABLED_VIEWS: ReadonlySet<View> = enabledSet;
