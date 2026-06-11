import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard page section with a monospace "terminal" eyebrow label. */
export function Section({
  id,
  label,
  title,
  children,
  className,
}: {
  id?: string;
  label?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-5xl px-6 py-20 sm:py-24", className)}>
      {(label || title) && (
        <header className="mb-10">
          {label && <p className="mono-label">{label}</p>}
          {title && (
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
