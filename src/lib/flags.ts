/**
 * Feature flag resolver — single source of truth for runtime vs build-time evaluation.
 *
 * FLAG_DRIVER=vercel  → Vercel Flags SDK (server-side, instant no-redeploy toggle)
 * FLAG_DRIVER=local   → NEXT_PUBLIC_DISCOVERY_BADGES env var (build-time, current default)
 *
 * Only discoveryBadges is migrated here. All other beast-mode flags remain
 * NEXT_PUBLIC_ build-time reads in their respective files.
 */
import { flag } from "flags/next";

// Evaluated once at process start — changing FLAG_DRIVER at runtime without a restart has no effect. This is correct for Next.js env semantics.
const useVercelDriver = process.env.FLAG_DRIVER === "vercel";

// The typed flag declaration — used only when FLAG_DRIVER=vercel.
// The id must match the flag ID created in the Vercel dashboard exactly.
const discoveryBadgesFlag = flag<boolean>({
  key: "NEXT_PUBLIC_DISCOVERY_BADGES",
  defaultValue: false,
  description: "Show the ★ N/5 discovered exploration badge (bottom-right)",
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  // `decide` falls through to defaultValue. The SDK checks the override cookie
  // BEFORE calling decide(), so dashboard overrides are respected correctly.
  // A literal return here only applies when no override cookie is present.
  decide: () => false,
});

/**
 * Resolve whether the discovery badges feature is enabled.
 * Call from a Server Component or a Route Handler (never from client components).
 *
 * Logs a single [flags] line on every resolution so Vercel Logs shows:
 *   - Which evaluation path ran (vercel SDK vs local build-time)
 *   - The resolved value
 *   - The source (dashboard override vs defaultValue vs NEXT_PUBLIC_ env)
 * Grep handle: `vercel logs | grep '\[flags\]'`
 */
export async function getDiscoveryBadgesEnabled(): Promise<boolean> {
  if (useVercelDriver) {
    const value = await discoveryBadgesFlag();
    console.log(
      "[flags]",
      JSON.stringify({
        flag: "NEXT_PUBLIC_DISCOVERY_BADGES",
        driver: "vercel",
        value,
        // FLAGS_SECRET presence tells us whether the manifest endpoint will work
        flags_secret_present: typeof process.env.FLAGS_SECRET === "string" && process.env.FLAGS_SECRET.length > 0,
      }),
    );
    return value;
  }

  // Build-time path — NEXT_PUBLIC_ is inlined at build time by Next.js.
  const value = process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true";
  console.log(
    "[flags]",
    JSON.stringify({
      flag: "NEXT_PUBLIC_DISCOVERY_BADGES",
      driver: "local",
      value,
      source: typeof process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "string"
        ? "env_var"
        : "default_false",
    }),
  );
  return value;
}
