import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Typography for plain text pages (contact, privacy, developers). The classes are the ones the
 * MDX components map already uses for long-form text, so these pages read like the case studies
 * without a new visual language, and they sit on the existing colour tokens (dark and light).
 */

export function ProseH2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 mb-3 scroll-mt-24 text-xl font-semibold tracking-tight text-fg">
      {children}
    </h2>
  );
}

export function ProseP({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("my-3 leading-relaxed text-fg-muted", className)}>{children}</p>;
}

export function ProseList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="my-3 space-y-2 text-fg-muted">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span aria-hidden="true" className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-fg">{children}</code>;
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg-surface p-4 font-mono text-xs text-fg-muted">
      {children}
    </pre>
  );
}
