"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";
import { hasNotes, hasArticles } from "@/lib/content";
import {
  ARTICLES_ENABLED,
  NOTES_ENABLED,
  STATS_ENABLED,
  SEARCH_ENABLED,
} from "@/lib/writing-flags";
import { ViewSwitcher } from "@/components/view-switcher";
import { HeaderOrbTrigger } from "@/components/chat/header-orb-trigger";
import { MobileNav } from "@/components/mobile-nav";

// Content section links appear ONLY when both the feature flag AND content exist.
const navLinks = [
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  ...(ARTICLES_ENABLED && hasArticles
    ? [{ href: "/articles", label: "Articles" }]
    : []),
  ...(NOTES_ENABLED && hasNotes ? [{ href: "/notes", label: "Writing" }] : []),
  { href: "/about", label: "About" },
  { href: "/resume", label: "Résumé" },
  ...(STATS_ENABLED ? [{ href: "/stats", label: "Stats" }] : []),
  ...(SEARCH_ENABLED ? [{ href: "/search", label: "Search" }] : []),
];

/** Returns true when the nav link should be considered "active" for the current path. */
function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  // Section anchors (/#work, /#contact) — active on the homepage
  if (href.startsWith("/#")) return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header
      // h-14 here (not just on the inner <nav>) so the header's TOTAL rendered height —
      // border-box, including the 1px border-bottom — is exactly 3.5rem. Every "header is
      // 3.5rem" assumption site-wide (scroll-padding-top in globals.css, the exact-height
      // `h-[calc(100dvh-3.5rem)]` main on chat/developer views) was off by that 1px border,
      // which never showed as visible content but did leave a permanent 1px document
      // overflow — invisible on most setups, a permanent scrollbar track on macOS's
      // "always show scrollbars" preference (verified: dev mode's <main> was exactly
      // 1px taller than the viewport regardless of viewport size).
      className="sticky top-0 z-40 h-14 border-b border-border/60 bg-bg-base/70 backdrop-blur-md"
      style={{ viewTransitionName: "site-header" }}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-6">
        <Link
          href="/"
          className="shrink-0 font-mono text-sm font-semibold tracking-tight"
        >
          <span className="text-accent">~/</span>sairam
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={[
                "text-sm transition-colors",
                isActive(l.href, pathname)
                  ? "text-accent"
                  : "text-fg-muted hover:text-fg",
              ].join(" ")}
              aria-current={isActive(l.href, pathname) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* View switcher — full on desktop, compact icon pill on mobile (always visible). */}
        <div className="hidden sm:block">
          <ViewSwitcher />
        </div>
        <div className="sm:hidden">
          <ViewSwitcher compact />
        </div>

        {/* Anvil voice orb — the click-to-talk door, visible on every viewport + route
            (build-flagged; renders nothing when disabled or where STT is unsupported). */}
        <HeaderOrbTrigger />

        {/* Desktop: social + résumé icons. Mobile: these move into the drawer. */}
        <div className="hidden items-center gap-3 sm:flex">
          <a
            href={profile.links.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="rounded text-fg-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Github size={18} />
          </a>
          <a
            href={profile.links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="rounded text-fg-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Linkedin size={18} />
          </a>
          <Link
            href="/resume"
            aria-label="Résumé"
            className="rounded text-fg-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <FileText size={18} />
          </Link>
        </div>

        {/* Mobile: hamburger opens the drawer with the full nav + social links. */}
        <MobileNav links={navLinks} />
      </nav>
    </header>
  );
}
