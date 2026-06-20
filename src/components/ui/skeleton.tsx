"use client";

import { useReducedMotion } from "motion/react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Base skeleton primitive — apply .skeleton-shimmer (globals.css) for the sweep.
 * aria-hidden: decorative — screen readers should only see the role="status" container.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite skeletons — content-aware shapes matching real components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matches GithubStatsStrip StatCard layout:
 * [icon circle] [value line] [label line]
 */
export function SkeletonStatCard() {
  return (
    <div className="card-surface flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
}

/**
 * Matches card-surface layout (ArticleGroupCard, NoteCard, ProjectCard).
 * Header badge + title block + summary lines + footer.
 */
export function SkeletonCard() {
  return (
    <div className="card-surface flex flex-col gap-3 p-5">
      {/* badge + date row */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      {/* title */}
      <Skeleton className="h-4 w-5/6" />
      {/* summary lines */}
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      {/* footer */}
      <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-10 rounded-md" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/**
 * Matches the resume PDF iframe (h-[80vh]).
 * Shows shimmer background + centered PDF icon hint.
 */
export function SkeletonIframe() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 skeleton-shimmer rounded-xl">
      <FileText size={32} className="text-fg-subtle/40" aria-hidden="true" />
      <Skeleton className="h-2.5 w-24 rounded-full" />
    </div>
  );
}

/**
 * Matches 2-3 lines of markdown text (Ask Portfolio, Chat messages).
 */
export function SkeletonMarkdownLine() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}

/**
 * Full-viewport skeleton for dynamic import fallbacks during view transitions.
 * Uses the Anvilry orb aesthetic: pulsing cyan circle + skeleton lines.
 */
export function SkeletonViewTransition({ label }: { label?: string }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-6"
      role="status"
      aria-label={label ?? "Loading..."}
    >
      {/* Orb ring — matches the Anvilry voice orb aesthetic */}
      <div
        className={cn(
          "h-16 w-16 rounded-full border border-accent/30 bg-accent/5",
          !reduced && "animate-pulse",
        )}
        aria-hidden="true"
      />
      {/* Skeleton content lines */}
      <div className="w-40 space-y-2">
        <Skeleton className="h-2.5 w-full rounded-full" />
        <Skeleton className="mx-auto h-2.5 w-3/4 rounded-full" />
        <Skeleton className="mx-auto h-2.5 w-1/2 rounded-full" />
      </div>
      <span className="sr-only">{label ?? "Loading..."}</span>
    </div>
  );
}
