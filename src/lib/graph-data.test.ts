import { describe, it, expect } from "vitest";
import { graphNodes, graphEdges } from "@/lib/graph-data";

/**
 * The hero/Play graph is hand-placed: every project is a node with a fixed position that must
 * stay inside the camera frustum (camera z=7, fov 45, scale 1.6, see graph-data.ts) and apart
 * from its neighbours so labels do not overprint. game-model.test.ts already proves each node
 * maps to real content; this proves the geometry and the lineage edges stay sane as the
 * collection grows.
 */
describe("graphNodes", () => {
  it("has unique ids", () => {
    const ids = graphNodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every node inside the visible box", () => {
    for (const n of graphNodes) {
      const [x, y, z] = n.pos;
      expect(Math.abs(x), `${n.id} x=${x} leaves the frustum`).toBeLessThanOrEqual(2.6);
      expect(Math.abs(y), `${n.id} y=${y} leaves the frustum`).toBeLessThanOrEqual(1.8);
      expect(Math.abs(z), `${n.id} z=${z} is too deep`).toBeLessThanOrEqual(1.1);
    }
  });

  it("keeps every pair of nodes apart on screen so labels do not overprint", () => {
    const MIN_XY = 0.42;
    for (let i = 0; i < graphNodes.length; i++) {
      for (let j = i + 1; j < graphNodes.length; j++) {
        const a = graphNodes[i];
        const b = graphNodes[j];
        const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
        expect(d, `${a.id} and ${b.id} are ${d.toFixed(2)} apart in the view plane`).toBeGreaterThanOrEqual(MIN_XY);
      }
    }
  });
});

describe("graphEdges", () => {
  const ids = new Set(graphNodes.map((n) => n.id));

  it("only connects nodes that exist, never a node to itself", () => {
    for (const [a, b] of graphEdges) {
      expect(ids.has(a), `edge endpoint "${a}" is not a node`).toBe(true);
      expect(ids.has(b), `edge endpoint "${b}" is not a node`).toBe(true);
      expect(a).not.toBe(b);
    }
  });

  it("has no duplicate edge in either direction", () => {
    const keys = graphEdges.map(([a, b]) => [a, b].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("leaves no node unconnected (an island reads as a rendering bug)", () => {
    const connected = new Set(graphEdges.flat());
    expect(graphNodes.filter((n) => !connected.has(n.id)).map((n) => n.id)).toEqual([]);
  });
});
