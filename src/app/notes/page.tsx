import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allNotes } from "@/lib/content";
import { NOTES_ENABLED } from "@/lib/writing-flags";
import { NoteCard } from "@/components/note-card";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Notes",
  description: "Engineering notes & writing.",
  alternates: { canonical: "/notes" },
};

export default function NotesPage() {
  // Gate: flag off → 404 (nav link also hidden — no dead routes).
  if (!NOTES_ENABLED) notFound();
  // Empty-safe: 404 when no published notes exist.
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
