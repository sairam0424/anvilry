import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  heading: string;
  body?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, heading, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "card-surface flex flex-col items-center gap-3 px-8 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span className="text-fg-subtle" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="font-semibold text-fg">{heading}</h3>
      {body && <p className="max-w-xs text-sm text-fg-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
