import type { Metadata } from "next";
import Link from "next/link";
import { allNotes } from "@/lib/content";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Notes",
  description: "Engineering notes & writing.",
  alternates: { canonical: "/notes" },
};

/** Absolute, human-readable date (UTC; no relative drift). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function NotesPage() {
  return (
    <main className="flex-1">
      <Section label="// writing" title="Engineering notes">
        {allNotes.length === 0 ? (
          <p className="max-w-2xl text-fg-muted">No notes published yet — check back soon.</p>
        ) : (
          <ul className="max-w-2xl space-y-1">
            {allNotes.map((n, i) => (
              <li key={n.slug}>
                <Reveal delay={(i % 4) * 0.04}>
                  <Link
                    href={n.url}
                    className="group flex flex-col gap-1 rounded-xl border border-transparent px-4 py-4 transition-colors hover:border-border hover:bg-bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-fg group-hover:text-accent">{n.title}</span>
                      <span className="shrink-0 font-mono text-xs text-fg-subtle">{fmt(n.date)}</span>
                    </span>
                    <span className="text-sm text-fg-muted">{n.summary}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
