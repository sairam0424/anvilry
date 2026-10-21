import type { CSSProperties } from "react";
import { StackGlyph, StackIcon } from "@/components/stack-icons";
import { STACK_ENTRIES, stackBrandVars } from "@/lib/stack";

/**
 * Skill chip for the About page's "What I work with" grid (src/app/about/page.tsx).
 *
 * Same data as the home Stack wall: a skill that has a STACK_ENTRIES record gets a 14px
 * glyph (brand mark from Simple Icons, or the neutral lucide glyph for tools without a
 * licensed mark) in front of its label; concept skills (RAG, Microservices, ...) stay
 * text-only. The glyph is --fg-muted at rest and takes the brand colour while the chip is
 * hovered, through the same per-theme --brand-dark / --brand-light variables and contrast
 * overrides the wall uses (see .skill-chip-glyph in globals.css). The chip itself keeps its
 * resting border and text on hover: it is not a link, so nothing should suggest a click.
 *
 * Server-safe (no "use client"); the glyph is decorative (aria-hidden) and the label is
 * the only text, so the accessible name is unchanged from the plain chips it replaces.
 */
export function SkillChip({ name }: { name: string }) {
  const entry = STACK_ENTRIES[name];
  return (
    <span className="skill-chip inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted">
      {entry && (
        <span
          className="skill-chip-glyph inline-flex shrink-0 transition-colors"
          style={stackBrandVars(entry) as CSSProperties}
          aria-hidden="true"
        >
          {entry.kind === "brand" ? (
            <StackIcon icon={entry.icon} size={14} />
          ) : (
            <StackGlyph glyph={entry.glyph} size={14} />
          )}
        </span>
      )}
      {name}
    </span>
  );
}
