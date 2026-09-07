import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { GithubStatsStrip } from "./github-stats-strip";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GithubStatsStrip — last-shipped stat card", () => {
  it("renders a 'last shipped' card using the API's mostRecentPush field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          followers: 12,
          publicRepos: 11,
          totalStars: 40,
          totalForks: 5,
          mostRecentPush: "2026-09-05T10:00:00Z",
        }),
      })),
    );

    render(<GithubStatsStrip />);

    await waitFor(() => {
      expect(screen.getByText(/last shipped/i)).toBeTruthy();
    });
  });

  it("omits the last-shipped card when mostRecentPush is null, without hiding the rest of the strip", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          followers: 12,
          publicRepos: 11,
          totalStars: 40,
          totalForks: 5,
          mostRecentPush: null,
        }),
      })),
    );

    render(<GithubStatsStrip />);

    await waitFor(() => {
      expect(screen.getByText("public repos")).toBeTruthy();
    });
    expect(screen.queryByText(/last shipped/i)).toBeNull();
  });

  it("never renders 'currently coding' or any real-time framing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          followers: 12,
          publicRepos: 11,
          totalStars: 40,
          totalForks: 5,
          mostRecentPush: "2026-09-05T10:00:00Z",
        }),
      })),
    );

    render(<GithubStatsStrip />);

    await waitFor(() => {
      expect(screen.getByText(/last shipped/i)).toBeTruthy();
    });
    expect(screen.queryByText(/currently coding/i)).toBeNull();
  });
});
