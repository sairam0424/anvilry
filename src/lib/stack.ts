/**
 * Stack wall data (home "Stack" section, src/components/home/stack.tsx).
 *
 * Derived from profile.skills so the icon wall, the résumé Skills block
 * (home/resume-view.tsx), the Play-view skill tree (game/skill-tree.tsx), the chat corpus
 * and JSON Resume cannot drift apart: STACK_ENTRIES is keyed by the EXACT profile.skills
 * item string, and src/lib/stack.test.ts fails if a key is not a profile skill.
 *
 * Only TOOLS get a tile. Brands with a Simple Icons glyph are "brand" entries; three tools
 * whose logo has no usable licence (AWS, gRPC, ChromaDB) render a neutral lucide glyph and
 * never a trademarked mark. Concept skills (RAG, Microservices, ...) stay in /about and the
 * résumé by design.
 *
 * Colour: tiles are --fg-muted at rest and take the brand colour on hover/focus through
 * per-tile CSS variables (--brand-dark / --brand-light, see .stack-icon in globals.css).
 * Brands whose hex fails 3:1 against a theme's --bg-base carry an override for that theme;
 * the test enforces this with the WCAG contrast formula.
 */
import { skills } from "@/lib/profile";
import type { StackGlyphKey, StackIconKey } from "@/components/stack-icons";

export type StackEntry =
  | {
      kind: "brand";
      href: string;
      icon: StackIconKey;
      /** Simple Icons brand hex, "#RRGGBB" (simple-icons@16.35.0). */
      hex: `#${string}`;
      /** Hover/focus colour when `hex` is below 3:1 on the dark --bg-base (#07080d). */
      hoverDark?: string;
      /** Hover/focus colour when `hex` is below 3:1 on the light --bg-base (#f7f8fb). */
      hoverLight?: string;
    }
  | { kind: "glyph"; href: string; glyph: StackGlyphKey };

/** Keyed by the EXACT profile.skills item string. */
export const STACK_ENTRIES: Record<string, StackEntry> = {
  Python: {
    kind: "brand",
    href: "https://www.python.org/",
    icon: "python",
    hex: "#3776AB",
  },
  Go: {
    kind: "brand",
    href: "https://go.dev/",
    icon: "go",
    hex: "#00ADD8",
    hoverLight: "var(--accent)",
  },
  TypeScript: {
    kind: "brand",
    href: "https://www.typescriptlang.org/",
    icon: "typescript",
    hex: "#3178C6",
  },
  crewAI: {
    kind: "brand",
    href: "https://www.crewai.com/",
    icon: "crewai",
    hex: "#FF5A50",
    hoverLight: "var(--accent)",
  },
  FastAPI: {
    kind: "brand",
    href: "https://fastapi.tiangolo.com/",
    icon: "fastapi",
    hex: "#009688",
  },
  gRPC: { kind: "glyph", href: "https://grpc.io/", glyph: "network" },
  GraphQL: {
    kind: "brand",
    href: "https://graphql.org/",
    icon: "graphql",
    hex: "#E10098",
  },
  PostgreSQL: {
    kind: "brand",
    href: "https://www.postgresql.org/",
    icon: "postgresql",
    hex: "#4169E1",
  },
  MongoDB: {
    kind: "brand",
    href: "https://www.mongodb.com/",
    icon: "mongodb",
    hex: "#47A248",
  },
  Redis: {
    kind: "brand",
    href: "https://redis.io/",
    icon: "redis",
    hex: "#FF4438",
  },
  ChromaDB: {
    kind: "glyph",
    href: "https://www.trychroma.com/",
    glyph: "database",
  },
  "Apache Kafka": {
    kind: "brand",
    href: "https://kafka.apache.org/",
    icon: "apachekafka",
    hex: "#231F20",
    hoverDark: "var(--fg)",
  },
  AWS: { kind: "glyph", href: "https://aws.amazon.com/", glyph: "cloud" },
  Docker: {
    kind: "brand",
    href: "https://www.docker.com/",
    icon: "docker",
    hex: "#2496ED",
    hoverLight: "var(--accent)",
  },
  Kubernetes: {
    kind: "brand",
    href: "https://kubernetes.io/",
    icon: "kubernetes",
    hex: "#326CE5",
  },
  OpenTelemetry: {
    kind: "brand",
    href: "https://opentelemetry.io/",
    icon: "opentelemetry",
    hex: "#000000",
    hoverDark: "var(--fg)",
  },
  Prometheus: {
    kind: "brand",
    href: "https://prometheus.io/",
    icon: "prometheus",
    hex: "#E6522C",
  },
  Grafana: {
    kind: "brand",
    href: "https://grafana.com/",
    icon: "grafana",
    hex: "#F46800",
    hoverLight: "var(--accent)",
  },
  React: {
    kind: "brand",
    href: "https://react.dev/",
    icon: "react",
    hex: "#61DAFB",
    hoverLight: "var(--accent)",
  },
  Angular: {
    kind: "brand",
    href: "https://angular.dev/",
    icon: "angular",
    hex: "#0F0F11",
    hoverDark: "var(--fg)",
  },
  "Next.js": {
    kind: "brand",
    href: "https://nextjs.org/",
    icon: "nextdotjs",
    hex: "#000000",
    hoverDark: "var(--fg)",
  },
  "Tailwind CSS": {
    kind: "brand",
    href: "https://tailwindcss.com/",
    icon: "tailwindcss",
    hex: "#06B6D4",
    hoverLight: "var(--accent)",
  },
};

export type StackItem = StackEntry & { name: string; group: string };

/** Flat list in profile.skills order (group order, then item order). */
export const stackItems: readonly StackItem[] = skills.flatMap((g) =>
  g.items.flatMap((name) => {
    const entry = STACK_ENTRIES[name];
    return entry ? [{ ...entry, name, group: g.group }] : [];
  }),
);

/** The same tiles grouped by profile group (empty groups dropped), for a captioned-rows variant. */
export const stackGroups = skills
  .map((g) => ({
    group: g.group,
    items: stackItems.filter((i) => i.group === g.group),
  }))
  .filter((g) => g.items.length > 0);

/** Per-tile CSS custom properties read by the `.stack-icon` utility in globals.css. */
export function stackBrandVars(item: StackItem): Record<string, string> {
  if (item.kind !== "brand") return {};
  return {
    "--brand-dark": item.hoverDark ?? item.hex,
    "--brand-light": item.hoverLight ?? item.hex,
  };
}
