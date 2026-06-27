"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame, OrbitControls, Billboard, Text, THREE } from "@/lib/r3f";
import type { ThreeEvent } from "@/lib/r3f";
import { kindColor } from "@/lib/graph-data";
import { questNodes, graphEdgesResolved } from "@/lib/game-model";

const SCALE = 1.6;

/**
 * Interactive 3D Build Graph — the desktop + full-motion ENHANCEMENT over the
 * accessible DOM index. Unlike the decorative hero (one InstancedMesh, no
 * interaction), each of the 10 nodes is an individual mesh so it can be hovered,
 * clicked, and labelled — the draw-call cost is irrelevant at this count. Selecting
 * a node calls onSelect(nodeId); the parent opens that node's REAL card.
 *
 * frameloop stays "demand"; OrbitControls + the hover ease invalidate() only while
 * the user interacts, so the graph idles at 0fps when still (battery-friendly). The
 * WebGL context is disposed automatically when this component unmounts (the view
 * router unmounts the gamified subtree on exit — no leaked context on mobile).
 */
function Edges() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (const [a, b] of graphEdgesResolved) {
      points.push(a.pos[0] * SCALE, a.pos[1] * SCALE, a.pos[2] * SCALE);
      points.push(b.pos[0] * SCALE, b.pos[1] * SCALE, b.pos[2] * SCALE);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3a4258" transparent opacity={0.7} toneMapped={false} />
    </lineSegments>
  );
}

function Node({
  id,
  label,
  color,
  position,
  hovered,
  onHover,
  onSelect,
}: {
  id: string;
  label: string;
  color: string;
  position: [number, number, number];
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { invalidate } = useThree();
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const target = hovered ? 1.5 : 1;
    const s = m.scale.x + (target - m.scale.x) * 0.2;
    // Mutating the live Three.js scene node inside useFrame is the required R3F pattern.
    m.scale.setScalar(s);
    if (Math.abs(target - s) > 0.005) invalidate();
  });

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(id);
          invalidate();
        }}
        onPointerOut={() => {
          onHover(null);
          invalidate();
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(id);
        }}
      >
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Always-visible label: dim at rest, bright on hover so the graph is readable without interaction */}
      <Billboard position={[0, 0.34, 0]}>
        <Text
          fontSize={hovered ? 0.22 : 0.17}
          color={hovered ? "#e9ecf5" : "#8b92a8"}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.01}
          outlineColor="#07080d"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function Graph({ onSelect }: { onSelect: (id: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <group rotation={[0.12, -0.3, 0]}>
      <Edges />
      {questNodes.map((n) => (
        <Node
          key={n.id}
          id={n.id}
          label={n.label}
          color={kindColor[n.visualKind]}
          position={[n.pos[0] * SCALE, n.pos[1] * SCALE, n.pos[2] * SCALE]}
          hovered={hovered === n.id}
          onHover={setHovered}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export default function BuildGraphScene({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <Canvas
      frameloop="demand"
      // offsetSize fixes the "canvas stuck at 300x150" race when the ResizeObserver
      // first measures 0 inside a freshly-mounted (lazy) container. Matches the hero.
      resize={{ offsetSize: true }}
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Graph onSelect={onSelect} />
      {/* Drag to rotate; OrbitControls invalidates frames only while interacting. */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.6}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(2 * Math.PI) / 3}
      />
    </Canvas>
  );
}
