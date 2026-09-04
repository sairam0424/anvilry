"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Tooltip is pure progressive enhancement: the wrapped trigger (an icon button/link)
 * must render immediately for SSR/no-JS/first paint, and the hover-tooltip behavior
 * itself is not needed for that. @radix-ui/react-tooltip + its floating-ui positioning
 * dependency is ~56KB — bundled statically via the global <TooltipProvider> in
 * providers.tsx, that sat in EVERY route's first-load JS and blew the bundle budget
 * uniformly across all pages (measured: 15-37KB over budget everywhere, not just on
 * pages that visibly use tooltips). Deferred the same way InkTransition/DiscoveryBadge
 * already are in providers.tsx: a client-only dynamic import, loaded lazily post-mount
 * rather than bundled into the critical path. Before the module resolves (SSR, first
 * paint, and briefly after hydration), both components render children/passthrough
 * with zero tooltip behavior — never blocking or delaying the trigger's own render.
 */

type RadixModule = typeof import("./tooltip-radix");

function useRadixTooltip(): RadixModule | null {
  const [mod, setMod] = useState<RadixModule | null>(null);
  useEffect(() => {
    let active = true;
    import("./tooltip-radix").then((m) => {
      if (active) setMod(m);
    });
    return () => {
      active = false;
    };
  }, []);
  return mod;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  const mod = useRadixTooltip();
  if (!mod) return <>{children}</>;
  return <mod.TooltipProviderImpl>{children}</mod.TooltipProviderImpl>;
}

export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const mod = useRadixTooltip();
  if (!mod) return <>{children}</>;
  return (
    <mod.TooltipRoot content={content} side={side}>
      {children}
    </mod.TooltipRoot>
  );
}
