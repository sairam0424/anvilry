"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Rss } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";
import { useView } from "@/components/view-context";

const showVisitorCounter = process.env.NEXT_PUBLIC_VISITOR_COUNTER === "true";

/**
 * Fire-and-forget visitor counter. POSTs to /api/visit on mount (once per page load),
 * then shows the running total. Rate-limited server-side to 1 increment per IP / 30 min.
 * Gate: NEXT_PUBLIC_VISITOR_COUNTER=true (default OFF).
 */
function VisitorBadge() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/visit", { method: "POST" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.total != null) setTotal(data.total as number); })
      .catch(() => {}); // fail silently — decorative
  }, []);

  if (total === null) {
    return (
      <span className="inline-block h-3 w-28 animate-pulse rounded bg-fg-subtle/20" aria-hidden="true" />
    );
  }
  return (
    <span className="font-mono text-xs text-fg-subtle">
      ↑ {total.toLocaleString()} engineers visited
    </span>
  );
}

// Machine-readable surfaces — the AI-crawler / agent-native artifacts. Grouped here so
// they're discoverable (previously /llms.txt + /api/resume.json existed but weren't
// linked from anywhere). On-brand for a GenAI engineer.
const MACHINE_LINKS = [
  { href: "/mcp", label: "MCP server" },
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/api/resume.json", label: "resume.json" },
];

// Views whose <main> fills the full viewport below the nav (h-[calc(100dvh-3.5rem)]) —
// a global marketing footer underneath them has nowhere to go but past the fold, where it
// converges with / overlaps the immersive console on short viewports. Hidden there; the
// document-flow Classic and Play views keep it. Client-gated, so Classic (the SSG default)
// still ships the footer in its prerendered HTML for crawlers — it only hides post-hydration
// when a full-height view is active.
const FULL_HEIGHT_VIEWS = new Set(["chat", "developer"]);

export function SiteFooter() {
  const { view } = useView();
  if (FULL_HEIGHT_VIEWS.has(view)) return null;

  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-sm">
            <span className="text-accent">{profile.name}</span>
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            {profile.role} · {profile.location}
          </p>
          {showVisitorCounter && (
            <p className="mt-2">
              <VisitorBadge />
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-4 sm:items-end">
          {/* For AI agents — the machine-readable links. */}
          <nav aria-label="Machine-readable" className="flex items-center gap-4 text-xs text-fg-subtle">
            <span className="font-mono">{"// for AI:"}</span>
            {MACHINE_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="font-mono hover:text-accent">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-5 text-fg-muted">
            <a href={profile.links.github} target="_blank" rel="noopener noreferrer" className="hover:text-accent" aria-label="GitHub">
              <Github size={18} />
            </a>
            <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-accent" aria-label="LinkedIn">
              <Linkedin size={18} />
            </a>
            <a href={`mailto:${profile.email}`} className="hover:text-accent" aria-label="Email">
              <Mail size={18} />
            </a>
          </div>
        </div>
        {/* Copyright + RSS + newsletter */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4 font-mono text-[11px] text-fg-subtle">
          <span>© {new Date().getFullYear()} Sairam Ugge. Built with Next.js, Tailwind &amp; Velite.</span>
          <div className="flex items-center gap-4">
            <a href={profile.substackUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent">
              Subscribe
            </a>
            <a href="/feed.xml" className="inline-flex items-center gap-1 transition-colors hover:text-accent">
              <Rss size={11} aria-hidden="true" /> RSS
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
