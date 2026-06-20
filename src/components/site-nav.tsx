import Link from "next/link";
import { FileText } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";
import { hasNotes, hasArticles } from "@/lib/content";
import { ViewSwitcher } from "@/components/view-switcher";
import { HeaderOrbTrigger } from "@/components/chat/header-orb-trigger";
import { MobileNav } from "@/components/mobile-nav";

// Content section links appear ONLY when entries exist (empty-safe — no dead links).
const navLinks = [
  { href: "/#work", label: "Work" },
  { href: "/projects", label: "Projects" },
  ...(hasArticles ? [{ href: "/articles", label: "Articles" }] : []),
  ...(hasNotes ? [{ href: "/notes", label: "Notes" }] : []),
  { href: "/about", label: "About" },
  { href: "/resume", label: "Résumé" },
];

export function SiteNav() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-bg-base/70 backdrop-blur-md"
      style={{ viewTransitionName: "site-header" }}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-6">
        <Link href="/" className="shrink-0 font-mono text-sm font-semibold tracking-tight">
          <span className="text-accent">~/</span>sairam
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-fg-muted transition-colors hover:text-fg"
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
          <Link href="/resume" aria-label="Résumé" className="rounded text-fg-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <FileText size={18} />
          </Link>
        </div>

        {/* Mobile: hamburger opens the drawer with the full nav + social links. */}
        <MobileNav links={navLinks} />
      </nav>
    </header>
  );
}
