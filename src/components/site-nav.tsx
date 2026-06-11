import Link from "next/link";
import { FileText } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";

const navLinks = [
  { href: "/#work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/resume", label: "Résumé" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg-base/70 backdrop-blur-md">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
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

        <div className="flex items-center gap-3">
          <a
            href={profile.links.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-fg-muted transition-colors hover:text-accent"
          >
            <Github size={18} />
          </a>
          <a
            href={profile.links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-fg-muted transition-colors hover:text-accent"
          >
            <Linkedin size={18} />
          </a>
          <Link href="/resume" aria-label="Résumé" className="text-fg-muted transition-colors hover:text-accent">
            <FileText size={18} />
          </Link>
        </div>
      </nav>
    </header>
  );
}
