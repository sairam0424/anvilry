import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";

// Mock next/dynamic so the lazy HeroGraphScene renders synchronously in tests
// (same pattern as hero-avatar/index.dom.test.tsx).
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: React.FC } | React.FC>) => {
    const Comp = (props: object) => {
      const [C, setC] = React.useState<React.FC | null>(null);
      React.useEffect(() => {
        Promise.resolve(fn()).then((m) => setC(() => ("default" in m ? m.default : m)));
      }, []);
      return C ? <C {...props} /> : null;
    };
    return Comp;
  },
}));

let webglSupported = true;
vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => true, // desktop
  useWebGLSupported: () => webglSupported,
}));

vi.mock("@/lib/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

let currentView = "classic";
vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: currentView, setView: vi.fn() }),
}));

afterEach(() => {
  vi.resetModules();
  webglSupported = true;
  currentView = "classic";
});

describe("HeroGraph", () => {
  it("renders the CSS glow fallback (no canvas) when WebGL is unsupported", async () => {
    webglSupported = false;
    vi.doMock("./scene", () => ({ default: () => <canvas data-testid="hero-canvas" /> }));
    const { HeroGraph } = await import("./index");
    const { container } = render(<HeroGraph />);
    expect(container.querySelector("[data-testid='hero-canvas']")).toBeNull();
    expect(container.querySelectorAll(".blur-3xl").length).toBe(2);
  });

  it("renders the CSS glow fallback (no canvas) when the active view is not classic", async () => {
    currentView = "gamified";
    vi.doMock("./scene", () => ({ default: () => <canvas data-testid="hero-canvas" /> }));
    const { HeroGraph } = await import("./index");
    const { container } = render(<HeroGraph />);
    expect(container.querySelector("[data-testid='hero-canvas']")).toBeNull();
    expect(container.querySelectorAll(".blur-3xl").length).toBe(2);
  });

  it("falls back to the CSS glow — does not crash the page — when the WebGL scene throws during mount", async () => {
    vi.doMock("./scene", () => ({
      default: () => {
        throw new Error("simulated WebGL context creation failure");
      },
    }));
    const { HeroGraph } = await import("./index");

    // Reaching this line without render() throwing/rejecting IS the primary assertion:
    // WebGLBoundary must contain the failure, not let it propagate as an uncaught error.
    const { container } = render(<HeroGraph />);

    // Once WebGLBoundary's componentDidCatch fires onFail(), webglFailed flips true and
    // showWebGL becomes false on the next render — only the glow divs should remain.
    await waitFor(() => {
      expect(container.querySelectorAll(".blur-3xl").length).toBe(2);
    });
  });
});
