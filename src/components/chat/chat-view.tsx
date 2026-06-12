"use client";

import { ViewEscapeHatch } from "@/components/view-escape-hatch";

/**
 * AI-CHAT view — the conversational concierge experience. Promoted from the
 * floating AskPortfolio widget into a full view in Phase 2. This Phase-0 scaffold
 * establishes the mount point, the escape hatch as first focusable element, and
 * the shared content source; the concierge console + generative cards + a11y build
 * land in Phase 2 tasks.
 */
export function ChatView() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col px-6 py-8">
      <ViewEscapeHatch />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">AI Concierge</p>
        <h1 className="mt-2 text-2xl font-semibold">Ask my portfolio</h1>
        <p className="mt-2 max-w-md text-sm text-fg-muted">
          A conversational way to explore Sairam&apos;s work. (Console UI lands in Phase 2.)
        </p>
      </div>
    </main>
  );
}
