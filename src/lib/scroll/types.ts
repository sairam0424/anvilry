/**
 * Shared types for the autoscroll layer. Two orthogonal knobs are A/B-tested behind
 * feature flags (see scroll-flags.ts), then the measured winner becomes the default:
 *
 *  - ScrollEngine — build-vs-buy. "custom" = the in-repo intent-flag + ResizeObserver
 *    hook; "library" = the use-stick-to-bottom npm package adapter.
 *  - ScrollMode — chat scroll UX. "bottom-pin" = follow the bottom of the stream;
 *    "message-top" = ChatGPT/Claude-style, scroll the newest user message to the top
 *    of the viewport and stream below it. The terminal always uses bottom-pin.
 */
export type ScrollEngine = "custom" | "library";
export type ScrollMode = "bottom-pin" | "message-top";

/** One benchmark sample emitted by an engine during the bake-off (dev-only). */
export type ScrollMetric = {
  /** Which surface emitted it, e.g. "chat" | "widget" | "terminal". */
  surface: string;
  /** Engine that produced the sample. */
  engine: ScrollEngine;
  /** Gap in px between scrollTop and the true bottom right after a settle (lower = better). */
  missedBottomPx: number;
  /** True if a programmatic snap was misread as a user scroll (a de-pin false positive). */
  falseDepin: boolean;
  /** ms from the content-resize event to the completed snap (lower = better). */
  snapLatencyMs: number;
};

export type UseAutoScrollOptions = {
  /** Re-engage tolerance (px) on the USER-scroll listener. Chat ~120, terminal ~32. */
  threshold?: number;
  /** Terminal: typing re-pins to the bottom (xterm parity). */
  scrollOnUserInput?: boolean;
  /** Only run when true (the floating widget passes `open`). Default true. */
  enabled?: boolean;
  /** Chat scroll UX. Ignored by the terminal (always bottom-pin). Default "bottom-pin". */
  mode?: ScrollMode;
  /** Label for benchmark samples, e.g. "chat" | "widget" | "terminal". */
  surface?: string;
  /** Dev-only benchmark sink. No-op (undefined) in production. */
  onMetric?: (m: ScrollMetric) => void;
};

/**
 * Engine-agnostic return shape. Both the custom hook and the library adapter expose
 * exactly this, so call sites never branch on the active engine.
 */
export type UseAutoScroll = {
  /** Callback ref for the OVERFLOW container (the element with overflow-y-auto). */
  scrollRef: (node: HTMLElement | null) => void;
  /** Callback ref for the inner CONTENT wrapper — the ResizeObserver target that grows. */
  contentRef: (node: HTMLElement | null) => void;
  /** Geometric: are we pinned at (or within ~1px of) the bottom? Drives the jump button. */
  isAtBottom: boolean;
  /** Imperative re-pin + snap. Used by the jump button and terminal keydown. */
  scrollToBottom: () => void;
  /**
   * "message-top" mode only: callback ref the chat marks on its NEWEST user message,
   * so the snap can bring that message to the top of the viewport (and stream the
   * answer below it). No-op in bottom-pin mode and for engines/surfaces that don't
   * support it (the library adapter, the widget, the terminal).
   */
  anchorRef?: (node: HTMLElement | null) => void;
};
