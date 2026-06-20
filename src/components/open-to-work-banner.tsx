import { ArrowUpRight, CalendarDays, Mail } from "lucide-react";
import { profile } from "@/lib/profile";

/**
 * Subtle hiring-signal banner rendered below the sticky nav when
 * NEXT_PUBLIC_OPEN_TO_WORK=true. Intentionally low-chrome — signals
 * availability without dominating the page. Hidden via CSS (h-0) when
 * the flag is off so there is zero layout shift on toggle.
 */
export function OpenToWorkBanner() {
  return (
    <div className="border-b border-accent/20 bg-accent/5 px-4 py-2">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green" aria-hidden="true" />
          Open to Backend, GenAI &amp; Full-Stack roles · remote or Hyderabad
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`mailto:${profile.email}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-accent transition-colors hover:text-accent-strong"
          >
            <Mail size={13} aria-hidden="true" /> Email me
          </a>
          <a
            href={profile.calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-accent transition-colors hover:text-accent-strong"
          >
            <CalendarDays size={13} aria-hidden="true" /> Schedule a call
            <ArrowUpRight size={11} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
