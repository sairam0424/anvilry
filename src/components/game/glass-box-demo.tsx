"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
import { AGENTS, scenarios, traceApproved, linkForSlug } from "@/lib/agent-trace";
import { useTraceRunner } from "@/components/game/use-trace-runner";

/**
 * Glass-box multi-agent demo — a deterministic, zero-LLM-cost replay of named agents
 * coordinating to answer a recruiter question, demonstrating Sairam's #1 skill
 * (multi-agent orchestration) rather than just claiming it.
 *
 * Ships DARK until the owner approves the scripted traces (traceApproved gate — every
 * line is owner-authored words about real systems, zero fabrication). Keyboard-native
 * (native <select> + buttons), reduced-motion shows all steps instantly, each revealed
 * step is announced via a polite live region; Esc resets; no focus trap.
 */
export function GlassBoxDemo() {
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario = scenarios[scenarioIdx];
  // reduced OR pre-hydration -> instant reveal (mirrors reveal.tsx's gate).
  const { status, revealedCount, liveMessage, run, reset } = useTraceRunner(scenario, !!reduced || !mounted);

  // Esc resets while running/done (no focus trap — listener only while active).
  useEffect(() => {
    if (status === "idle") return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [status, reset]);

  // Dark until owner sign-off — render nothing rather than expose draft prose.
  if (!traceApproved) return null;

  return (
    <section aria-label="Watch agents coordinate" className="mt-12">
      <p className="mono-label">{"// glass box — watch the agents coordinate"}</p>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        A scripted, deterministic trace of how a multi-agent system answers a question about my work —
        not a live model, just the coordination pattern made visible.
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-bg-surface/60 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="glassbox-scenario">
            Choose a question
          </label>
          <select
            id="glassbox-scenario"
            value={scenarioIdx}
            onChange={(e) => {
              reset();
              setScenarioIdx(Number(e.target.value));
            }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {scenarios.map((s, i) => (
              <option key={s.id} value={i}>
                {s.question}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={run}
            disabled={status === "running"}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-bg-base transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
          >
            <Play size={14} aria-hidden="true" /> {status === "done" ? "Run again" : "Run"}
          </button>
          {status !== "idle" && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RotateCcw size={14} aria-hidden="true" /> Reset
            </button>
          )}
        </div>

        {/* Polite live region — announces each revealed step once + the settle. */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </div>

        <ol className="mt-5 space-y-3">
          {scenario.steps.slice(0, revealedCount).map((step, i) => {
            const agent = AGENTS[step.agent];
            return (
              <li key={i} className="rounded-xl border border-border bg-bg-base/60 p-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
                    style={{ color: agent.color, border: `1px solid ${agent.color}` }}
                  >
                    {agent.label}
                  </span>
                  <span className="text-xs text-fg-subtle">{agent.role}</span>
                  <span className="ml-auto font-mono text-[10px] text-fg-subtle">{step.ms}ms</span>
                </div>
                <p className="mt-2 text-sm text-fg-muted">{step.action}</p>
                <p className="mt-1 text-sm text-fg">{step.output}</p>
                {step.refs && step.refs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.refs.map((slug) => {
                      const href = linkForSlug(slug);
                      return href ? (
                        <Link
                          key={slug}
                          href={href}
                          className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {slug}
                        </Link>
                      ) : null;
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {status === "idle" && (
          <p className="mt-4 text-xs text-fg-subtle">Press Run to watch the agents coordinate.</p>
        )}
      </div>
    </section>
  );
}
