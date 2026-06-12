"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { graphNodes, graphEdges, kindColor } from "@/lib/graph-data";

const SCALE = 1.6;
const idx = Object.fromEntries(graphNodes.map((n, i) => [n.id, i]));

/**
 * Shared pointer state, updated from a window listener. The canvas itself has
 * pointer-events:none (so hero buttons stay clickable), which means R3F's built-in
 * pointer tracking never fires — so we track it ourselves and ease toward it.
 */
const ptr = { x: 0, y: 0 };

/** All 10 nodes as ONE InstancedMesh — single draw call (research-verified). */
function Nodes() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const { invalidate } = useThree();
  const geo = useMemo(() => new THREE.SphereGeometry(0.13, 24, 24), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const color = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    graphNodes.forEach((n, i) => {
      dummy.position.set(n.pos[0] * SCALE, n.pos[1] * SCALE, n.pos[2] * SCALE);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, color.set(kindColor[n.kind]));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [color, dummy, invalidate]);

  // Release the GPU geometry/material when the hero unmounts (e.g. switching views).
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);

  return <instancedMesh ref={mesh} args={[geo, mat, graphNodes.length]} />;
}

/** Edges as a single LineSegments object — single draw call. */
function Edges() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (const [a, b] of graphEdges) {
      const na = graphNodes[idx[a]];
      const nb = graphNodes[idx[b]];
      points.push(na.pos[0] * SCALE, na.pos[1] * SCALE, na.pos[2] * SCALE);
      points.push(nb.pos[0] * SCALE, nb.pos[1] * SCALE, nb.pos[2] * SCALE);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, []);
  // Release the GPU buffer when the hero unmounts.
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3a4258" transparent opacity={0.7} toneMapped={false} />
    </lineSegments>
  );
}

/** Eases group rotation toward the tracked pointer; settles to rest (demand-friendly). */
function Rig({ group }: { group: React.RefObject<THREE.Group | null> }) {
  const { invalidate } = useThree();
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const tx = ptr.y * 0.22;
    const ty = ptr.x * 0.4;
    const dx = tx - g.rotation.x;
    const dy = ty - g.rotation.y;
    // Mutating the Three.js object inside useFrame is the required R3F animation
    // pattern — `g` is a live scene-graph node, not React state.
    /* eslint-disable react-hooks/immutability */
    g.rotation.x += dx * 0.05;
    g.rotation.y += dy * 0.05;
    /* eslint-enable react-hooks/immutability */
    if (Math.abs(dx) > 0.0006 || Math.abs(dy) > 0.0006) invalidate();
  });
  return null;
}

function Graph() {
  const group = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = -((e.clientY / window.innerHeight) * 2 - 1);
      invalidate();
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [invalidate]);
  return (
    <group ref={group} rotation={[0.15, -0.3, 0]}>
      <Edges />
      <Nodes />
      <Rig group={group} />
    </group>
  );
}

export default function HeroGraphScene() {
  return (
    <Canvas
      frameloop="demand"
      // offsetSize fixes the "canvas stuck at 300x150" race when the ResizeObserver
      // reports 0 on first measure inside an absolutely-positioned parent.
      resize={{ offsetSize: true }}
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", width: "100%", height: "100%" }}
    >
      <Graph />
    </Canvas>
  );
}
