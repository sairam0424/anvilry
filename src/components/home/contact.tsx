import { Mail, ArrowUpRight, CalendarDays } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export function Contact() {
  return (
    <Section id="contact" label="// let's talk" title="Open to Backend, GenAI & Full-Stack roles">
      <Reveal>
        <div className="card-surface flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
          <p className="max-w-md text-fg-muted">
            Building agent infrastructure or scaling an event-driven backend? I&apos;d love to hear about it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${profile.email}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-strong"
            >
              <Mail size={16} /> Email me
            </a>
            <a
              href={profile.calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-accent/40 px-4 py-2.5 text-sm text-accent transition-colors hover:border-accent hover:bg-accent/10"
            >
              <CalendarDays size={16} /> Schedule a call <ArrowUpRight size={13} className="text-accent/70" />
            </a>
            <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2.5 text-sm text-fg hover:bg-bg-elevated">
              <Linkedin size={16} /> LinkedIn <ArrowUpRight size={13} className="text-fg-subtle" />
            </a>
            <a href={profile.links.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2.5 text-sm text-fg hover:bg-bg-elevated">
              <Github size={16} /> GitHub <ArrowUpRight size={13} className="text-fg-subtle" />
            </a>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
