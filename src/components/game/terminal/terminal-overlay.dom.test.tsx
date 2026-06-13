import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useRef, useState } from "react";

/**
 * WCAG 2.4.3 regression: the fullscreen terminal overlay is a CONTROLLED Radix dialog
 * opened by an external button — Radix only auto-restores focus to its own
 * <Dialog.Trigger>, so a controlled dialog must restore focus to the trigger manually
 * (via triggerRef + onCloseAutoFocus). This test pins that: open the overlay, close it,
 * assert focus returns to the trigger button.
 *
 * The mounted <Terminal> pulls useTerminal -> useRouter/useView/track and
 * useAutoScroll -> ResizeObserver, so all are mocked/stubbed for the happy-dom run.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/view-context", () => ({ useView: () => ({ view: "developer", setView: vi.fn() }) }));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

import { TerminalOverlay } from "./terminal-overlay";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

/** Harness mirroring how DeveloperView/GameView drive the overlay: an external trigger
 *  button + the controlled overlay, sharing a triggerRef. */
function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Maximize terminal to fullscreen
      </button>
      <TerminalOverlay open={open} onOpenChange={setOpen} triggerRef={triggerRef} />
    </div>
  );
}

describe("TerminalOverlay focus restoration (WCAG 2.4.3)", () => {
  it("restores focus to the trigger when closed", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /maximize terminal/i });

    // Open the overlay.
    act(() => trigger.click());
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

    // Close via the dialog's Close button.
    const close = screen.getByRole("button", { name: /close terminal/i });
    act(() => close.click());

    // Radix onCloseAutoFocus runs on a microtask/rAF — wait for the restore.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
