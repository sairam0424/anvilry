/**
 * instrumentation.ts — Next.js 16 server-side instrumentation hook.
 *
 * `register()` is called ONCE per server process start (cold start in serverless).
 * It runs in the Node.js runtime only — never in the Edge runtime, so all Node
 * APIs are available. We use it to emit a single structured config-snapshot log
 * so that every deployment has a traceable record of:
 *   - Which feature flags are active and via which evaluation path
 *   - Which environment tier this instance is running in
 *   - Whether optional integrations (Redis, Bedrock, GitHub) are configured
 *
 * SECURITY: no secret values are logged — only whether a var is present/absent
 * or a safe enum value. The emit follows the same [trace] prefix convention as
 * the telemetry emitter so `vercel logs | grep '\[config\]'` filters just these.
 *
 * Note on timing: register() runs on cold start but Next.js makes no guarantee
 * it blocks before the first request is handled in serverless. Treat it as
 * "best-effort startup logging", not a hard initialization gate.
 */

function present(val: string | undefined): boolean {
  return typeof val === "string" && val.length > 0;
}

function enumVal<T extends string>(
  val: string | undefined,
  allowed: T[],
  fallback: T,
): T {
  return allowed.includes(val as T) ? (val as T) : fallback;
}

export async function register() {
  // Edge runtime has no access to process.env secrets — skip.
  if (process.env.NEXT_RUNTIME === "edge") return;

  const env = process.env;

  const config = {
    // ── Environment tier ────────────────────────────────────────────────────
    vercel_env: enumVal(env.VERCEL_ENV, ["production", "preview", "development"], "local"),
    node_env: enumVal(env.NODE_ENV, ["production", "development", "test"], "development"),
    region: env.VERCEL_REGION ?? env.AWS_REGION ?? "unknown",

    // ── Feature flag driver ──────────────────────────────────────────────────
    // FLAG_DRIVER is our custom switch (not a Vercel SDK concept).
    // The Vercel Flags SDK itself reads process.env.FLAGS as its connection string.
    flag_driver: enumVal(env.FLAG_DRIVER, ["vercel", "local"], "local"),
    flags_sdk_configured: present(env.FLAGS),         // SDK connection string
    flags_secret_configured: present(env.FLAGS_SECRET), // Manifest auth secret

    // Beast-mode build-time flags — logged as booleans (safe, non-secret)
    beast_flags: {
      orb_postprocessing: env.NEXT_PUBLIC_ORB_POSTPROCESSING === "true",
      ink_transition: env.NEXT_PUBLIC_INK_TRANSITION === "true",
      skill_tree: env.NEXT_PUBLIC_SKILL_TREE === "true",
      orb_404: env.NEXT_PUBLIC_404_ORB === "true",
      visitor_counter: env.NEXT_PUBLIC_VISITOR_COUNTER === "true",
      // discovery_badges intentionally omitted here — it is runtime-resolved
      // via flags.ts and logged separately in getDiscoveryBadgesEnabled().
    },

    // ── Backend integrations — presence only, no values ────────────────────
    integrations: {
      bedrock: present(env.BEDROCK_ACCESS_KEY_ID),
      upstash_redis: present(env.UPSTASH_REDIS_REST_URL),
      google_tts: present(env.GOOGLE_TTS_API_KEY),
      github_token: present(env.GITHUB_TOKEN),
      admin_password: present(env.ADMIN_PASSWORD),
      telemetry_ip_salt: present(env.TELEMETRY_IP_SALT),
    },

    // ── LLM configuration ───────────────────────────────────────────────────
    llm_provider: enumVal(env.LLM_PROVIDER, ["bedrock", "anthropic"], "bedrock"),
    llm_sdk: enumVal(
      env.NEXT_PUBLIC_LLM_SDK,
      ["anthropic-bedrock", "aws-sdk-bedrock"],
      "anthropic-bedrock",
    ),
  };

  // Single structured log — grep handle "[config]" is distinct from "[trace]"
  // (telemetry spans) and "[vitals]" (web-vitals RUM).
  console.log("[config]", JSON.stringify(config));

  // Stamp corpus build time in Redis on production deploys only.
  // Use VERCEL_ENV=production to exclude preview deployments — on Vercel, preview
  // deployments also run with NODE_ENV=production, which would pollute the timestamp.
  // Falls back to NODE_ENV check for non-Vercel hosts where VERCEL_ENV is absent.
  const isProductionDeploy =
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");
  if (isProductionDeploy) {
    try {
      const { redis } = await import("@/lib/redis");
      if (redis) {
        await redis.set("anvilry:corpus:built_at", Date.now().toString(), {
          ex: 7 * 24 * 3600, // 1 week — auto-expires if no new deploy
        });
      }
    } catch {
      // Fail silently — corpus timestamp is best-effort instrumentation.
    }
  }
}
