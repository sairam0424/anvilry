import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allNotes } from "@/lib/content";
import { NoteCard } from "@/components/note-card";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Notes",
  description: "Engineering notes & writing.",
  alternates: { canonical: "/notes" },
};

export default function NotesPage() {
  // Empty-safe: the notes feature ships DARK until a post exists. The nav link
  // (site-nav gates on hasNotes) and the sitemap both omit /notes while empty.
  if (allNotes.length === 0) notFound();

  return (
    <main className="flex-1">
      <Section
        label={`// engineering notes — ${allNotes.length} note${allNotes.length !== 1 ? "s" : ""}`}
        title="Notes"
        titleAs="h1"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {allNotes.map((n, i) => (
            <Reveal key={n.slug} delay={(i % 2) * 0.06}>
              <NoteCard note={n} />
            </Reveal>
          ))}
        </div>
      </Section>
    </main>
  );
}
