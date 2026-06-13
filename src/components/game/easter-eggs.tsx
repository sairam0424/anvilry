"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { profile } from "@/lib/profile";
import { personal, hasPersonalContent } from "@/lib/personal";

/**
 * GLOBAL "subtle delight" easter eggs (mounted once in the root layout, so they work in
 * every view — not just Play). Neither gates content nor blocks the recruiter path:
 *
 *  1. CONSOLE GREETING — a styled hire-me note for the curious dev who opens DevTools
 *     (once per session), now hinting BOTH the Konami code AND the hidden `secret`
 *     terminal command — the breadcrumb that unifies the two discovery tracks.
 *  2. KONAMI CODE — reveals an accessible DISCLOSURE card (WAI-ARIA pattern: focusable,
 *     Esc-dismissible, NO focus trap, no backdrop) showing one owner-authored personal
 *     fact + a pointer to `secret`. Empty-safe: with no personal content it stays a
 *     brief celebratory toast (no fabricated content). The arrow-key listener is
 *     IGNORED while a text input/terminal is focused, so it never fights ↑/↓ history.
 *
 * No XP, no levels, no score — honest delight only. Found-eggs persist (localStorage)
 * so a returning visitor isn't re-hidden-from. Personal content is ALSO reachable via
 * the always-visible `about`/`secret` terminal commands (never egg-locked — a11y).
 */
const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

const FOUND_KEY = "anvilry-eggs-found";

let consoleGreeted = false;

/** Mark an egg found (best-effort persistence; private mode is a no-op). */
function markFound(id: string) {
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem(FOUND_KEY) || "[]"));
    set.add(id);
    localStorage.setItem(FOUND_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode — ignore */
  }
}

/** Is a text input / terminal currently focused? (don't let Konami fight typing) */
function isTypingTarget(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/** The one personal line the Konami card reveals (first fun fact, else first hobby). */
function konamiReveal(): string | null {
  if (!hasPersonalContent) return null;
  return personal.funFacts[0] ?? personal.hobbies[0] ?? personal.currentlyLearning[0] ?? null;
}

export function EasterEggs() {
  const [open, setOpen] = useState(false);
  const progress = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // 1. Console greeting (once per session) — extended with both breadcrumbs.
  useEffect(() => {
    if (consoleGreeted) return;
    consoleGreeted = true;
    const secretHint = hasPersonalContent ? "\n(psst — type `secret` in Developer mode, or try the Konami code)" : "\n(psst — try the Konami code)";
    console.log(
      `%c~/ ${profile.name} %c\nGenAI & Backend Engineer — you found the console. 👋\nIf you're hiring for agent infra or event-driven backends, let's talk:\n${profile.email} · ${profile.links.github}${secretHint}`,
      "color:#38e1ff;font-weight:bold;font-size:14px",
      "color:#9aa3b8;font-size:12px",
    );
  }, []);

  // 2. Konami listener — guarded against text-input focus so it never fights typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget()) {
        progress.current = 0;
        return;
      }
      const expected = KONAMI[progress.current];
      if (e.key.toLowerCase() === expected.toLowerCase()) {
        progress.current += 1;
        if (progress.current === KONAMI.length) {
          progress.current = 0;
          markFound("konami");
          setOpen(true);
        }
      } else {
        progress.current = e.key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Move focus into the card when it opens (disclosure, not a trap — Esc/Tab free).
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  // Esc closes (disclosure affordance — never traps focus).
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, close]);

  if (!open) return null;

  const fact = konamiReveal();

  return (
    <div
      ref={cardRef}
      role="status"
      tabIndex={-1}
      // .hero-rise is an existing CSS keyframe (rise + fade) that is itself
      // reduced-motion-gated in globals.css — reuse it instead of a phantom animate-in
      // utility (Tailwind v4 here has no tailwindcss-animate, so those silently no-op).
      className="hero-rise fixed bottom-6 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-accent/50 bg-bg-elevated p-5 text-sm text-fg shadow-2xl shadow-accent/20 outline-none"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={15} />
      </button>
      <p className="flex items-center gap-1.5 font-medium text-accent">
        <Sparkles size={15} aria-hidden="true" /> You know the code.
      </p>
      {fact ? (
        <>
          <p className="mt-2 text-fg-muted">{fact}</p>
          <p className="mt-3 text-xs text-fg-subtle">
            More of the personal side: run <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-fg">secret</code>{" "}
            in Developer mode.
          </p>
        </>
      ) : (
        <p className="mt-2 text-fg-muted">Thanks for exploring — now go read a dossier.</p>
      )}
    </div>
  );
}
