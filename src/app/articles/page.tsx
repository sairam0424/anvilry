import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { allArticles } from "@/lib/content";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Articles",
  description: "Articles and long-form writing published on Medium, Substack, and LinkedIn.",
  alternates: { canonical: "/articles" },
};

/** Absolute, human-readable date (UTC; no relative drift). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

const SOURCE_META: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  medium:    { label: "Medium",    color: "text-[#00ab6c]",  dot: "bg-[#00ab6c]"  },
  substack:  { label: "Substack",  color: "text-[#ff6719]",  dot: "bg-[#ff6719]"  },
  linkedin:  { label: "LinkedIn",  color: "text-[#0a66c2]",  dot: "bg-[#0a66c2]"  },
  native:    { label: "Essay",     color: "text-accent",      dot: "bg-accent"     },
};

export default function ArticlesPage() {
  // Empty-safe: ships dark until the first article is added. Nav link also gates
  // on hasArticles, so this 404 keeps the route consistent with the nav state.
  if (allArticles.length === 0) notFound();

  return (
    <main className="flex-1">
      <Section label="// writing" title="Articles">
        <ul className="max-w-2xl space-y-1">
          {allArticles.map((a, i) => {
            const meta = SOURCE_META[a.source] ?? SOURCE_META.native;
            // linkedNote → point to the existing /notes/<slug> page (no duplicate content)
            // external source → open original publication in new tab
            // native with no linkedNote → internal /articles/<slug> detail page
            const isExternal = a.source !== "native" && !!a.externalUrl;
            const href = a.linkedNote
              ? `/notes/${a.linkedNote}`
              : isExternal
              ? a.externalUrl!
              : a.url;

            return (
              <li key={a.slug}>
                <Reveal delay={(i % 4) * 0.04}>
                  <Link
                    href={href}
                    {...(isExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group flex flex-col gap-1 rounded-xl border border-transparent px-4 py-4 transition-colors hover:border-border hover:bg-bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 font-medium text-fg group-hover:text-accent">
                        {a.title}
                        {isExternal && (
                          <ExternalLink
                            size={13}
                            className="shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-fg-subtle">{fmt(a.date)}</span>
                    </span>
                    <span className="text-sm text-fg-muted">{a.summary}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                      <span className={`font-mono text-[11px] ${meta.color}`}>{meta.label}</span>
                      {a.readingTime && (
                        <span className="font-mono text-[11px] text-fg-subtle">· {a.readingTime} min read</span>
                      )}
                    </span>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Section>
    </main>
  );
}
