import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { allWork } from "@/lib/content";
import { profile } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export const revalidate = 3600;

const description = `Production systems built by ${profile.name} at ${profile.company} — multi-agent LLM orchestration, AI coding tools, and GenAI platforms with real metrics.`;

export const metadata: Metadata = {
  title: "Work",
  description,
  alternates: { canonical: "/work" },
  openGraph: { type: "website", url: "/work", title: `Work — ${profile.name}`, description },
};

export default function WorkPage() {
  return (
    <main className="flex-1">
      <Section
        label="// production work @ Ascendion"
        title="Systems I helped build"
        titleAs="h1"
      >
        <Reveal>
          <p className="max-w-2xl text-fg-muted">
            Production systems shipping to thousands of users daily. Every metric is real and defensible;
            the register is honest — &quot;co-built&quot; means exactly that.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {allWork.map((w, i) => (
            <Reveal key={w.slug} delay={i * 0.08}>
              <Link
                href={w.url}
                className="card-surface group flex h-full flex-col p-6 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="mono-label">{w.register}</span>
                  <ArrowUpRight
                    size={18}
                    className="text-fg-subtle transition-colors group-hover:text-accent"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight group-hover:text-accent">
                  {w.name}
                </h2>
                <p className="mt-1 text-sm text-fg-subtle">{w.role}</p>
                <p className="mt-3 text-sm text-fg-muted">{w.summary}</p>

                <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
                  {w.metrics.map((m) => (
                    <div key={m.label}>
                      <dt className="text-lg font-semibold text-accent">{m.value}</dt>
                      <dd className="text-[11px] text-fg-subtle">{m.label}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>
    </main>
  );
}
