"use client";

import { useEffect } from "react";
import { profile } from "@/lib/profile";
import { hasPersonalContent } from "@/lib/personal";

/**
 * GLOBAL DevTools console greeting (mounted once in the root layout, so it fires in every
 * view): a styled hire-me note for the curious dev who opens the console. Printed ONCE PER
 * PAGE LOAD — the flag below is module state, so React strict-mode double effects and
 * re-mounts do not repeat it. Renders nothing.
 *
 * When there is personal content to find it also points at the hidden `secret` terminal
 * command; with none it says nothing about it (empty-safe: never hint at content that is
 * not there).
 *
 * This component used to carry a Konami-code reveal card as well. That was removed at the
 * owner's request (2026-10-01). The name stays because this greeting is still the console
 * breadcrumb for the hidden egg commands (secret/uses/now).
 */
let consoleGreeted = false;

export function EasterEggs() {
  useEffect(() => {
    if (consoleGreeted) return;
    consoleGreeted = true;
    const secretHint = hasPersonalContent
      ? "\n(psst — type `secret` in Developer mode)"
      : "";
    console.log(
      `%c~/ ${profile.name} %c\nGenAI & Backend Engineer — you found the console. 👋\nIf you're hiring for agent infra or event-driven backends, let's talk:\n${profile.email} · ${profile.links.github} · ${profile.links.npm} · ${profile.links.pypi} · ${profile.links.devto} · ${profile.links.substack}${secretHint}`,
      "color:#38e1ff;font-weight:bold;font-size:14px",
      "color:#9aa3b8;font-size:12px",
    );
  }, []);

  return null;
}
