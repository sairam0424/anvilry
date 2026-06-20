import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-bg-base hover:bg-accent-strong focus-visible:ring-accent",
  secondary:
    "border border-border-strong text-fg hover:bg-bg-elevated focus-visible:ring-accent",
  ghost:
    "text-fg-muted hover:text-fg hover:bg-bg-surface focus-visible:ring-accent",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
        "disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
