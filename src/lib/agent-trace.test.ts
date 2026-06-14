import { describe, it, expect } from "vitest";
import {
  scenarios,
  AGENTS,
  allReferencedSlugs,
  linkForSlug,
  traceApproved,
  PLACEHOLDER_SENTINEL,
} from "./agent-trace";
import { getProject, getWork } from "@/lib/content";

/**
 * Zero-fabrication gate for the glass-box multi-agent demo. The prose can't be
 * machine-verified (it's owner-authored words), so the test pins the verifiable
 * invariants: every referenced slug resolves to a REAL system, timing is bounded, the
 * agent cast is closed, and the demo only goes LIVE (traceApproved) once the owner has
 * replaced the placeholder sentinel — so un-reviewed prose can never ship as live.
 */
describe("agent-trace data", () => {
  it("every referenced slug resolves to real content (anti-fabrication)", () => {
    const slugs = allReferencedSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const resolves = !!getWork(slug) || !!getProject(slug);
      expect(resolves, `ref slug "${slug}" must be a real work/project`).toBe(true);
      expect(linkForSlug(slug)).toBeTruthy();
    }
  });

  it("has >=2 scenarios, each with >=1 step that references a real system", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    for (const s of scenarios) {
      expect(s.question.length).toBeGreaterThan(5);
      expect(s.steps.some((step) => (step.refs ?? []).length > 0)).toBe(true);
    }
  });

  it("every step uses a known agent and bounded, positive timing (can't run away)", () => {
    for (const s of scenarios) {
      let total = 0;
      for (const step of s.steps) {
        expect(AGENTS[step.agent], `unknown agent ${step.agent}`).toBeTruthy();
        expect(step.ms).toBeGreaterThan(0);
        expect(Number.isFinite(step.ms)).toBe(true);
        total += step.ms;
      }
      expect(total, `scenario ${s.id} total exceeds 8s cap`).toBeLessThan(8000);
    }
  });

  it("traceApproved is false while the placeholder sentinel remains (ships dark until owner sign-off)", () => {
    const hasSentinel = scenarios.some((s) =>
      s.steps.some((step) => step.action.includes(PLACEHOLDER_SENTINEL) || step.output.includes(PLACEHOLDER_SENTINEL)),
    );
    // The gate must agree with reality: sentinel present <=> not approved.
    expect(traceApproved).toBe(!hasSentinel);
  });
});
