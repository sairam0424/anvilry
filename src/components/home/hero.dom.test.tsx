import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// The WebGL slots and the live GitHub strip are out of scope here.
vi.mock("@/components/hero-graph", () => ({ HeroGraph: () => <div data-testid="hero-graph" /> }));
vi.mock("@/components/hero-avatar", () => ({ HeroAvatar: () => <div data-testid="hero-avatar" /> }));
vi.mock("@/components/github-stats-strip", () => ({ GithubStatsStrip: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Hero mascot mode", () => {
  it("renders the knowledge graph and no mascot by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "");
    const { Hero } = await import("./hero");
    render(<Hero />);
    expect(screen.getByTestId("hero-graph")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /boop the/i })).toBeNull();
  });

  it("renders the mascot button instead of a WebGL slot when NEXT_PUBLIC_HERO_MODE=mascot", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "mascot");
    const { Hero } = await import("./hero");
    render(<Hero />);
    expect(screen.getByRole("button", { name: "Boop the mascot" })).toBeTruthy();
    expect(screen.queryByTestId("hero-graph")).toBeNull();
    expect(screen.queryByTestId("hero-avatar")).toBeNull();
  });

  it("keeps the avatar mode untouched", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    const { Hero } = await import("./hero");
    render(<Hero />);
    expect(screen.getByTestId("hero-avatar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /boop the/i })).toBeNull();
  });
});
