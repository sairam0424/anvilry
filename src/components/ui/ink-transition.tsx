"use client";

/**
 * InkTransition — a raw WebGL2 fullscreen ink-burn shader that fires over the live
 * 3D scene when the visitor switches views.
 *
 * Architecture:
 *   - A fixed <canvas> (pointer-events:none, z-index:50, mix-blend-mode:multiply)
 *     sits above all DOM content. When inactive the canvas is display:none so it
 *     consumes zero GPU time.
 *   - The fragment shader uses 4-octave fBm noise + a uProgress uniform (0→1) to
 *     drive an organic ink-spreading burn that reveals the incoming view.
 *   - The NDC-space fullscreen triangle avoids camera projection entirely, so the
 *     burn composites cleanly over the R3F scene without projection fighting.
 *   - `transitionIn(onMidpoint)` advances uProgress from 0→1 over DURATION_MS via
 *     requestAnimationFrame (no GSAP dependency). `onMidpoint` fires at 50% — that
 *     is when the view store emits the new view, so the burn burns away the OLD view
 *     and reveals the NEW view underneath.
 *
 * Gates (all must be true for the ink to fire):
 *   - WebGL2 context available
 *   - prefers-reduced-motion: no-preference
 *   - The global `inkTransitionRef` is populated (component is mounted)
 *
 * If any gate fails, `commitViewChange` falls back to the existing CSS crossfade.
 *
 * CSP: raw WebGL2 in a same-origin canvas — no new script sources required.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

// Duration of the full ink-burn pass (ms). At 50% the view switches.
const DURATION_MS = 800;

export type InkTransitionHandle = {
  transitionIn(onMidpoint: () => void): void;
};

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// 4-octave fBm noise ink-burn. At each UV, if the noise value < uProgress the
// pixel is discarded (revealed), otherwise it is painted black (ink).
// The result is an organic ink-spreading burn advancing from noisy edges.
const FRAG_SRC = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform float uProgress;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv * 3.5 + uTime * 0.15;
  float n = fbm(uv);
  // Discard (reveal) where noise < scaled progress; paint black (ink) otherwise.
  if (n < uProgress * 1.3 - 0.15) discard;
  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile error");
  }
  return s;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
  }
  return prog;
}

// Module-level ref so commitViewChange() (a module-level fn in view-context.tsx)
// can call it without React context.
export let inkTransitionRef: InkTransitionHandle | null = null;

export const InkTransition = forwardRef<InkTransitionHandle>(function InkTransition(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const uProgressRef = useRef<WebGLUniformLocation | null>(null);
  const uTimeRef = useRef<WebGLUniformLocation | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialise WebGL2 once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
    if (!gl) return; // WebGL2 unavailable — ink falls back to CSS crossfade.

    try {
      const prog = createProgram(gl);
      gl.useProgram(prog);

      // Fullscreen NDC triangle: two triangles filling [-1,1]^2.
      const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      glRef.current = gl;
      progRef.current = prog;
      uProgressRef.current = gl.getUniformLocation(prog, "uProgress");
      uTimeRef.current = gl.getUniformLocation(prog, "uTime");
    } catch {
      // Shader compile failure (unlikely, but guard so the rest of the app is unaffected).
    }

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handle: InkTransitionHandle = {
    transitionIn(onMidpoint: () => void) {
      const canvas = canvasRef.current;
      const gl = glRef.current;
      if (!canvas || !gl || !progRef.current) {
        // No WebGL — fire midpoint immediately for the plain crossfade fallback.
        onMidpoint();
        return;
      }

      canvas.style.display = "block";
      const startTime = performance.now();
      let midpointFired = false;

      // Resize to match the viewport.
      const dpr = window.devicePixelRatio ?? 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);

      function render(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / DURATION_MS, 1);

        if (!midpointFired && progress >= 0.5) {
          midpointFired = true;
          onMidpoint();
        }

        if (!gl) return;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uProgressRef.current, progress);
        gl.uniform1f(uTimeRef.current, elapsed / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(render);
        } else {
          if (!midpointFired) onMidpoint(); // safety — fire if 50% was skipped
          if (canvas) canvas.style.display = "none";
          rafRef.current = null;
        }
      }

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    },
  };

  useImperativeHandle(ref, () => handle);

  // Expose globally for commitViewChange() (module-level fn, not React context).
  useEffect(() => {
    inkTransitionRef = handle;
    return () => { inkTransitionRef = null; };
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        display: "none",
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
        mixBlendMode: "multiply",
      }}
    />
  );
});
