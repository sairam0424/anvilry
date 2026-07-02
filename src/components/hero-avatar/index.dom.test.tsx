import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock next/dynamic so the lazy AvatarScene renders synchronously in tests.
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ AvatarScene: React.FC }>) => {
    // Return a component that renders its target synchronously.
    const Comp = (props: object) => {
      const [C, setC] = React.useState<React.FC | null>(null);
      React.useEffect(() => {
        fn().then((m) => setC(() => m.AvatarScene));
      }, []);
      return C ? <C {...props} /> : null;
    };
    return Comp;
  },
}));

// AvatarScene itself renders a canvas — mock it to keep tests fast.
vi.mock("./avatar-scene", () => ({
  AvatarScene: () => <canvas data-testid="avatar-canvas" />,
}));

// Mock view context.
vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: "classic", setView: vi.fn() }),
}));

// Mock WebGLBoundary to pass through children.
vi.mock("@/components/game/webgl-boundary", () => ({
  WebGLBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("HeroAvatar", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders CSS glow fallback on mobile (< 768px)", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    // jsdom: matchMedia returns false by default — simulates mobile
    const { HeroAvatar } = await import("./index");
    render(<HeroAvatar />);
    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
    // glow div is always present
    expect(document.querySelector(".blur-3xl")).toBeTruthy();
  });

  it("hero-side position applies correct mask class", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_POSITION", "hero-side");
    const { HeroAvatar } = await import("./index");
    const { container } = render(<HeroAvatar />);
    // The mask wrapper has a specific mask-image class
    expect(container.innerHTML).toContain("mask-image");
  });

  it("hero-split position applies border-l class", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_POSITION", "hero-split");
    const { HeroAvatar } = await import("./index");
    const { container } = render(<HeroAvatar />);
    expect(container.innerHTML).toContain("border-l");
  });

  it("hero-top position applies translate-x-1/2 centering class", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_POSITION", "hero-top");
    const { HeroAvatar } = await import("./index");
    const { container } = render(<HeroAvatar />);
    expect(container.innerHTML).toContain("-translate-x-1/2");
  });
});
