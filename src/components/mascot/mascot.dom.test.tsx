import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { Mascot } from "./mascot";

const DIRECTIONS = "/sheets/fox-directions.webp";
const REACTIONS = "/sheets/fox-reactions.webp";

/** Stub matchMedia so each query answers from a table (happy-dom's default is a blanket false). */
function stubMedia(answers: Record<string, boolean>) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const matches = Object.entries(answers).some(([k, v]) => v && query.includes(k));
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  });
}

function layers(button: HTMLElement) {
  const spans = button.querySelectorAll<HTMLSpanElement>("span > span");
  return { directions: spans[0], reactions: spans[1] };
}

beforeEach(() => {
  // happy-dom has no Web Animations API; the component must cope and we assert on the call.
  HTMLElement.prototype.animate = vi.fn() as unknown as typeof HTMLElement.prototype.animate;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Mascot", () => {
  it("renders one button named after the label, sized explicitly, with both sheets mounted", () => {
    stubMedia({});
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} size={160} label="mascot" />);
    const button = screen.getByRole("button", { name: "Boop the mascot" });
    expect(button.style.width).toBe("160px");
    expect(button.style.height).toBe("160px");
    const { directions, reactions } = layers(button);
    expect(directions.style.backgroundImage).toContain(DIRECTIONS);
    expect(reactions.style.backgroundImage).toContain(REACTIONS);
  });

  it("rests on the centre cell with the reactions layer hidden", () => {
    stubMedia({});
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    const { directions, reactions } = layers(screen.getByRole("button"));
    expect(directions.style.backgroundPosition).toBe("50% 50%");
    expect(directions.style.opacity).toBe("1");
    expect(reactions.style.opacity).toBe("0");
  });

  it("ignores pointer movement when the device has no fine pointer", () => {
    stubMedia({ "pointer: fine": false });
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 400, clientY: 0 }));
    });
    expect(layers(screen.getByRole("button")).directions.style.backgroundPosition).toBe("50% 50%");
  });

  it("turns toward the pointer on fine-pointer devices", () => {
    stubMedia({ "pointer: fine": true });
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    // happy-dom reports a 0x0 box at (0,0), so the centre is the origin.
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 400, clientY: 0 }));
    });
    expect(layers(screen.getByRole("button")).directions.style.backgroundPosition).toBe("100% 50%");
  });

  it("blinks on click, pays off with a heart, then returns to rest", () => {
    vi.useFakeTimers();
    stubMedia({});
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    const { reactions } = layers(button);
    expect(reactions.style.opacity).toBe("1");
    expect(reactions.style.backgroundPosition).toBe("0% 0%"); // blink
    act(() => { vi.advanceTimersByTime(130); });
    expect(reactions.style.backgroundPosition).toBe("50% 0%"); // heart
    act(() => { vi.advanceTimersByTime(500); });
    expect(reactions.style.opacity).toBe("0");
  });

  it("plays the squash animation on click", () => {
    stubMedia({ "prefers-reduced-motion": false });
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    fireEvent.click(screen.getByRole("button"));
    expect(HTMLElement.prototype.animate).toHaveBeenCalledTimes(1);
  });

  it("skips the squash under prefers-reduced-motion but still swaps the expression", () => {
    stubMedia({ "prefers-reduced-motion": true });
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(HTMLElement.prototype.animate).not.toHaveBeenCalled();
    expect(layers(button).reactions.style.opacity).toBe("1");
  });

  it("survives a browser without the Web Animations API", () => {
    stubMedia({});
    // @ts-expect-error — simulate an engine without element.animate
    delete HTMLElement.prototype.animate;
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} />);
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
  });
});

describe("Mascot size", () => {
  it("accepts a CSS length so a wrapper can size it per breakpoint", () => {
    stubMedia({});
    render(<Mascot directions={DIRECTIONS} reactions={REACTIONS} size="var(--mascot-size)" />);
    const button = screen.getByRole("button");
    expect(button.style.width).toBe("var(--mascot-size)");
    expect(button.style.height).toBe("var(--mascot-size)");
  });
});
