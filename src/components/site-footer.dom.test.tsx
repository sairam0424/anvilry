import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

// SiteFooter reads NEXT_PUBLIC_VISITOR_COUNTER at module load — stub it ON
vi.stubEnv("NEXT_PUBLIC_VISITOR_COUNTER", "true");

// SiteFooter uses useView() from view-context — stub the router dep
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// useView needs the store to be initialised — mock it to return "classic"
vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: "classic" }),
  ViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("VisitorBadge localStorage cache", () => {
  it("shows count from API on successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 42, today: 1 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(screen.getByText(/42/)).toBeTruthy();
    });
  });

  it("writes successful count to localStorage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 99, today: 2 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(localStorage.getItem("anvilry:visits:total")).toBe("99");
    });
  });

  it("shows cached count when API returns 0 (Redis unavailable)", async () => {
    // Pre-seed the cache with a previously stored count
    localStorage.setItem("anvilry:visits:total", "1500");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 0, today: 0 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(screen.getByText(/1[,.]?500/)).toBeTruthy();
    });
  });

  it("shows nothing (skeleton then no count) when API returns 0 and no cache exists", async () => {
    // No localStorage entry — fresh browser, Redis down
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 0, today: 0 }) })),
    );

    render(<SiteFooter />);

    // Wait for fetch to complete — badge should not render a number
    await waitFor(() => {
      expect(screen.queryByText(/engineers visited/)).toBeNull();
    });
  });

  it("shows cached count when fetch throws (network error)", async () => {
    localStorage.setItem("anvilry:visits:total", "750");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => { throw new Error("network error"); }),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(screen.getByText(/750/)).toBeTruthy();
    });
  });

  it("does not overwrite cache with 0 when Redis is unavailable", async () => {
    localStorage.setItem("anvilry:visits:total", "300");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 0, today: 0 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      // Cache should still hold 300, not be overwritten with 0
      expect(localStorage.getItem("anvilry:visits:total")).toBe("300");
    });
  });
});
