"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { useView } from "@/components/view-context";

/**
 * The recruiter escape hatch present on every non-classic view. Rendered as the
 * FIRST focusable element so neither the gamified nor chat experience can become a
 * keyboard trap: a visitor can always jump straight back to the indexed Classic
 * page or to the résumé. "Back to Classic" is a view switch (no navigation);
 * "Résumé" is a real link so it works even if JS for the view fails.
 */
export function ViewEscapeHatch() {
  const { setView } = useView();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setView("classic")}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Back to Classic
      </button>
      <a
        href="/resume"
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FileText size={13} aria-hidden="true" />
        Résumé
      </a>
    </div>
  );
}
