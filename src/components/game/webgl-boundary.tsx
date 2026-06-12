"use client";

import { Component, type ReactNode } from "react";

/**
 * Error boundary around the lazy R3F scene. If WebGL context creation fails (GPU
 * blocklisted, context limit hit, software-GL refused, driver crash), the scene
 * throws — without this, that would blank or break the gamified view. Here it
 * fails silently to `null`, and the always-present DOM index below remains the
 * full experience. A class component is required: only class error boundaries
 * catch render/runtime errors from descendants in React.
 */
export class WebGLBoundary extends Component<
  { children: ReactNode; onFail?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surface for debugging without breaking the page; the DOM index is the fallback.
    console.warn("[build-graph] WebGL scene unavailable — falling back to the index.", error);
    this.props.onFail?.();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
