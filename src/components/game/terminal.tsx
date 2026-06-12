"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TerminalSquare } from "lucide-react";
import { profile } from "@/lib/profile";
import { allProjects, allWork, getProject, getWork } from "@/lib/content";
import { useView } from "@/components/view-context";

/**
 * Optional terminal command bar — the power-user half of the "Graph + Terminal"
 * gamified view. Fully keyboard-native, resolves targets through the SAME content
 * allowlist as everything else (getProject/getWork), and NEVER gates content (the
 * graph + DOM index remain the primary way to explore). Commands:
 *   help · ls [projects|work] · open <slug> · whoami · classic · clear
 */
type Line = { kind: "in" | "out" | "err"; text: string };

const HELP = [
  "Available commands:",
  "  help            show this help",
  "  ls [projects|work]   list systems (default: all)",
  "  open <slug>     open a project/work dossier",
  "  whoami          a quick bio",
  "  classic         switch to the classic view",
  "  clear           clear the screen",
].join("\n");

export function Terminal() {
  const router = useRouter();
  const { setView } = useView();
  const [lines, setLines] = useState<Line[]>([
    { kind: "out", text: `${profile.name} — type 'help' to explore. (the graph + index above work too)` },
  ]);
  const [input, setInput] = useState("");
  const histRef = useRef<HTMLDivElement>(null);

  const print = useCallback((next: Line[]) => {
    setLines((prev) => [...prev, ...next]);
    // Scroll the log to the newest line after paint.
    queueMicrotask(() => {
      if (histRef.current) histRef.current.scrollTop = histRef.current.scrollHeight;
    });
  }, []);

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      if (!cmd) return;
      const [name, ...rest] = cmd.split(/\s+/);
      const arg = rest.join(" ");
      const echo: Line = { kind: "in", text: `$ ${cmd}` };

      switch (name.toLowerCase()) {
        case "help":
          print([echo, { kind: "out", text: HELP }]);
          break;
        case "whoami":
          print([
            echo,
            { kind: "out", text: `${profile.name} · ${profile.role} @ ${profile.company}\n${profile.headline}` },
          ]);
          break;
        case "ls": {
          const which = arg.toLowerCase();
          const list =
            which === "work"
              ? allWork.map((w) => `  ${w.slug}  —  ${w.name}`)
              : which === "projects"
                ? allProjects.map((p) => `  ${p.slug}  —  ${p.name}`)
                : [
                    "work/",
                    ...allWork.map((w) => `  ${w.slug}  —  ${w.name}`),
                    "projects/",
                    ...allProjects.map((p) => `  ${p.slug}  —  ${p.name}`),
                  ];
          print([echo, { kind: "out", text: list.join("\n") }]);
          break;
        }
        case "open": {
          if (!arg) {
            print([echo, { kind: "err", text: "usage: open <slug>  (try 'ls')" }]);
            break;
          }
          const work = getWork(arg);
          const project = getProject(arg);
          const target = work ?? project;
          if (!target) {
            print([echo, { kind: "err", text: `not found: ${arg}  (try 'ls')` }]);
            break;
          }
          print([echo, { kind: "out", text: `opening ${target.name} …` }]);
          router.push(target.url);
          break;
        }
        case "classic":
          print([echo, { kind: "out", text: "switching to classic view …" }]);
          setView("classic");
          break;
        case "clear":
          setLines([]);
          break;
        default:
          print([echo, { kind: "err", text: `command not found: ${name}  (try 'help')` }]);
      }
    },
    [print, router, setView],
  );

  return (
    <section aria-label="Terminal" className="mt-8">
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-base/80 font-mono text-xs">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-fg-subtle">
          <TerminalSquare size={13} className="text-accent" />
          <span>sairam@portfolio</span>
          <span className="ml-auto text-[10px]">optional · keyboard-native · gates nothing</span>
        </div>

        <div ref={histRef} className="max-h-56 space-y-1 overflow-y-auto px-4 py-3" aria-live="polite">
          {lines.map((l, i) => (
            <pre
              key={i}
              className={
                l.kind === "in"
                  ? "whitespace-pre-wrap text-accent"
                  : l.kind === "err"
                    ? "whitespace-pre-wrap text-amber"
                    : "whitespace-pre-wrap text-fg-muted"
              }
            >
              {l.text}
            </pre>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
            setInput("");
          }}
          className="flex items-center gap-2 border-t border-border px-4 py-2"
        >
          <span className="text-accent" aria-hidden="true">{">"}</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="type a command — e.g. ls, open mindforge, whoami"
            aria-label="Terminal command input"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="flex-1 bg-transparent py-1 text-fg outline-none placeholder:text-fg-subtle"
          />
        </form>
      </div>
    </section>
  );
}
