"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

/**
 * The premium desktop "Siri orb" — an R3F icosahedron whose vertices are displaced by
 * 3D simplex noise scaled by the live `level` (0..1), giving a gooey, breathing,
 * audio-reactive sphere. Reuses the in-bundle three/@react-three/fiber deps (no new
 * vendor, no CSP change). Mounted ONLY inside talk mode and ONLY on desktop+WebGL+motion
 * (gated by the selector), so it never touches the Classic critical path. GPU geometry
 * disposed on unmount (R3F auto-disposes the canvas/renderer when the component leaves).
 *
 * level is a REF read inside useFrame — never React state — so 60fps reactivity never
 * re-renders the React tree.
 */

const ACCENT = new THREE.Color("#38e1ff");
const VIOLET = new THREE.Color("#a78bfa");

// Inline GLSL: classic Ashima simplex noise (snoise) + a vertex shader that pushes each
// vertex along its normal by noise(position*freq + time) * amp, where amp tracks level.
const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  varying float vDisp;

  // --- Ashima 3D simplex noise (public domain) ---
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float amp = 0.12 + uLevel * 0.55;
    float n = snoise(position * 1.6 + vec3(0.0, 0.0, uTime * 0.6));
    float disp = n * amp;
    vDisp = disp;
    vec3 newPos = position + normal * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vDisp;
  void main() {
    // Mix accent->violet by displacement so crests glow brighter.
    float t = clamp(vDisp * 1.8 + 0.5, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, t);
    float glow = 0.55 + t * 0.45;
    gl_FragColor = vec4(col * glow, 0.92);
  }
`;

function OrbMesh({ level }: { level: React.RefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uColorA: { value: ACCENT },
      uColorB: { value: VIOLET },
    }),
    [],
  );

  useFrame((_, delta) => {
    const m = matRef.current;
    if (m) {
      m.uniforms.uTime.value += delta;
      // Ease the shader level toward the latest amplitude for smoothness.
      const target = level.current ?? 0;
      m.uniforms.uLevel.value += (target - m.uniforms.uLevel.value) * 0.2;
    }
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 24]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

export function VoiceOrb3D({
  level,
  size = 160,
}: {
  level: React.RefObject<number>;
  state: VoiceSessionState;
  size?: number;
}) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size }}>
      {/* frameloop="always" because the orb is continuously audio-reactive while talk
          mode is open; it unmounts (and disposes the GL context) when the modal closes,
          so it never burns frames on the Classic view. */}
      <Canvas
        frameloop="always"
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ width: size, height: size }}
      >
        <OrbMesh level={level} />
      </Canvas>
    </div>
  );
}
