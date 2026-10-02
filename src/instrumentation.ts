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

const CORPUS_STAMP_KEY = "anvilry:corpus:built_at";
const CORPUS_STAMP_TTL_SECONDS = 7 * 24 * 3600; // 1 week, renewed by every start of the deployment

/** The deployment id inside a stamp written as `<ms>:<deployment id>`, else null (a bare
 *  timestamp from the previous release, which the SDK hands back as a number). */
function stampedDeploymentId(stamp: unknown): string | null {
  if (typeof stamp !== "string") return null;
  const colon = stamp.indexOf(":");
  return colon === -1 ? null : stamp.slice(colon + 1);
}

/**
 * Keep anvilry:corpus:built_at in step with the DEPLOYMENT, not with the process.
 *
 * The FAQ cache tags every entry with this value and treats any other value as "the
 * corpus changed", so writing it retires every cached answer, and the reasoning summary
 * stored with it. register() runs on every cold start and every new instance of every
 * function, so stamping Date.now() each time threw the cache away at each of them.
 *
 * Where the host gives a deployment id (VERCEL_DEPLOYMENT_ID) the value is
 * `<ms of the deployment's first start>:<deployment id>`; a later start of the same
 * deployment leaves it alone (and renews its expiry), a different id (a deploy, or a
 * rollback) re-stamps. The /admin/telemetry "Corpus age" tile reads the leading digits
 * with parseInt. Without an id (self-hosted) every start stamps Date.now(), as before.
 */
async function stampCorpus(): Promise<void> {
  const { redis } = await import("@/lib/redis");
  if (!redis) return;
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  if (!deploymentId) {
    await redis.set(CORPUS_STAMP_KEY, Date.now().toString(), {
      ex: CORPUS_STAMP_TTL_SECONDS,
    });
    return;
  }
  const stamp = await redis.get<string | number>(CORPUS_STAMP_KEY);
  if (stampedDeploymentId(stamp) === deploymentId) {
    await redis.expire(CORPUS_STAMP_KEY, CORPUS_STAMP_TTL_SECONDS);
    return;
  }
  await redis.set(CORPUS_STAMP_KEY, `${Date.now()}:${deploymentId}`, {
    ex: CORPUS_STAMP_TTL_SECONDS,
  });
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
    deployment_id: present(env.VERCEL_DEPLOYMENT_ID), // presence only; see stampCorpus()

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

  // Stamp the corpus in Redis, production only. VERCEL_ENV=production excludes preview
  // deployments: on Vercel they also run with NODE_ENV=production and would overwrite
  // the stamp. Falls back to the NODE_ENV check for hosts where VERCEL_ENV is absent.
  const isProductionDeploy =
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");
  if (isProductionDeploy) {
    try {
      await stampCorpus();
    } catch (err) {
      // Best-effort: a failed write leaves the previous stamp, and the next start of
      // the deployment finds a different id and tries again. Name only, never the
      // message: an Upstash error message can echo the whole command.
      console.warn(
        "[config] corpus stamp not written:",
        err instanceof Error ? err.name : "unknown",
      );
    }
  }
}
