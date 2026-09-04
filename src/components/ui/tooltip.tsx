"use client";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils"; // confirmed exists

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ content, children, side = "bottom" }: {
  content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6}
          className={cn("z-50 rounded-md border border-border-strong bg-bg-elevated px-2.5 py-1.5 text-xs text-fg shadow-lg")}>
          {content}
          <TooltipPrimitive.Arrow className="fill-bg-elevated" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
