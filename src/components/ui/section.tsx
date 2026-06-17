import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page section with a monospace "terminal" eyebrow label.
 *
 * `titleAs` sets the title's heading level (default "h2"). Each standalone page should
 * pass `titleAs="h1"` to its FIRST/primary section so the page has a single top-level
 * heading (WCAG 1.3.1 / 2.4.6) — otherwise the page's highest heading is an h2 and a
 * screen-reader heading list has no top anchor. Subsequent sections keep the h2 default.
 */
export function Section({
  id,
  label,
  title,
  titleAs: TitleTag = "h2",
  children,
  className,
}: {
  id?: string;
  label?: string;
  title?: string;
  titleAs?: "h1" | "h2";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-5xl px-6 py-20 sm:py-24 scroll-reveal", className)}>
      {(label || title) && (
        <header className="mb-10">
          {label && <p className="mono-label">{label}</p>}
          {title && (
            <TitleTag className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</TitleTag>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
