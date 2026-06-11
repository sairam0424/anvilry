import { Mail } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-4 px-6 py-10 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-sm">
            <span className="text-accent">{profile.name}</span>
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            {profile.role} · {profile.location}
          </p>
        </div>
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
    </footer>
  );
}
