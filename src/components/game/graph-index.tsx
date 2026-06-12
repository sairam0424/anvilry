import { DossierCard } from "@/components/game/dossier-card";
import { questGroups, TOTAL_SYSTEMS } from "@/lib/game-model";

/**
 * Accessible DOM-first index of every system — the DEFAULT gamified layer and the
 * mobile / reduced-motion / no-JS / screen-reader fallback for the 3D graph. It is
 * NOT a re-skinned projects page: each dossier deep-links into the canonical
 * Classic /work|/projects pages, reusing Classic as the reading surface. Pure
 * markup (no client JS), keyboard- and SR-navigable by construction.
 */
export function GraphIndex() {
  const groups = questGroups();

  return (
    <section aria-label="Explore every system" className="mt-6">
      <p className="text-sm text-fg-muted">
        {TOTAL_SYSTEMS} systems — flagship production work and open-source infrastructure.
        Open any dossier to read the full story.
      </p>

      {groups.map((g) => (
        <div key={g.group} className="mt-8">
          <h2 className="mono-label">{g.group}</h2>
          <ul className="mt-3 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
            {g.nodes.map((node) => (
              <li key={node.id}>
                <DossierCard node={node} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
