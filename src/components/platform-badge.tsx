"use client";

/** Tinted platform pill — used by ArticleCard and the articles filter bar.
 *  source "native" = first-party essay (no external platform). */
export type ArticleSource =
  | "medium"
  | "substack"
  | "linkedin"
  | "devto"
  | "hashnode"
  | "native";

const SOURCE_CONFIG: Record<
  ArticleSource,
  { label: string; color: string; bg: string; border: string }
> = {
  medium:   { label: "Medium",   color: "#00ab6c", bg: "rgba(0,171,108,0.08)",    border: "rgba(0,171,108,0.2)"    },
  substack: { label: "Substack", color: "#ff6719", bg: "rgba(255,103,25,0.08)",   border: "rgba(255,103,25,0.2)"   },
  linkedin: { label: "LinkedIn", color: "#0a66c2", bg: "rgba(10,102,194,0.08)",   border: "rgba(10,102,194,0.2)"   },
  devto:    { label: "Dev.to",   color: "#a855f7", bg: "rgba(168,85,247,0.08)",   border: "rgba(168,85,247,0.2)"   },
  hashnode: { label: "Hashnode", color: "#2563eb", bg: "rgba(37,99,235,0.08)",    border: "rgba(37,99,235,0.2)"    },
  native:   { label: "Essay",    color: "#38e1ff", bg: "rgba(56,225,255,0.08)",   border: "rgba(56,225,255,0.2)"   },
};

export function PlatformBadge({ source }: { source: ArticleSource }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.native;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium leading-none"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: cfg.color }}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}
