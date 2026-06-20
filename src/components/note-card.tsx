"use client";

import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { Note } from "@/lib/content";

/** Absolute, human-readable date (UTC; no relative drift). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function NoteCard({ note }: { note: Note }) {
  return (
    <motion.div
      layout
      whileHover={{ scale: 1.015, boxShadow: "var(--glow-accent)" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="card-surface group h-full"
    >
      <Link
        href={note.url}
        className="flex h-full flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-[inherit]"
      >
        {/* header row: date + inkforge badge */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-fg-subtle">{fmt(note.date)}</span>
          {note.generatedBy === "inkforge" && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
              <Sparkles size={11} aria-hidden="true" />
              inkforge
            </span>
          )}
        </div>

        {/* title */}
        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
          {note.title}
        </h3>

        {/* summary */}
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-fg-muted">{note.summary}</p>

        {/* footer: tags + reading time */}
        <div className="mt-4 flex items-end justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                {t}
              </span>
            ))}
          </div>
          {note.readingTime && (
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-fg-subtle">
              <Clock size={11} aria-hidden="true" />
              {note.readingTime} min
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
