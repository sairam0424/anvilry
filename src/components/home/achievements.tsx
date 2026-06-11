import { Trophy } from "lucide-react";
import { achievements } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export function Achievements() {
  return (
    <Section label="// competitive programming & impact" title="Recognition">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((a, i) => (
          <Reveal key={a.title} delay={(i % 3) * 0.06}>
            <div className="card-surface flex items-start gap-3 p-4">
              <Trophy size={18} className="mt-0.5 shrink-0 text-amber" />
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">{a.detail}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
