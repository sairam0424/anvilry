"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, EffectComposer, Bloom, Vignette, Noise, ChromaticAberration, THREE } from "@/lib/r3f";
import { BlendFunction } from "postprocessing"; // peer dep of @react-three/postprocessing
import { Fluid } from "@whatisjery/react-fluid-distortion";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

/**
 * The premium desktop "Siri orb" — an R3F icosahedron whose vertices are displaced by
 * DOMAIN-WARPED fractal noise (fBm) scaled by the live `level` (0..1), shaded by a
 * 3-stop gradient + a fresnel rim, and wrapped in an additive halo back-sphere for a
 * volumetric bloom. Post-processing via @react-three/postprocessing adds Bloom (HDR
 * crests only via luminanceThreshold=1.0), Vignette, film Noise, and ChromaticAberration
 * composited in ONE merged EffectPass — equivalent to a single extra render call.
 * Gated behind a device-tier check (≥4 GB RAM + ≥4 cores) so low-end devices still get
 * the raw orb with inline halo. Mounted ONLY inside talk mode and ONLY on desktop+WebGL+motion.
 *
 * errorMode: when true (404 page), shifts palette to red/orange, boosts turbulence, and
 * replaces the smooth breathing oscillation with an erratic double-sin pattern — making
 * the orb look "distressed" with zero audio coupling.
 *
 * HDR note: ACES + sRGB output; shaders output values >1.0 on crests/rim so the Bloom
 * effect with luminanceThreshold=1.0 selectively blooms ONLY the bright parts.
 */

// A richer palette than a flat 2-color mix: deep blue core -> cyan body -> violet rim.
const DEEP = new THREE.Color("#1b6cff"); // core
const ACCENT = new THREE.Color("#38e1ff"); // mid (site accent)
const RIM = new THREE.Color("#cbb6ff"); // hot rim glow
const HALO = new THREE.Color("#5ea0ff"); // outer volumetric halo

// Error-mode palette — burnt orange / red for the 404 distressed state.
const ERR_A = new THREE.Color("#ff4e00"); // core burnt orange
const ERR_B = new THREE.Color("#ff1a1a"); // rim red

// Detect device capability for adaptive quality. Runs once at component mount
// (not a React hook — called inside a client-only component, safe to call at top-level).
function getDeviceTier(): "high" | "low" {
  if (typeof navigator === "undefined") return "high"; // SSR fallback
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return mem >= 4 && cores >= 4 ? "high" : "low";
}

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
// rigidly scrolling, then displace along the normal. In errorMode the breathing oscillation
// is replaced by an erratic double-sin for a "distressed" feel.
const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uSpeaking;
  uniform float uErrorMode;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vNoise;
  varying float vDisp;

  ${SNOISE}

  void main() {
    float t = uTime * (0.35 + uSpeaking * 0.5);
    float warpGain = 0.6 + uSpeaking * 0.5;
    vec3 warp = vec3(
      fbm(position * 1.1 + t),
      fbm(position * 1.1 + vec3(5.2, 1.3, t)),
      fbm(position * 1.1 + vec3(-3.4, 2.7, -t))
    );
    // errorMode boosts turbulence amplitude by 1.4×
    float errBoost = 1.0 + uErrorMode * 0.4;
    float amp = (0.10 + uLevel * 0.42 + uSpeaking * 0.18) * errBoost;
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

// Orb fragment shader: 3-stop gradient by noise height + fresnel rim. errorMode shifts
// the palette toward red/orange for the 404 distressed look.
const FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uErrA;
  uniform vec3 uErrB;
  uniform float uLevel;
  uniform float uSpeaking;
  uniform float uErrorMode;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vNoise;
  varying float vDisp;

  void main() {
    float h = clamp(vNoise * 1.6 + 0.5, 0.0, 1.0);
    vec3 colA = mix(uColorA, uErrA, uErrorMode);
    vec3 colC = mix(uColorC, uErrB, uErrorMode);
    vec3 col = mix(colA, uColorB, smoothstep(0.0, 0.55, h));
    col = mix(col, colC, smoothstep(0.5, 1.0, h));
    float fres = pow(1.0 - max(dot(normalize(vViewDir), normalize(vNormalW)), 0.0), 2.5);
    float heat = 0.85 + uLevel * 0.9 + uSpeaking * 0.5;
    vec3 lit = col * (0.7 + h * 0.6) * heat;
    lit += colC * fres * (1.4 + uLevel * 1.6 + uSpeaking * 0.8);
    gl_FragColor = vec4(lit, clamp(0.78 + fres * 0.5 + h * 0.2, 0.0, 1.0));
  }
`;

// Halo back-sphere: inverted-fresnel additive shell for volumetric softness.
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
    float rim = 1.0 - max(dot(normalize(vViewDir), normalize(vNormalW)), 0.0);
    float f = pow(rim, 4.5);
    float alpha = f * f;
    gl_FragColor = vec4(uHaloColor * f * (0.5 + uLevel * 1.1), alpha);
  }
`;

function OrbMesh({
  level,
  speaking,
  errorMode,
}: {
  level: React.RefObject<number>;
  speaking: boolean;
  errorMode: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const haloRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uSpeaking: { value: 0 },
      uErrorMode: { value: errorMode ? 1.0 : 0.0 },
      uColorA: { value: DEEP },
      uColorB: { value: ACCENT },
      uColorC: { value: RIM },
      uErrA: { value: ERR_A },
      uErrB: { value: ERR_B },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      matRef.current.uniforms.uLevel.value +=
        (target - matRef.current.uniforms.uLevel.value) * 0.2;
      matRef.current.uniforms.uSpeaking.value +=
        (speakTarget - matRef.current.uniforms.uSpeaking.value) * 0.08;
    }
    if (haloRef.current) {
      haloRef.current.uniforms.uLevel.value +=
        (target - haloRef.current.uniforms.uLevel.value) * 0.2;
    }
    if (meshRef.current) {
      const surge = matRef.current?.uniforms.uSpeaking.value ?? 0;
      meshRef.current.rotation.y += delta * (0.08 + surge * 0.12);
      meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.12;

      // errorMode: erratic double-sin breathing instead of smooth, for a distressed feel.
      const breatheBase = errorMode
        ? Math.sin(t * 0.3 + Math.sin(t * 1.7) * 0.5)
        : Math.sin(t * 0.9);
      const breathe = 1 + 0.04 * breatheBase + target * 0.1 + surge * 0.04;
      meshRef.current.scale.setScalar(breathe);
    }
  });

  return (
    <group>
      <mesh scale={1.8} renderOrder={-1}>
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
  errorMode = false,
}: {
  level: React.RefObject<number>;
  state: VoiceSessionState;
  size?: number;
  /** When true, shifts palette to red/orange + erratic oscillation. Used by 404 page. */
  errorMode?: boolean;
}) {
  const speaking = state === "speaking";
  // Post-processing is opt-in: set NEXT_PUBLIC_ORB_POSTPROCESSING=true to enable Bloom +
  // Vignette + Noise + ChromaticAberration. Default is the original inline-halo orb which
  // already achieves a volumetric glow effect via the HALO_FRAG back-sphere shader.
  const postFx = process.env.NEXT_PUBLIC_ORB_POSTPROCESSING === "true";
  const tier = getDeviceTier();

  return (
    <div aria-hidden="true" style={{ width: size, height: size }}>
      <Canvas
        frameloop={errorMode ? "demand" : "always"}
        // Restore original dpr — the adaptive tier scaling is only needed when
        // post-processing is on (where GPU cost is higher).
        dpr={[1, 1.75]}
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
        <OrbMesh level={level} speaking={speaking} errorMode={errorMode} />

        {/* Post-processing — only when NEXT_PUBLIC_ORB_POSTPROCESSING=true AND high-tier device.
            Default is the original inline-halo orb (HALO_FRAG back-sphere) for the clean look.
            Fluid runs FIRST so distorted pixels are then bloomed by the Bloom pass — order matters. */}
        {postFx && tier === "high" && (
          <EffectComposer>
            <Fluid
              force={errorMode ? 0.1 : 0.4}
              velocityDissipation={0.95}
            />
            <Bloom
              mipmapBlur
              luminanceThreshold={1.0}
              luminanceSmoothing={0.025}
              intensity={1.5}
              radius={0.4}
            />
            <Vignette offset={0.15} darkness={0.9} />
            <Noise opacity={0.025} premultiply={false} blendFunction={BlendFunction.ADD} />
            <ChromaticAberration
              offset={new THREE.Vector2(0.002, 0.002)}
              radialModulation={false}
              modulationOffset={0}
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
