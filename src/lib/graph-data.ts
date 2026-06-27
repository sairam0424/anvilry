/**
 * Knowledge-graph data for the hero WebGL scene.
 * Nodes = the 5 flagship work systems + 8 OSS repos; edges = real lineage
 * (shared themes / build-on relationships from the workspace CLAUDE.md).
 * Positions are deterministic (no Math.random) so SSR/build stays stable.
 */
export type GraphNode = {
  id: string;
  label: string;
  kind: "work" | "agent" | "engine" | "tool";
  /** unit-ish position in a loose 3D cloud */
  pos: [number, number, number];
};

export type GraphEdge = [string, string];

export const graphNodes: GraphNode[] = [
  // Flagship work (center mass) — Ascendion systems
  { id: "pensieve", label: "Pensieve", kind: "work", pos: [0, 0.4, 0] },
  { id: "aava", label: "AAVA Code", kind: "work", pos: [1.3, -0.2, 0.4] },
  { id: "wireframe-generator", label: "Wireframe Gen", kind: "work", pos: [0.6, -0.9, 0.5] },
  { id: "prompt-to-react", label: "Prompt→React", kind: "work", pos: [-0.5, 0.6, 0.7] },
  { id: "execution-engine", label: "Execution Engine", kind: "work", pos: [0.4, 1.1, -0.4] },
  // Agent frameworks & infra
  { id: "mindforge", label: "MindForge", kind: "agent", pos: [-1.6, 0.9, -0.3] },
  { id: "agent-forge", label: "Agent-Forge", kind: "agent", pos: [-2.1, -0.3, 0.5] },
  { id: "contextos", label: "ContextOS", kind: "agent", pos: [-1.2, -1.1, -0.4] },
  // Code intelligence & engines
  { id: "graph-forge", label: "Graph-Forge", kind: "engine", pos: [1.9, 1.0, -0.5] },
  { id: "ag-bash", label: "ag-bash", kind: "engine", pos: [2.4, 0.1, 0.6] },
  { id: "grpc", label: "gRPC OPS", kind: "engine", pos: [1.6, -1.2, -0.2] },
  // Tooling & lab
  { id: "commandvault", label: "CommandVault", kind: "tool", pos: [-0.3, 1.5, 0.5] },
  { id: "nhl", label: "Not-Humans-Lab", kind: "tool", pos: [0.2, -1.6, -0.5] },
  // Production intelligence & publishing tools
  // Positions kept within frustum: camera z=7, fov=45 → visible half-height ≈ 2.9 / SCALE=1.6 ≈ 1.8 units
  { id: "tombstone", label: "Tombstone", kind: "tool", pos: [-1.7, -0.7, 0.9] },
  { id: "trelix", label: "trelix", kind: "engine", pos: [2.2, -0.6, -0.9] },
  { id: "inkforge", label: "Inkforge", kind: "tool", pos: [0.1, 1.7, 0.9] },
];

export const graphEdges: GraphEdge[] = [
  // agent-infra lineage
  ["mindforge", "agent-forge"],
  ["agent-forge", "contextos"],
  ["mindforge", "contextos"],
  // engines
  ["graph-forge", "ag-bash"],
  ["graph-forge", "grpc"],
  // work systems pull from the agent/engine cluster
  ["pensieve", "mindforge"],
  ["pensieve", "graph-forge"],
  ["aava", "agent-forge"],
  ["aava", "ag-bash"],
  // Experience Studio GenAI pipeline lineage (wireframe -> prompt-to-react),
  // and the prompt-driven execution engine ties into the agent-orchestration cluster
  ["wireframe-generator", "prompt-to-react"],
  ["prompt-to-react", "aava"],
  ["execution-engine", "pensieve"],
  ["execution-engine", "mindforge"],
  // lab federates tooling
  ["nhl", "commandvault"],
  ["nhl", "contextos"],
  ["commandvault", "mindforge"],
  // Tombstone and Inkforge are in the same production-tooling cluster
  ["tombstone", "nhl"],         // Tombstone is part of the Not-Humans-World workspace
  ["trelix", "graph-forge"],    // trelix is a code-intelligence engine (sibling of Graph-Forge)
  ["inkforge", "commandvault"], // Inkforge generates content that CommandVault indexes
];

export const kindColor: Record<GraphNode["kind"], string> = {
  work: "#38e1ff", // accent cyan — the hero systems
  agent: "#a78bfa", // violet — agent frameworks
  engine: "#4ade80", // green — engines
  tool: "#fbbf24", // amber — tooling
};
