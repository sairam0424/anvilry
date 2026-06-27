import { allProjects, allWork, getProject, getWork, type Project, type Work } from "@/lib/content";
import { graphNodes, graphEdges, type GraphNode } from "@/lib/graph-data";

/**
 * Derivation layer that lets the GAMIFIED view render from the SAME canonical
 * content as Classic (Velite) — zero duplication, zero fabrication. Everything is
 * derived by ITERATING allProjects/allWork, so a new content file appears in the
 * game automatically. The build-time coverage test (game-model.test.ts) asserts
 * this layer never drifts from the content (every node resolves, every item is
 * reachable). Mirrors the role of src/lib/corpus.ts for the chat view.
 */

/** What kind of canonical content a graph node points at (NOT the node's visual kind). */
export type ContentKind = "work" | "project";

/**
 * Maps each hero-graph node id to the real content item it represents.
 *
 * LAUNCH BLOCKER this fixes: 3 of the 10 graph node ids do NOT equal their content
 * slug — `aava`→`aava-code` (work), `grpc`→`grpc-microservices`, `nhl`→
 * `not-humans-lab`. Without this map, "click a node → open its card" would 404 for
 * 30% of the graph (including the flagship AAVA work item). The node's visual `kind`
 * (work|agent|engine|tool, for color) is also collapsed here to the CONTENT kind
 * (work|project) so resolveNode knows which collection to look in.
 *
 * Keep this exhaustive: the build-time test fails if any graphNode id is missing.
 */
export const NODE_CONTENT: Record<string, { kind: ContentKind; slug: string }> = {
  // Flagship production work (Ascendion)
  pensieve: { kind: "work", slug: "pensieve" },
  aava: { kind: "work", slug: "aava-code" }, // node id != slug
  "wireframe-generator": { kind: "work", slug: "wireframe-generator" },
  "prompt-to-react": { kind: "work", slug: "prompt-to-react" },
  "execution-engine": { kind: "work", slug: "execution-engine" },
  // Agent frameworks & infra (projects)
  mindforge: { kind: "project", slug: "mindforge" },
  "agent-forge": { kind: "project", slug: "agent-forge" },
  contextos: { kind: "project", slug: "contextos" },
  // Code intelligence & engines (projects)
  "graph-forge": { kind: "project", slug: "graph-forge" },
  "ag-bash": { kind: "project", slug: "ag-bash" },
  grpc: { kind: "project", slug: "grpc-microservices" }, // node id != slug
  // Tooling & lab (projects)
  commandvault: { kind: "project", slug: "commandvault" },
  nhl: { kind: "project", slug: "not-humans-lab" }, // node id != slug
  // Production intelligence & publishing
  tombstone: { kind: "project", slug: "tombstone" },
  trelix: { kind: "project", slug: "trelix" },
  inkforge: { kind: "project", slug: "inkforge" },
};

export type ResolvedContent =
  | { kind: "work"; item: Work }
  | { kind: "project"; item: Project };

/**
 * Resolve a graph node id to its real canonical content item. Returns null if the
 * node has no mapping or the mapped slug doesn't exist — callers treat null as
 * "not navigable" rather than rendering an empty card. (The build test guarantees
 * null never happens at runtime for a shipped node.)
 */
export function resolveNode(nodeId: string): ResolvedContent | null {
  const ref = NODE_CONTENT[nodeId];
  if (!ref) return null;
  if (ref.kind === "work") {
    const item = getWork(ref.slug);
    return item ? { kind: "work", item } : null;
  }
  const item = getProject(ref.slug);
  return item ? { kind: "project", item } : null;
}

/** The canonical deep-link into the Classic view for a resolved content item. */
export function hrefFor(resolved: ResolvedContent): string {
  return resolved.item.url; // Velite sets /work/<slug> or /projects/<slug>
}

/**
 * A quest node = a graph node enriched with the real content it points to + the
 * dossier facts. This is what both the DOM-first index and the 3D graph render.
 * Derived by iterating graphNodes, so it stays in lockstep with the hero scene.
 */
export type QuestNode = {
  id: string;
  /** Short label from graph-data (e.g. "AAVA Code"). */
  label: string;
  /** Visual kind for color (work|agent|engine|tool) — from the graph, not content. */
  visualKind: GraphNode["kind"];
  /** Position in the 3D cloud (reused by the interactive graph). */
  pos: GraphNode["pos"];
  /** Resolved canonical content + its Classic deep-link. */
  resolved: ResolvedContent;
  href: string;
};

export const questNodes: QuestNode[] = graphNodes.flatMap((n) => {
  const resolved = resolveNode(n.id);
  if (!resolved) return []; // unreachable for shipped nodes (build test enforces)
  return [
    {
      id: n.id,
      label: n.label,
      visualKind: n.kind,
      pos: n.pos,
      resolved,
      href: hrefFor(resolved),
    },
  ];
});

/**
 * Graph edges with their endpoint node positions resolved — so the interactive 3D
 * scene can draw lines without re-deriving the node index. Only edges whose BOTH
 * endpoints are shipped quest nodes are kept.
 */
const nodePos = new Map(questNodes.map((n) => [n.id, n.pos]));
export const graphEdgesResolved: { pos: GraphNode["pos"] }[][] = graphEdges.flatMap(([a, b]) => {
  const pa = nodePos.get(a);
  const pb = nodePos.get(b);
  return pa && pb ? [[{ pos: pa }, { pos: pb }]] : [];
});

/** A single honest fact shown on a dossier card — every value traces to content/profile. */
export type DossierFact = { value: string; label: string };

export type Dossier = {
  id: string;
  name: string;
  /** Headline under the name — work.role or project.tagline. */
  subtitle: string;
  /** Honest contribution register (work only) e.g. "Co-built · architected the backend". */
  register?: string;
  /** One-line description — work.summary or project.excerpt. */
  blurb: string;
  /** Verifiable facts only — work.metrics, or project commits/tech-count. No XP/score. */
  facts: DossierFact[];
  tech: string[];
  href: string;
  /** Outbound repo link for projects (none for internal work). */
  repo?: string;
};

/** Build the dossier for a quest node from its resolved canonical content. */
export function dossierFor(node: QuestNode): Dossier {
  if (node.resolved.kind === "work") {
    const w = node.resolved.item;
    return {
      id: node.id,
      name: w.name,
      subtitle: w.role,
      register: w.register,
      blurb: w.summary,
      facts: w.metrics.map((m) => ({ value: m.value, label: m.label })),
      tech: w.tech,
      href: w.url,
    };
  }
  const p = node.resolved.item;
  const facts: DossierFact[] = [];
  if (p.commits != null) facts.push({ value: `${p.commits}`, label: "commits" });
  facts.push({ value: `${p.tech.length}`, label: "technologies" });
  return {
    id: node.id,
    name: p.name,
    subtitle: p.tagline,
    blurb: p.excerpt,
    facts,
    tech: p.tech,
    href: p.url,
    repo: p.repo,
  };
}

/** All dossiers, grouped for the accessible DOM-first index (work first, then project groups). */
export function questGroups(): { group: string; nodes: QuestNode[] }[] {
  const work = questNodes.filter((n) => n.resolved.kind === "work");
  const projectGroupOrder = [
    "Agent Frameworks & Infrastructure",
    "Code Intelligence & Engines",
    "Tooling & Lab",
  ];
  const projectGroups = projectGroupOrder.map((group) => ({
    group,
    nodes: questNodes.filter(
      (n) => n.resolved.kind === "project" && n.resolved.item.group === group,
    ),
  }));
  return [{ group: "Production Work", nodes: work }, ...projectGroups].filter(
    (g) => g.nodes.length > 0,
  );
}

/** Total count of explorable systems — for the optional "Explored N of M" coverage note. */
export const TOTAL_SYSTEMS = questNodes.length;

/** Sanity counts used by the coverage test (kept here so the test imports one module). */
export const CONTENT_COUNTS = {
  work: allWork.length,
  projects: allProjects.length,
  nodes: graphNodes.length,
  quests: questNodes.length,
};
