"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

/**
 * The premium desktop "Siri orb" — an R3F icosahedron whose vertices are displaced by
 * DOMAIN-WARPED fractal noise (fBm) scaled by the live `level` (0..1), shaded by a
 * 3-stop gradient + a fresnel rim, and wrapped in an additive halo back-sphere for a
 * volumetric bloom (no postprocessing dep — CSP-safe inline GLSL only). Reuses the
 * in-bundle three/@react-three/fiber deps. Mounted ONLY inside talk mode and ONLY on
 * desktop+WebGL+motion (gated by the selector), so it never touches the Classic path.
 * GPU geometry is disposed on unmount (R3F auto-disposes the renderer when it leaves).
 *
 * level is a REF read inside useFrame — never React state — so 60fps reactivity never
 * re-renders the React tree.
 *
 * HDR note: R3F defaults to ACESFilmicToneMapping + sRGB output; we set it explicitly so
 * the intent is durable. The shaders deliberately output values >1.0 on crests/rim so
 * ACES BLOOMS the highlights (a value >1.0 rolls off softly, it does not hard-clip).
 */

// A richer palette than a flat 2-color mix: deep blue core -> cyan body -> violet rim.
const DEEP = new THREE.Color("#1b6cff"); // core
const ACCENT = new THREE.Color("#38e1ff"); // mid (site accent)
const RIM = new THREE.Color("#cbb6ff"); // hot rim glow
const HALO = new THREE.Color("#5ea0ff"); // outer volumetric halo

// Ashima 3D simplex noise (public domain) — shared by the orb + halo vertex stages.
const SNOISE = /* glsl */ `
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
  // 5-octave fractal Brownian motion for multi-scale, fluid surface detail.
  float fbm(vec3 p){
    float a = 0.5, f = 1.0, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * snoise(p * f); f *= 2.0; a *= 0.5; }
    return s;
  }
`;

// Orb vertex shader: domain-warp the sample point so the surface BOILS/SWIRLS instead of
// rigidly scrolling, then displace along the normal. Passes world normal + view dir +
// noise to the fragment stage for the gradient + fresnel.
const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uSpeaking;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vNoise;
  varying float vDisp;

  ${SNOISE}

  void main() {
    // uSpeaking (0..1) surges turbulence WHILE SPEAKING — more domain warp + bigger
    // displacement than uLevel alone, so the orb visibly "comes alive" mid-answer.
    float t = uTime * (0.35 + uSpeaking * 0.5);
    float warpGain = 0.6 + uSpeaking * 0.5;
    vec3 warp = vec3(
      fbm(position * 1.1 + t),
      fbm(position * 1.1 + vec3(5.2, 1.3, t)),
      fbm(position * 1.1 + vec3(-3.4, 2.7, -t))
    );
    float amp = 0.10 + uLevel * 0.42 + uSpeaking * 0.18;
    float n = fbm(position * 1.7 + warp * warpGain + t * 0.8);
    float disp = n * amp;
    vDisp = disp;
    vNoise = n;
    vec3 newPos = position + normal * disp;
    vec4 worldPos = modelMatrix * vec4(newPos, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

// Orb fragment shader: 3-stop gradient by noise height + a fresnel rim, with HDR heat
// (values >1.0) tied to level so the whole orb brightens/blooms on loud syllables.
const FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uLevel;
  uniform float uSpeaking;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vNoise;
  varying float vDisp;

  void main() {
    float h = clamp(vNoise * 1.6 + 0.5, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.55, h));
    col = mix(col, uColorC, smoothstep(0.5, 1.0, h));
    float fres = pow(1.0 - max(dot(normalize(vViewDir), normalize(vNormalW)), 0.0), 2.5);
    // Extra HDR heat while speaking so the whole orb blooms hotter mid-answer.
    float heat = 0.85 + uLevel * 0.9 + uSpeaking * 0.5;
    vec3 lit = col * (0.7 + h * 0.6) * heat;
    lit += uColorC * fres * (1.4 + uLevel * 1.6 + uSpeaking * 0.8); // glowing rim, hotter when loud / speaking
    gl_FragColor = vec4(lit, clamp(0.78 + fres * 0.5 + h * 0.2, 0.0, 1.0));
  }
`;

// Halo back-sphere: an inverted-fresnel additive shell that bleeds soft light beyond the
// orb silhouette — the CSP-safe stand-in for UnrealBloom (no postprocessing dep).
const HALO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HALO_FRAG = /* glsl */ `
  uniform vec3 uHaloColor;
  uniform float uLevel;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float f = pow(1.0 - max(dot(normalize(vViewDir), normalize(vNormalW)), 0.0), 3.0);
    gl_FragColor = vec4(uHaloColor * f * (0.6 + uLevel * 1.2), f);
  }
`;

function OrbMesh({
  level,
  speaking,
}: {
  level: React.RefObject<number>;
  speaking: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const haloRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uSpeaking: { value: 0 },
      uColorA: { value: DEEP },
      uColorB: { value: ACCENT },
      uColorC: { value: RIM },
    }),
    [],
  );
  const haloUniforms = useMemo(
    () => ({ uHaloColor: { value: HALO }, uLevel: { value: 0 } }),
    [],
  );

  useFrame((_, delta) => {
    const t = uniforms.uTime.value;
    const target = level.current ?? 0;
    const speakTarget = speaking ? 1 : 0;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      // Ease the shader level toward the latest amplitude for smoothness.
      matRef.current.uniforms.uLevel.value +=
        (target - matRef.current.uniforms.uLevel.value) * 0.2;
      // Ease the speaking surge in/out so the "beast" ramps, never snaps.
      matRef.current.uniforms.uSpeaking.value +=
        (speakTarget - matRef.current.uniforms.uSpeaking.value) * 0.08;
    }
    if (haloRef.current) {
      haloRef.current.uniforms.uLevel.value +=
        (target - haloRef.current.uniforms.uLevel.value) * 0.2;
    }
    if (meshRef.current) {
      // Organic drift + whole-body breathing scale (manual — NOT drei <Float>, which
      // would fight these direct transform assignments and jitter). Spin a touch faster
      // while speaking for extra life.
      const surge = matRef.current?.uniforms.uSpeaking.value ?? 0;
      meshRef.current.rotation.y += delta * (0.08 + surge * 0.12);
      meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.12;
      const breathe = 1 + 0.04 * Math.sin(t * 0.9) + target * 0.1 + surge * 0.04;
      meshRef.current.scale.setScalar(breathe);
    }
  });

  return (
    <group>
      {/* Additive halo, drawn first (renderOrder -1) so the orb composites over it; both
          depthWrite:false + additive blending make the co-located sort deterministic. */}
      <mesh scale={1.6} renderOrder={-1}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={haloRef}
          vertexShader={HALO_VERT}
          fragmentShader={HALO_FRAG}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={meshRef} renderOrder={0}>
        <icosahedronGeometry args={[1, 24]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function VoiceOrb3D({
  level,
  state,
  size = 160,
}: {
  level: React.RefObject<number>;
  state: VoiceSessionState;
  size?: number;
}) {
  const speaking = state === "speaking";
  return (
    <div aria-hidden="true" style={{ width: size, height: size }}>
      {/* frameloop="always" because the orb is continuously audio-reactive while talk
          mode is open; it unmounts (and disposes the GL context) when the modal closes,
          so it never burns frames on the Classic view. Tone-mapping is set explicitly
          (R3F's default is ACES, but pinning it makes the HDR-bloom intent durable). */}
      <Canvas
        frameloop="always"
        dpr={[1, 1.75]}
        // Camera pulled BACK so the orb + its 1.6-radius halo fit with margin: visible
        // half-height = dist*tan(fov/2) = 4.6*tan(22.5) ≈ 1.9 > the 1.6 halo, so the glow
        // fades to transparent INSIDE the canvas instead of clipping to a hard square.
        camera={{ position: [0, 0, 4.6], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{ width: size, height: size }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 3]} intensity={1.2} color="#bcd4ff" />
        <OrbMesh level={level} speaking={speaking} />
      </Canvas>
    </div>
  );
}
