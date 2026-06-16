import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

/**
 * The in-place Anvil panel is a NON-MODAL disclosure: no Radix, so its a11y is
 * hand-rolled and must be pinned. We mock the voice session (so no real mic/STT) and
 * assert the disclosure contract:
 *  - opening via the store renders the panel (region) with TalkMode inside;
 *  - the opener (orb) gets aria-expanded=true + aria-controls while open;
 *  - an outside pointerdown closes it AND restores focus to the orb;
 *  - a click on the orb itself does NOT close (the open/close-race guard);
 *  - closing restores aria-expanded=false.
 */

const session = {
  supported: true,
  active: false,
  state: "idle" as string,
  interim: "",
  messages: [] as { role: string; content: string }[],
  isStreaming: false,
  error: null as string | null,
  start: vi.fn(),
  ask: vi.fn(),
  stop: vi.fn(),
  interrupt: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

vi.mock("@/components/chat/use-voice-session", async (orig) => {
  const actual = await orig<typeof import("./use-voice-session")>();
  return { ...actual, useVoiceSession: () => session };
});

import { AnvilInlinePanel } from "./anvil-inline-panel";
import { openInlineVoice, setInlineVoiceOpen } from "./anvil-inline-store";

beforeEach(() => {
  session.supported = true;
  session.active = false;
  session.state = "idle";
  session.messages = [];
  for (const k of ["start", "ask", "stop", "interrupt", "pause", "resume"] as const) session[k].mockClear();
  setInlineVoiceOpen(false);
});

afterEach(() => {
  setInlineVoiceOpen(false);
  cleanup();
});

/** A stand-in header orb button to drive the open/close + focus-restore contract. */
function mountOrb(): HTMLButtonElement {
  const orb = document.createElement("button");
  orb.type = "button";
  orb.setAttribute("aria-label", "Ask Anvil");
  document.body.appendChild(orb);
  return orb;
}

describe("AnvilInlinePanel (non-modal disclosure)", () => {
  it("renders nothing until opened", () => {
    render(<AnvilInlinePanel />);
    expect(screen.queryByRole("region", { name: /anvil voice/i })).toBeNull();
  });

  it("opens as a region with TalkMode, and marks the orb aria-expanded + aria-controls", () => {
    const orb = mountOrb();
    render(<AnvilInlinePanel />);
    act(() => openInlineVoice(orb));
    const region = screen.getByRole("region", { name: /anvil voice/i });
    expect(region).toBeTruthy();
    expect(region.id).toBe("anvil-inline-panel");
    expect(orb.getAttribute("aria-expanded")).toBe("true");
    expect(orb.getAttribute("aria-controls")).toBe("anvil-inline-panel");
  });

  it("an outside pointerdown closes the panel and restores focus to the orb", () => {
    const orb = mountOrb();
    render(<AnvilInlinePanel />);
    act(() => openInlineVoice(orb));
    expect(screen.getByRole("region", { name: /anvil voice/i })).toBeTruthy();

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(screen.queryByRole("region", { name: /anvil voice/i })).toBeNull();
    expect(document.activeElement).toBe(orb); // focus restored (WCAG 2.4.3)
    expect(orb.getAttribute("aria-expanded")).toBe("false");
  });

  it("a pointerdown ON the orb does NOT close the panel (open/close-race guard)", () => {
    const orb = mountOrb();
    render(<AnvilInlinePanel />);
    act(() => openInlineVoice(orb));
    act(() => {
      orb.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    // Still open — the orb's own click handles toggling, the outside-listener ignores it.
    expect(screen.getByRole("region", { name: /anvil voice/i })).toBeTruthy();
  });
});
