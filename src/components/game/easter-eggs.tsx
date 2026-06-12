"use client";

import { useEffect, useRef, useState } from "react";
import { profile } from "@/lib/profile";

/**
 * Zero-cost "subtle delight" easter eggs for the gamified view. Neither gates any
 * content nor affects the recruiter-in-a-hurry path:
 *
 *  1. CONSOLE GREETING — a styled hire-me note for the curious dev who opens
 *     DevTools (printed once per session).
 *  2. KONAMI CODE — the classic sequence triggers a brief, dismissible celebratory
 *     toast. Purely cosmetic; auto-dismisses; respects reduced-motion implicitly
 *     (it's a static toast, no animation that conveys meaning).
 *
 * No XP, no levels, no score — honest delight only.
 */
const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

let consoleGreeted = false;

export function EasterEggs() {
  const [celebrate, setCelebrate] = useState(false);
  const progress = useRef(0);

  // 1. Console greeting (once per session).
  useEffect(() => {
    if (consoleGreeted) return;
    consoleGreeted = true;
    console.log(
      `%c~/ ${profile.name} %c\nGenAI & Backend Engineer — you found the console. 👋\nIf you're hiring for agent infra or event-driven backends, let's talk:\n${profile.email} · ${profile.links.github}\n(psst — try the Konami code on this page)`,
      "color:#38e1ff;font-weight:bold;font-size:14px",
      "color:#9aa3b8;font-size:12px",
    );
  }, []);

  // 2. Konami code listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const expected = KONAMI[progress.current];
      // Case-insensitive for the trailing b/a.
      if (e.key.toLowerCase() === expected.toLowerCase()) {
        progress.current += 1;
        if (progress.current === KONAMI.length) {
          progress.current = 0;
          setCelebrate(true);
        }
      } else {
        // Reset, but allow this key to start a fresh sequence.
        progress.current = e.key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(false), 4000);
    return () => clearTimeout(t);
  }, [celebrate]);

  if (!celebrate) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-accent/50 bg-bg-elevated px-5 py-2.5 text-sm font-medium text-fg shadow-lg shadow-accent/20"
    >
      <span className="text-accent">★</span> Achievement unlocked: you know the code.
      Thanks for exploring — now go read a dossier.
    </div>
  );
}
