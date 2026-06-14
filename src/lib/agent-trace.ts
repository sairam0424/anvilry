import { getProject, getWork } from "@/lib/content";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  OWNER SIGN-OFF REQUIRED — this is the reviewable diff (zero-fabrication gate). ║
 * ║                                                                                ║
 * ║  The glass-box demo replays these scenarios as a deterministic multi-agent     ║
 * ║  trace. Every `action` and `output` string is words ATTRIBUTED to named agents ║
 * ║  speaking about Sairam's REAL systems — so they CANNOT be model-invented.      ║
 * ║  Sairam must author/approve every line, confirm each `refs` slug is the right  ║
 * ║  real system, and replace the PLACEHOLDER_SENTINEL prose below.                ║
 * ║                                                                                ║
 * ║  A build-time test (agent-trace.test.ts) BLOCKS shipping while the sentinel    ║
 * ║  string is still present, and asserts every ref slug resolves to real content. ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

/** Sentinel that marks un-reviewed placeholder prose. The test fails while it remains. */
export const PLACEHOLDER_SENTINEL = "[DRAFT — owner to approve]";

/** The fixed cast — a small, closed set keeps the zero-fab surface tight. */
export type AgentName = "Researcher" | "Synthesizer" | "Presenter";

export const AGENTS: Record<AgentName, { label: string; role: string; color: string }> = {
  Researcher: { label: "Researcher", role: "finds the relevant real systems", color: "var(--accent)" },
  Synthesizer: { label: "Synthesizer", role: "connects the work into an answer", color: "var(--violet)" },
  Presenter: { label: "Presenter", role: "frames it for the reader", color: "var(--green)" },
};

export type AgentStep = {
  agent: AgentName;
  /** What the agent did (owner-authored). */
  action: string;
  /** What it produced (owner-authored). */
  output: string;
  /** Real content slugs this step references (work or project). Anti-fab gate. */
  refs?: string[];
  /** Reveal delay in ms (coordination feel: ~400–1200/step, total < 8000). */
  ms: number;
};

export type Scenario = { id: string; question: string; steps: AgentStep[] };

/**
 * PLACEHOLDER scenarios — structurally real (real slugs, realistic shape + timing) but
 * the prose is DRAFT and must be owner-approved before shipping. Replace each
 * action/output (and remove the sentinel) once Sairam signs off.
 */
export const scenarios: Scenario[] = [
  {
    id: "scaling-aava",
    question: "How did you scale AAVA Code past its single-agent ceiling?",
    steps: [
      {
        agent: "Researcher",
        action: `${PLACEHOLDER_SENTINEL} Searched the project corpus for multi-agent orchestration work`,
        output: `${PLACEHOLDER_SENTINEL} Found AAVA Code (3K+ daily users) and the MindForge wave executor`,
        refs: ["aava-code", "mindforge"],
        ms: 600,
      },
      {
        agent: "Synthesizer",
        action: `${PLACEHOLDER_SENTINEL} Compared the single-agent bottleneck against the wave-execution redesign`,
        output: `${PLACEHOLDER_SENTINEL} Identified the orchestration pattern that lifted the ceiling`,
        refs: ["mindforge"],
        ms: 900,
      },
      {
        agent: "Presenter",
        action: `${PLACEHOLDER_SENTINEL} Drafted the recruiter-facing answer grounded in real systems`,
        output: `${PLACEHOLDER_SENTINEL} AAVA Code moved from one agent to a coordinated mesh`,
        refs: ["aava-code"],
        ms: 700,
      },
    ],
  },
  {
    id: "event-driven",
    question: "How do you keep a multi-agent backend fast and reliable under load?",
    steps: [
      {
        agent: "Researcher",
        action: `${PLACEHOLDER_SENTINEL} Pulled the event-driven systems from the work history`,
        output: `${PLACEHOLDER_SENTINEL} Surfaced Pensieve's Redis-Streams + SSE pub/sub architecture`,
        refs: ["pensieve"],
        ms: 550,
      },
      {
        agent: "Synthesizer",
        action: `${PLACEHOLDER_SENTINEL} Mapped how decoupling orchestration from execution sustains throughput`,
        output: `${PLACEHOLDER_SENTINEL} Explained the streaming + human-in-the-loop gate design`,
        refs: ["pensieve"],
        ms: 850,
      },
      {
        agent: "Presenter",
        action: `${PLACEHOLDER_SENTINEL} Framed the reliability story for a hiring manager`,
        output: `${PLACEHOLDER_SENTINEL} Decoupled, event-driven services keep agents fast and governed`,
        refs: ["pensieve"],
        ms: 650,
      },
    ],
  },
];

/** Every slug referenced across all scenarios (for the zero-fab resolution test). */
export function allReferencedSlugs(): string[] {
  return [...new Set(scenarios.flatMap((s) => s.steps.flatMap((step) => step.refs ?? [])))];
}

/**
 * The demo is owner-APPROVED (ready to show) only once no step still carries the
 * placeholder sentinel. Until then the glass-box demo renders DARK (empty-safe, like
 * the personal-content eggs) — so the scaffolding can ship without exposing un-reviewed
 * prose, and lights up the moment Sairam replaces the drafts. NOT a hard build failure.
 */
export const traceApproved: boolean = scenarios.every((s) =>
  s.steps.every((step) => !step.action.includes(PLACEHOLDER_SENTINEL) && !step.output.includes(PLACEHOLDER_SENTINEL)),
);

/** Deep-link for a referenced slug — resolves via the real content layer (work or project). */
export function linkForSlug(slug: string): string | null {
  return getWork(slug)?.url ?? getProject(slug)?.url ?? null;
}
