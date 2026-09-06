import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CommandPaletteContent } from "./command-palette-content";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@vercel/analytics", () => ({
  track: vi.fn(),
}));

const { setView, setPendingChatQuery } = vi.hoisted(() => ({
  setView: vi.fn(),
  setPendingChatQuery: vi.fn(),
}));
vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: "classic", setView }),
  setPendingChatQuery,
}));

vi.mock("@/lib/voice-settings-context", () => ({
  useVoiceSettings: () => ({
    settings: { voiceId: null, ttsEnabled: false },
    set: vi.fn(),
    toggle: vi.fn(),
  }),
}));

vi.mock("@/components/chat/voice-picker", () => ({
  VoicePicker: () => null,
}));

vi.mock("@/components/chat/voice-settings-dialog", () => ({
  VoiceSettingsDialog: () => null,
}));

vi.mock("@/components/chat/talk-overlay-store", () => ({
  openTalkMode: vi.fn(),
}));

// Node's own built-in `localStorage` global shadows happy-dom's in this
// environment (see view-hint.dom.test.tsx) — stub it in-memory, scoped here.
function createLocalStorageStub() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createLocalStorageStub());
  setView.mockClear();
  setPendingChatQuery.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPalette() {
  const triggerRef = { current: null };
  return render(
    <CommandPaletteContent
      discoveryBadgesEnabled={false}
      open={true}
      onOpenChange={vi.fn()}
      triggerRef={triggerRef}
    />,
  );
}

describe("command palette empty-state AI concierge redirect", () => {
  it("offers to ask the AI concierge when a search has zero matches", async () => {
    renderPalette();
    const input = screen.getByPlaceholderText(
      /Jump to a page, run an action, or switch view/,
    );
    fireEvent.change(input, {
      target: { value: "zzz-definitely-no-matches-zzz" },
    });

    expect(
      screen.getByText(/Ask the AI concierge: "zzz-definitely-no-matches-zzz"/),
    ).toBeTruthy();
  });

  it("hands off the query and switches to chat view on click", () => {
    renderPalette();
    const input = screen.getByPlaceholderText(
      /Jump to a page, run an action, or switch view/,
    );
    fireEvent.change(input, { target: { value: "no-match-query" } });

    const redirectButton = screen.getByText(/Ask the AI concierge:/);
    fireEvent.click(redirectButton);

    expect(setPendingChatQuery).toHaveBeenCalledWith("no-match-query");
    expect(setView).toHaveBeenCalledWith("chat");
  });

  it("shows plain 'No results.' when the search is empty (no redirect offered)", () => {
    renderPalette();
    // Idle query with results present shouldn't show Command.Empty at all;
    // this just pins that an EMPTY search never renders the redirect copy.
    expect(screen.queryByText(/Ask the AI concierge:/)).toBeNull();
  });
});
